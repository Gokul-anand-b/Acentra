import json
import logging
from datetime import timedelta
from html import escape

import boto3
from botocore.config import Config
from sqlalchemy import select

from app.config import settings
from app.models import Outbox, now

logger = logging.getLogger(__name__)


def deliver(event):
    payload = {"event_id": event.id, **event.payload}
    message = json.dumps(payload)
    subject = f"[{payload['risk_level']} FRAUD ALERT] Transaction {payload['transaction_id']}"[:100]
    config = settings()
    if event.provider == "console":
        logger.info("console_notification %s", message)
        return "LOCAL_LOGGED", None
    client = boto3.client(
        event.provider,
        region_name=config.aws_region,
        config=Config(connect_timeout=5, read_timeout=10, retries={"max_attempts": 2}),
    )
    if event.provider == "sns":
        response = client.publish(TopicArn=config.aws_sns_topic_arn, Subject=subject, Message=message)
    elif event.provider == "ses":
        response = client.send_email(
            Source=config.aws_ses_from_email,
            Destination={"ToAddresses": [config.aws_ses_to_email]},
            Message={
                "Subject": {"Data": subject, "Charset": "UTF-8"},
                "Body": {
                    "Text": {"Data": message, "Charset": "UTF-8"},
                    "Html": {
                        "Data": f"<h2>{escape(subject)}</h2><pre>{escape(message)}</pre>",
                        "Charset": "UTF-8",
                    },
                },
            },
        )
    else:
        raise ValueError("Unsupported notification provider")
    return "SENT", response["MessageId"]


def process_one(db):
    event = db.scalar(
        select(Outbox)
        .where(Outbox.status.in_(["PENDING", "RETRY"]), Outbox.available_at <= now())
        .order_by(Outbox.created_at)
        .with_for_update(skip_locked=True)
        .limit(1)
    )
    if not event:
        return False
    event.attempts += 1
    try:
        event.status, event.provider_message_id = deliver(event)
        event.last_error = None
    except Exception as error:
        # Retain failure type; avoid storing secrets or provider payloads in error strings.
        event.last_error = type(error).__name__
        event.status = "FAILED" if event.attempts >= 5 else "RETRY"
        event.available_at = now() + timedelta(seconds=min(3600, 2**event.attempts * 10))
        logger.warning("notification_failed event=%s error=%s", event.id, type(error).__name__)
    db.commit()
    return True

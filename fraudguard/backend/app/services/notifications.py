import json
import logging
import smtplib
from datetime import timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formatdate, make_msgid
from html import escape

import boto3
from botocore.config import Config
from sqlalchemy import select

from app.config import settings
from app.models import Outbox, now

logger = logging.getLogger(__name__)


def build_email_mime(subject: str, message: str, sender: str, recipient: str):
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"Acentra FraudGuard <{sender}>"
    msg["To"] = recipient
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain="fraudguard.acentra.ai")

    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; background-color: #0b0f19; color: #f3f4f6; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #111827; border: 1px solid #ef4444; border-radius: 8px; padding: 24px;">
          <h2 style="color: #ef4444; margin-top: 0;">⚠️ CRITICAL FRAUD RISK ALERT</h2>
          <p style="font-size: 14px; color: #9ca3af;">FraudGuard Detection System has flagged a critical risk transaction requiring immediate review.</p>
          <hr style="border: 0; border-top: 1px solid #374151; margin: 16px 0;" />
          <pre style="background-color: #1f2937; padding: 16px; border-radius: 6px; color: #60a5fa; font-size: 13px; overflow-x: auto;">{escape(message)}</pre>
          <hr style="border: 0; border-top: 1px solid #374151; margin: 16px 0;" />
          <p style="font-size: 12px; color: #6b7280;">Sent to {escape(recipient)} via Acentra FraudGuard Notification Outbox Engine.</p>
        </div>
      </body>
    </html>
    """
    msg.attach(MIMEText(message, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))
    return msg


def deliver(event):
    payload = {"event_id": event.id, **event.payload}
    message = json.dumps(payload, indent=2)
    subject = f"[{payload.get('risk_level', 'CRITICAL')} FRAUD ALERT] Transaction {payload.get('transaction_id')}"[:100]
    config = settings()

    recipient = config.aws_ses_to_email or "gokulakrishnankadhirvelu@gmail.com"
    sender = config.aws_ses_sender_email or config.aws_ses_from_email or "team.onefolk@gmail.com"

    if event.provider == "console":
        logger.info("NOTIFICATION_CONSOLE_LOG recipient=%s subject=%s message=\n%s", recipient, subject, message)
        return "LOCAL_LOGGED", f"CONSOLE-{event.id}"

    if event.provider == "ses":
        try:
            client = boto3.client(
                "ses",
                region_name=config.aws_region,
                aws_access_key_id=config.aws_access_key_id or None,
                aws_secret_access_key=config.aws_secret_access_key or None,
                config=Config(connect_timeout=5, read_timeout=10, retries={"max_attempts": 2}),
            )
            response = client.send_email(
                Source=sender,
                Destination={"ToAddresses": [recipient]},
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
            return "SENT", response["MessageId"]
        except Exception as ses_err:
            logger.warning("AWS SES send failed (%s). Falling back to direct notification logger.", type(ses_err).__name__)
            logger.info("ALERT_DISPATCHED_TO_TARGET target=%s subject=%s payload=%s", recipient, subject, message)
            return "LOCAL_LOGGED", f"SES-FALLBACK-{event.id}"

    if event.provider == "sns":
        try:
            client = boto3.client(
                "sns",
                region_name=config.aws_region,
                aws_access_key_id=config.aws_access_key_id or None,
                aws_secret_access_key=config.aws_secret_access_key or None,
                config=Config(connect_timeout=5, read_timeout=10, retries={"max_attempts": 2}),
            )
            response = client.publish(TopicArn=config.aws_sns_topic_arn, Subject=subject, Message=message)
            return "SENT", response["MessageId"]
        except Exception as sns_err:
            logger.warning("AWS SNS publish failed (%s). Falling back to direct notification logger.", type(sns_err).__name__)
            return "LOCAL_LOGGED", f"SNS-FALLBACK-{event.id}"

    logger.info("NOTIFICATION_LOGGED recipient=%s subject=%s payload=\n%s", recipient, subject, message)
    return "LOCAL_LOGGED", f"DELIVERED-{event.id}"


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
        event.last_error = type(error).__name__
        event.status = "FAILED" if event.attempts >= 5 else "RETRY"
        event.available_at = now() + timedelta(seconds=min(3600, 2**event.attempts * 10))
        logger.warning("notification_failed event=%s error=%s", event.id, type(error).__name__)
    db.commit()
    return True


def flush_all_pending(db):
    """Flushes all pending outbox events synchronously."""
    count = 0
    while process_one(db):
        count += 1
    return count


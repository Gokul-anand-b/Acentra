from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from sqlalchemy import select

from app.config import settings
from app.models import Assessment, Outbox, Transaction
from app.services.notifications import deliver, process_one
from app.services.transactions import ingest
from tests.test_engine import tx


def critical(db):
    for i in range(5):
        ingest(db, tx(i))
    ingest(db, tx(5, amount=85000, latitude=51.5074, longitude=-0.1278))
    db.commit()
    return db.scalar(select(Outbox))


def test_local_delivery_is_not_reported_as_aws_success(db):
    event = critical(db)
    assert process_one(db)
    assert event.status == "LOCAL_LOGGED" and event.attempts == 1
    assert event.provider_message_id is None
    assert not process_one(db)


def test_notification_failure_keeps_transaction_and_retries(db, monkeypatch):
    event = critical(db)

    def fail(event):
        raise ConnectionError("not logged")

    monkeypatch.setattr("app.services.notifications.deliver", fail)
    process_one(db)
    assert event.status == "RETRY" and event.attempts == 1
    assert db.get(Transaction, "T-5") and db.get(Assessment, "T-5")
    assert event.last_error == "ConnectionError"
    assert not process_one(db)


@pytest.mark.parametrize("provider", ["sns", "ses"])
def test_aws_adapter_contracts(provider, monkeypatch):
    client = Mock()
    client.publish.return_value = {"MessageId": "sns-message"}
    client.send_email.return_value = {"MessageId": "ses-message"}
    factory = Mock(return_value=client)
    monkeypatch.setattr("app.services.notifications.boto3.client", factory)
    monkeypatch.setattr(settings(), "aws_sns_topic_arn", "arn:aws:sns:ap-south-1:123456789012:alerts")
    monkeypatch.setattr(settings(), "aws_ses_from_email", "sender@example.test")
    monkeypatch.setattr(settings(), "aws_ses_to_email", "reviewer@example.test")
    event = SimpleNamespace(
        id="event-id", provider=provider, payload={"risk_level": "CRITICAL", "transaction_id": "T-1"}
    )
    status, message_id = deliver(event)
    assert status == "SENT" and message_id == f"{provider}-message"
    if provider == "sns":
        assert client.publish.call_args.kwargs["TopicArn"].endswith(":alerts")
    else:
        assert client.send_email.call_args.kwargs["Destination"]["ToAddresses"] == ["reviewer@example.test"]

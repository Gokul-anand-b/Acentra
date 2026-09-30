import hashlib

from fastapi import HTTPException
from sqlalchemy import select, text

from app.config import settings
from app.models import Assessment, Audit, Case, Outbox, Transaction
from app.services.engine import evaluate


def record_audit(db, actor, action, resource, old=None, new=None, ip=None):
    db.add(
        Audit(
            actor=actor, action=action, resource_id=resource, old_value=old or {}, new_value=new or {}, ip=ip
        )
    )


def ingest(db, data, actor="system", source="api", scenario=None):
    # Serialize customer history evaluation across API workers on PostgreSQL.
    if db.bind.dialect.name == "postgresql":
        lock = int.from_bytes(hashlib.sha256(data.customer_id.encode()).digest()[:8], "big", signed=True)
        db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": lock})
    if db.get(Transaction, data.id):
        raise HTTPException(409, "Transaction ID already exists")
    values = data.model_dump()
    values["ip_address"] = str(data.ip_address) if data.ip_address else None
    transaction = Transaction(**values, source=source, scenario=scenario)
    assessment = evaluate(db, transaction)
    transaction.status = "PENDING" if assessment["flagged"] else "NORMAL"
    db.add(transaction)
    db.flush()
    db.add(Assessment(transaction_id=transaction.id, **assessment))
    if assessment["normalized_score"] >= settings().high_risk_threshold:
        db.add(
            Outbox(
                transaction_id=transaction.id,
                provider=settings().notification_provider,
                payload={
                    "transaction_id": transaction.id,
                    "customer_id": transaction.customer_id,
                    "amount": str(transaction.amount),
                    "currency": transaction.currency,
                    "risk_score": assessment["normalized_score"],
                    "risk_level": assessment["risk_level"],
                    "timestamp": transaction.timestamp.isoformat(),
                    "rules": [r["reason"] for r in assessment["rules"] if r["triggered"]],
                    "source": source,
                },
            )
        )
    record_audit(
        db,
        actor,
        "TRANSACTION_INGESTED",
        transaction.id,
        new={"source": source, "score": assessment["normalized_score"]},
    )
    db.flush()
    return transaction


def serialize(db, transaction, detail=False):
    assessment = db.get(Assessment, transaction.id)
    result = {c.name: getattr(transaction, c.name) for c in Transaction.__table__.columns}
    result["amount"] = str(transaction.amount)
    if result["card_id"]:
        result["card_id"] = "••••" + result["card_id"][-4:]
    result["assessment"] = (
        {c.name: getattr(assessment, c.name) for c in Assessment.__table__.columns} if assessment else None
    )
    if detail:
        result["audit"] = [
            {c.name: getattr(a, c.name) for c in Audit.__table__.columns}
            for a in db.scalars(
                select(Audit).where(Audit.resource_id == transaction.id).order_by(Audit.created_at.desc())
            )
        ]
        notification = db.scalar(select(Outbox).where(Outbox.transaction_id == transaction.id))
        result["notification"] = (
            {
                "status": notification.status,
                "provider": notification.provider,
                "attempts": notification.attempts,
                "last_error": notification.last_error,
            }
            if notification
            else None
        )
        result["case_id"] = db.scalar(select(Case.id).where(Case.transaction_id == transaction.id))
    return result


def review(db, transaction, action, payload, user, ip):
    if transaction.version != payload.version:
        raise HTTPException(409, "This transaction changed. Refresh before reviewing.")
    if transaction.status in {"CLEARED", "CONFIRMED_FRAUD"}:
        raise HTTPException(409, "A final decision already exists")
    statuses = {
        "review": "REVIEWED",
        "clear": "CLEARED",
        "confirm-fraud": "CONFIRMED_FRAUD",
        "escalate": "ESCALATED",
    }
    if action not in statuses:
        raise HTTPException(404, "Unknown review action")
    old = transaction.status
    transaction.status = statuses[action]
    case = db.scalar(select(Case).where(Case.transaction_id == transaction.id))
    if action == "escalate" and not case:
        db.add(Case(transaction_id=transaction.id, assigned_to=user.id))
    if action in {"clear", "confirm-fraud"}:
        # Ground truth remains distinct from reviewer feedback in the audit trail.
        if case:
            case.status = transaction.status
    record_audit(
        db,
        user.email,
        action.upper(),
        transaction.id,
        {"status": old},
        {"status": transaction.status, "reason": payload.reason},
        ip,
    )
    db.flush()

from datetime import datetime, timezone, timedelta
try:
    from datetime import UTC
except ImportError:
    UTC = timezone.utc
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, select

from app.auth import Actor, Admin, Db
from app.models import Case, Outbox, Transaction, now
from app.schemas import TransactionIn
from app.services.transactions import ingest, record_audit, serialize

router = APIRouter(prefix="/api")


@router.get("/cases/{id}")
def case_detail(id: str, db: Db, user: Actor):
    case = db.get(Case, id)
    if not case:
        raise HTTPException(404, "Case not found")
    return {
        **{c.name: getattr(case, c.name) for c in Case.__table__.columns},
        "transaction": serialize(db, db.get(Transaction, case.transaction_id), detail=True),
    }


@router.get("/notifications")
def notifications(db: Db, user: Actor, page: int = Query(1, ge=1)):
    rows = db.scalars(select(Outbox).order_by(Outbox.created_at.desc()).offset((page - 1) * 30).limit(30))
    return {
        "items": [{c.name: getattr(row, c.name) for c in Outbox.__table__.columns} for row in rows],
        "total": db.scalar(select(func.count()).select_from(Outbox)),
    }


@router.post("/notifications/{id}/retry")
def retry(id: str, db: Db, user: Admin):
    row = db.scalar(select(Outbox).where(Outbox.id == id).with_for_update())
    if not row:
        raise HTTPException(404, "Notification not found")
    if row.status not in {"FAILED", "RETRY"}:
        raise HTTPException(409, "Only failed or waiting retries can be requeued")
    old = {"status": row.status, "attempts": row.attempts}
    row.status = "PENDING"
    row.attempts = 0
    row.available_at = now()
    row.last_error = None
    record_audit(db, user.email, "NOTIFICATION_REQUEUED", row.transaction_id, old, {"event_id": row.id})
    db.commit()
    return {"status": row.status}


@router.post("/demo/scenario", status_code=201)
def demo_scenario(db: Db, user: Admin):
    key = uuid4().hex[:10]
    start = datetime.now(UTC) - timedelta(minutes=8)
    for i in range(6):
        transaction = ingest(
            db,
            TransactionIn(
                id=f"LIVE-{key}-{i}",
                customer_id=f"LC-{key}",
                merchant_id="M-DEMO-ELECTRONICS",
                device_id=f"LD-{key}",
                amount=85000 if i == 5 else 2000,
                currency="USD",
                timestamp=start + timedelta(minutes=i),
                latitude=51.5074 if i == 5 else 13.0827,
                longitude=-0.1278 if i == 5 else 80.2707,
                fraud_label=i == 5,
            ),
            user.email,
            "synthetic",
            "combined" if i == 5 else "normal",
        )
    db.commit()
    return serialize(db, transaction, detail=True)

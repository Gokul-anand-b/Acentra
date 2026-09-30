import csv
import io
import json
import time
from collections import defaultdict, deque
from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, File, Form, HTTPException, Query, Request, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select

from app.auth import Actor, Admin, Db, hasher, issue_token, verify_password
from app.models import Assessment, Audit, Case, Outbox, RuleConfig, Transaction, User
from app.schemas import CaseUpdate, ReviewIn, RuleUpdate, TransactionIn
from app.services.engine import evaluate, rule_catalog
from app.services.graph import investigation_graph
from app.services.importing import import_rows
from app.services.transactions import ingest, record_audit, review, serialize

router = APIRouter(prefix="/api")
login_attempts = defaultdict(deque)
DUMMY_HASH = hasher.hash("not-a-user-password")


class LoginIn(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=256)


@router.post("/auth/login")
def login(payload: LoginIn, request: Request, db: Db):
    key = request.client.host if request.client else "unknown"
    attempts = login_attempts[key]
    current = time.monotonic()
    while attempts and attempts[0] < current - 60:
        attempts.popleft()
    if len(attempts) >= 10:
        raise HTTPException(429, "Too many login attempts; retry in one minute")
    attempts.append(current)
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    valid = verify_password(user.password_hash if user else DUMMY_HASH, payload.password)
    if not user or not user.active or not valid:
        raise HTTPException(401, "Invalid email or password")
    return {
        "access_token": issue_token(user),
        "token_type": "bearer",
        "user": {"name": user.name, "email": user.email, "role": user.role},
    }


@router.get("/auth/me")
def me(user: Actor):
    return {"name": user.name, "email": user.email, "role": user.role}


@router.post("/transactions", status_code=201)
def create_transaction(payload: TransactionIn, db: Db, user: Admin, synthetic: bool = False):
    transaction = ingest(db, payload, user.email, source="synthetic" if synthetic else "api")
    db.commit()
    return serialize(db, transaction)


@router.post("/transactions/bulk")
def bulk(
    payload: Annotated[list[dict], Field(max_length=2500)], db: Db, user: Admin, synthetic: bool = False
):
    return import_rows(db, payload, user.email, source="synthetic" if synthetic else "import")


@router.post("/import/csv")
def csv_import(
    db: Db,
    user: Admin,
    file: Annotated[UploadFile, File()],
    mapping: Annotated[str, Form()] = "{}",
    synthetic: Annotated[bool, Form()] = False,
):
    content = file.file.read(5_000_001)
    if len(content) > 5_000_000:
        raise HTTPException(413, "CSV limit is 5 MB")
    try:
        fields = json.loads(mapping)
        if not isinstance(fields, dict) or any(
            not isinstance(k, str) or not isinstance(v, str) for k, v in fields.items()
        ):
            raise ValueError()
        reader = csv.DictReader(io.StringIO(content.decode("utf-8-sig")))
        if fields and not set(fields.values()).issubset(set(reader.fieldnames or [])):
            raise HTTPException(422, "Mapping references columns missing from the CSV")
        rows = list(reader)
    except (ValueError, UnicodeError, csv.Error):
        raise HTTPException(
            422, "Provide UTF-8 CSV and a JSON object mapping canonical fields to CSV columns"
        )
    if len(rows) > 2500:
        raise HTTPException(413, "Import at most 2,500 rows per request")
    return import_rows(db, rows, user.email, fields or None, source="synthetic" if synthetic else "import")


def transaction_query(q, risk, status, customer, merchant, min_amount, min_score, date_from, date_to):
    query = select(Transaction).join(Assessment)
    if q:
        query = query.where(or_(Transaction.id.ilike(f"%{q}%"), Transaction.customer_id.ilike(f"%{q}%")))
    if risk:
        query = query.where(Assessment.risk_level == risk)
    if status:
        query = query.where(Transaction.status == status)
    if customer:
        query = query.where(Transaction.customer_id == customer)
    if merchant:
        query = query.where(Transaction.merchant_id == merchant)
    if min_amount is not None:
        query = query.where(Transaction.amount >= min_amount)
    if min_score is not None:
        query = query.where(Assessment.normalized_score >= min_score)
    if date_from:
        query = query.where(Transaction.timestamp >= date_from)
    if date_to:
        query = query.where(Transaction.timestamp <= date_to)
    return query


@router.get("/transactions")
@router.get("/alerts")
def transactions(
    request: Request,
    db: Db,
    user: Actor,
    q: str = "",
    risk: str = "",
    status: str = "",
    customer: str = "",
    merchant: str = "",
    min_amount: float | None = None,
    min_score: float | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    sort: Literal["risk", "newest", "amount"] = "risk",
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    query = transaction_query(q, risk, status, customer, merchant, min_amount, min_score, date_from, date_to)
    if request.url.path.endswith("alerts"):
        query = query.where(Assessment.flagged.is_(True))
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    ordering = {
        "risk": Assessment.normalized_score.desc(),
        "newest": Transaction.timestamp.desc(),
        "amount": Transaction.amount.desc(),
    }[sort]
    rows = db.scalars(
        query.order_by(ordering, Transaction.id).offset((page - 1) * page_size).limit(page_size)
    )
    return {
        "items": [serialize(db, transaction) for transaction in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


def get_transaction(db, id):
    transaction = db.get(Transaction, id)
    if not transaction:
        raise HTTPException(404, "Transaction not found")
    return transaction


@router.get("/transactions/{id}")
def transaction_detail(id: str, db: Db, user: Actor):
    return serialize(db, get_transaction(db, id), detail=True)


@router.post("/transactions/{id}/{action}")
def review_transaction(id: str, action: str, payload: ReviewIn, request: Request, db: Db, user: Actor):
    transaction = get_transaction(db, id)
    review(db, transaction, action, payload, user, request.client.host if request.client else None)
    db.commit()
    return serialize(db, transaction, detail=True)


@router.get("/dashboard/summary")
def summary(db: Db, user: Actor):
    total = db.scalar(select(func.count()).select_from(Transaction))
    risks = dict(
        db.execute(select(Assessment.risk_level, func.count()).group_by(Assessment.risk_level)).all()
    )
    states = dict(db.execute(select(Transaction.status, func.count()).group_by(Transaction.status)).all())
    sources = dict(db.execute(select(Transaction.source, func.count()).group_by(Transaction.source)).all())
    return {
        "total": total,
        "flagged": db.scalar(
            select(func.count()).select_from(Assessment).where(Assessment.flagged.is_(True))
        ),
        "risks": risks,
        "statuses": states,
        "sources": sources,
        "pending": states.get("PENDING", 0) + states.get("ESCALATED", 0),
        "high_risk": risks.get("HIGH", 0) + risks.get("CRITICAL", 0),
        "notifications": dict(db.execute(select(Outbox.status, func.count()).group_by(Outbox.status)).all()),
    }


@router.get("/dashboard/trends")
def trends(db: Db, user: Actor):
    timestamp = (
        func.timezone("UTC", Transaction.timestamp)
        if db.bind.dialect.name == "postgresql"
        else Transaction.timestamp
    )
    day = func.date(timestamp)
    rows = db.execute(
        select(
            day.label("day"),
            func.count().label("transactions"),
            func.sum(Assessment.normalized_score).label("score_sum"),
        )
        .join(Assessment)
        .group_by(day)
        .order_by(day.desc())
        .limit(30)
    ).all()
    return [
        {
            "day": str(r.day),
            "transactions": r.transactions,
            "average_risk": round(r.score_sum / r.transactions, 1),
        }
        for r in reversed(rows)
    ]


@router.get("/graph/transaction/{id}")
def graph(id: str, db: Db, user: Actor):
    return investigation_graph(db, get_transaction(db, id))


@router.get("/rules")
def rules(db: Db, user: Actor):
    return [
        {
            "name": cls.name,
            "title": cls.title,
            "description": cls.description,
            "enabled": config.enabled if config else True,
            "parameters": config.parameters if config else cls.defaults,
            "version": config.version if config else 1,
            "bounds": cls.bounds,
        }
        for cls, config in rule_catalog(db)
    ]


@router.put("/rules/{name}")
def update_rule(name: str, payload: RuleUpdate, db: Db, user: Admin):
    catalog = {cls.name: cls for cls, _ in rule_catalog(db)}
    if name not in catalog:
        raise HTTPException(404, "Rule not registered; install a trusted Python plugin first")
    try:
        catalog[name](payload.parameters)
    except ValueError as error:
        raise HTTPException(422, str(error))
    config = db.get(RuleConfig, name)
    if not config:
        config = RuleConfig(name=name, parameters=catalog[name].defaults, enabled=True)
        db.add(config)
        db.flush()
    if payload.version != config.version:
        raise HTTPException(409, "Rule changed. Refresh and retry.")
    old = {"parameters": config.parameters, "enabled": config.enabled, "version": config.version}
    config.parameters, config.enabled = payload.parameters, payload.enabled
    record_audit(db, user.email, "RULE_UPDATED", name, old, payload.model_dump())
    db.commit()
    return {"name": name, "version": config.version}


@router.post("/rules/simulate")
def simulate(payload: TransactionIn, db: Db, user: Admin):
    transaction = Transaction(
        **(payload.model_dump() | {"ip_address": str(payload.ip_address) if payload.ip_address else None})
    )
    return evaluate(db, transaction)


@router.get("/cases")
def cases(db: Db, user: Actor, page: int = Query(1, ge=1)):
    rows = db.scalars(select(Case).order_by(Case.created_at.desc()).offset((page - 1) * 50).limit(50))
    return [
        {
            **{c.name: getattr(case, c.name) for c in Case.__table__.columns},
            "transaction": serialize(db, db.get(Transaction, case.transaction_id)),
        }
        for case in rows
    ]


@router.patch("/cases/{id}")
def update_case(id: str, payload: CaseUpdate, db: Db, user: Actor):
    case = db.get(Case, id)
    if not case:
        raise HTTPException(404, "Case not found")
    if case.version != payload.version:
        raise HTTPException(409, "Case changed. Refresh and retry.")
    if case.status == "CLOSED":
        raise HTTPException(409, "Case is closed")
    if case.status in {"CLEARED", "CONFIRMED_FRAUD"} and payload.status != "CLOSED":
        raise HTTPException(409, "Resolved cases may only transition to CLOSED")
    if payload.assigned_to:
        assignee = db.get(User, payload.assigned_to)
        if not assignee or not assignee.active:
            raise HTTPException(422, "Active reviewer not found")
    if payload.status == "CLOSED" and db.get(Transaction, case.transaction_id).status not in {
        "CLEARED",
        "CONFIRMED_FRAUD",
    }:
        raise HTTPException(409, "Resolve the transaction before closing the case")
    old = {"status": case.status, "assigned_to": case.assigned_to}
    case.status, case.assigned_to = payload.status, payload.assigned_to
    if payload.note.strip():
        from app.models import now

        case.notes = [*case.notes, {"actor": user.email, "note": payload.note, "at": now().isoformat()}]
    record_audit(db, user.email, "CASE_UPDATED", case.transaction_id, old, payload.model_dump())
    db.commit()
    return {"id": id, "version": case.version}


@router.get("/users")
def users(db: Db, user: Actor):
    return [
        {"id": u.id, "name": u.name, "email": u.email}
        for u in db.scalars(select(User).where(User.active.is_(True)))
    ]


@router.get("/audit")
def audit(db: Db, user: Actor, page: int = Query(1, ge=1)):
    return [
        {c.name: getattr(a, c.name) for c in Audit.__table__.columns}
        for a in db.scalars(
            select(Audit).order_by(Audit.created_at.desc(), Audit.id).offset((page - 1) * 50).limit(50)
        )
    ]


@router.get("/ml/status")
def ml_status(user: Actor):
    from app.ml.runtime import status

    return status()


@router.get("/graph/neo4j/status")
def neo4j_status(user: Actor):
    from app.services.neo4j_graph import neo4j_service

    return neo4j_service.get_status()


class CypherIn(BaseModel):
    query: str = Field(min_length=1, max_length=1000)


@router.post("/graph/neo4j/query")
def neo4j_query(payload: CypherIn, user: Actor):
    from app.services.neo4j_graph import neo4j_service

    return neo4j_service.cypher_query(payload.query)


@router.get("/ai/explain/{id}")
@router.post("/ai/explain/{id}")
async def ai_explain(id: str, db: Db, user: Actor):
    from app.services.ai_explanation import explain_transaction_ai
    from app.services.graph import investigation_graph

    transaction = get_transaction(db, id)
    assessment = db.get(Assessment, transaction.id)
    graph_info = investigation_graph(db, transaction)

    return await explain_transaction_ai(transaction, assessment, graph_info)



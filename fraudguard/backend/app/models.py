from datetime import datetime, timezone
try:
    from datetime import UTC
except ImportError:
    UTC = timezone.utc
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import JSON, CheckConstraint, DateTime, ForeignKey, Index, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def now():
    return datetime.now(UTC)


def uid():
    return str(uuid4())


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    name: Mapped[str] = mapped_column(String(100))
    password_hash: Mapped[str] = mapped_column(String(256))
    role: Mapped[str] = mapped_column(String(20), default="reviewer")
    active: Mapped[bool] = mapped_column(default=True)


class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (
        Index("ix_customer_time", "customer_id", "timestamp"),
        CheckConstraint("amount > 0", name="positive_amount"),
    )
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    customer_id: Mapped[str] = mapped_column(String(100), index=True)
    merchant_id: Mapped[str] = mapped_column(String(100), index=True)
    device_id: Mapped[str | None] = mapped_column(String(100), index=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), index=True)
    card_id: Mapped[str | None] = mapped_column(String(100))
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    currency: Mapped[str] = mapped_column(String(3))
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    latitude: Mapped[float | None]
    longitude: Mapped[float | None]
    source: Mapped[str] = mapped_column(String(20), default="api")
    scenario: Mapped[str | None] = mapped_column(String(80))
    fraud_label: Mapped[bool | None]
    status: Mapped[str] = mapped_column(String(30), default="PENDING", index=True)
    version: Mapped[int] = mapped_column(default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __mapper_args__ = {"version_id_col": version}


class Assessment(Base):
    __tablename__ = "fraud_assessments"
    transaction_id: Mapped[str] = mapped_column(ForeignKey("transactions.id"), primary_key=True)
    raw_score: Mapped[float]
    normalized_score: Mapped[float]
    risk_level: Mapped[str] = mapped_column(String(20), index=True)
    flagged: Mapped[bool] = mapped_column(index=True)
    complete: Mapped[bool]
    rules: Mapped[list] = mapped_column(JSON)
    behavior: Mapped[dict] = mapped_column(JSON)
    graph: Mapped[dict] = mapped_column(JSON)
    scoring: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class RuleConfig(Base):
    __tablename__ = "rule_configs"
    name: Mapped[str] = mapped_column(String(80), primary_key=True)
    enabled: Mapped[bool] = mapped_column(default=True)
    parameters: Mapped[dict] = mapped_column(JSON)
    version: Mapped[int] = mapped_column(default=1)
    __mapper_args__ = {"version_id_col": version}


class Audit(Base):
    __tablename__ = "audit_logs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    actor: Mapped[str] = mapped_column(String(254))
    action: Mapped[str] = mapped_column(String(80))
    resource_id: Mapped[str] = mapped_column(String(100), index=True)
    old_value: Mapped[dict] = mapped_column(JSON, default=dict)
    new_value: Mapped[dict] = mapped_column(JSON, default=dict)
    ip: Mapped[str | None] = mapped_column(String(45))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)


class Case(Base):
    __tablename__ = "cases"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    transaction_id: Mapped[str] = mapped_column(ForeignKey("transactions.id"), unique=True)
    status: Mapped[str] = mapped_column(String(30), default="OPEN", index=True)
    assigned_to: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    notes: Mapped[list] = mapped_column(JSON, default=list)
    version: Mapped[int] = mapped_column(default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __mapper_args__ = {"version_id_col": version}


class Outbox(Base):
    __tablename__ = "notification_outbox"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    transaction_id: Mapped[str] = mapped_column(ForeignKey("transactions.id"), unique=True)
    payload: Mapped[dict] = mapped_column(JSON)
    provider: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), default="PENDING", index=True)
    attempts: Mapped[int] = mapped_column(default=0)
    last_error: Mapped[str | None] = mapped_column(String(300))
    provider_message_id: Mapped[str | None] = mapped_column(String(256))
    available_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

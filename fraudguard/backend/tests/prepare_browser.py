"""Prepare labeled synthetic fixtures for browser checks against a development server."""

import json
import secrets
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import uuid4

from sqlalchemy import select

from app.auth import hasher
from app.config import settings
from app.database import SessionLocal
from app.models import User
from app.schemas import TransactionIn
from app.services.transactions import ingest

if settings().app_env != "development":
    raise SystemExit("Browser fixtures may only be created in development")

run = uuid4().hex[:8]
password = secrets.token_urlsafe(24)
with SessionLocal() as db:
    user = db.scalar(select(User).where(User.email == "browser-test@fraudguard.local"))
    if not user:
        user = User(
            email="browser-test@fraudguard.local",
            name="Browser Test",
            role="admin",
            password_hash=hasher.hash(password),
        )
        db.add(user)
    else:
        user.password_hash = hasher.hash(password)
    for i in range(6):
        data = TransactionIn(
            id=f"E2E-{run}-{i}",
            customer_id=f"E2E-C-{run}",
            merchant_id="E2E-MERCHANT",
            amount=85000 if i == 5 else 2000,
            timestamp=datetime(2025, 6, 1, 10, tzinfo=UTC) + timedelta(minutes=i),
            latitude=51.5074 if i == 5 else 13.0827,
            longitude=-0.1278 if i == 5 else 80.2707,
        )
        ingest(db, data, "browser-test", "synthetic", "combined" if i == 5 else "normal")
    db.commit()
path = Path("../.runtime/e2e.json")
path.parent.mkdir(exist_ok=True)
path.write_text(json.dumps({"email": user.email, "password": password, "transaction_id": data.id}))
path.chmod(0o600)
print("Prepared synthetic browser fixtures")

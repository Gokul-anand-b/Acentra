import random
from datetime import datetime, timezone, timedelta
try:
    from datetime import UTC
except ImportError:
    UTC = timezone.utc

from app.models import Transaction
from app.schemas import TransactionIn
from app.services.transactions import ingest


def generate(db, count=500, seed=42):
    rng = random.Random(seed)
    start = datetime(2025, 1, 1, 8, tzinfo=UTC)
    inserted = 0
    for i in range(count):
        # Each block establishes a baseline, then a burst and combined risk event.
        block, step = divmod(i, 20)
        customer = f"C-{seed}-{block:04d}"
        suspicious = step >= 15
        combined = step == 19
        timestamp = start + timedelta(hours=block * 2, minutes=step * 5 if step < 15 else 70 + step - 14)
        transaction = TransactionIn(
            id=f"DEMO-{seed}-{i:06d}",
            customer_id=customer,
            merchant_id="M-ELECTRONICS"
            if suspicious
            else rng.choice(["M-GROCER", "M-CAFE", "M-TRANSIT", "M-BOOKS"]),
            device_id="D-SHARED" if suspicious else f"D-{customer}",
            amount=round(rng.uniform(80000, 100000), 2) if combined else round(rng.uniform(1200, 2200), 2),
            timestamp=timestamp,
            latitude=51.5074 if combined else 13.0827,
            longitude=-0.1278 if combined else 80.2707,
            ip_address=f"192.0.2.{block % 250 + 1}",
            fraud_label=combined,
        )
        if db.get(Transaction, transaction.id):
            continue
        ingest(
            db,
            transaction,
            "demo-generator",
            "synthetic",
            "combined" if combined else "burst" if suspicious else "normal",
        )
        inserted += 1
        if i % 100 == 99:
            db.commit()
    db.commit()
    return {"inserted": inserted, "source": "Demo / Synthetic Data", "seed": seed}

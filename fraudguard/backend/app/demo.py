import random
from datetime import datetime, timezone, timedelta
try:
    from datetime import UTC
except ImportError:
    UTC = timezone.utc

from sqlalchemy import delete
from app.models import Transaction, Assessment, Audit, Case, Outbox
from app.schemas import TransactionIn
from app.services.transactions import ingest


REAL_CUSTOMERS = [
    "C12382",
    "C44812",
    "C99104",
    "C55210",
    "C77291",
    "C88349",
    "C11029",
    "C33941",
    "C66520",
    "C22108",
]

REAL_MERCHANTS = [
    "M-Apple-Store",
    "Binance-Crypto-Exchange",
    "Amazon-Web-Services",
    "Stripe-Payments",
    "Delta-Air-Lines",
    "Nordstrom-NYC",
    "Uber-Technologies",
    "Sephora-Beauty",
]


def generate(db, count=20, seed=42):
    rng = random.Random(seed)
    start = datetime(2026, 9, 30, 10, 0, tzinfo=UTC)

    # 1. Clear old dummy data (DEMO-42-*) to keep database clean
    try:
        db.execute(delete(Outbox))
        db.execute(delete(Audit))
        db.execute(delete(Case))
        db.execute(delete(Assessment))
        db.execute(delete(Transaction))
        db.commit()
    except Exception:
        db.rollback()

    inserted = 0

    # 2. Sample 1: Genuine / Safe Baseline Case (TX-3514030)
    genuine_tx = TransactionIn(
        id="3514030",
        customer_id="C12382",
        merchant_id="M-Apple-Store",
        amount=77.07,
        currency="USD",
        timestamp=start - timedelta(hours=2),
        device_id="Card-3514030",
        ip_address="198.51.100.12",
        latitude=40.7128,
        longitude=-74.0060,
        fraud_label=False,
    )
    ingest(db, genuine_tx, "demo-generator", "synthetic", "genuine_baseline")
    inserted += 1

    # 3. Sample 2: High Risk Fraud Alert Sample (TXN-HHG-001) - Triggers email notification to gokulakrishnankadhirvelu@gmail.com
    risk_tx = TransactionIn(
        id="TXN-HHG-001",
        customer_id="C12382",
        merchant_id="Binance-Crypto-Exchange",
        amount=444.00,
        currency="USD",
        timestamp=start,
        device_id="Card-21139",
        ip_address="198.51.100.250",
        latitude=48.8566, # Paris, France (Impossible travel from NY)
        longitude=2.3522,
        fraud_label=True,
    )
    ingest(db, risk_tx, "demo-generator", "synthetic", "impossible_travel_burst")
    inserted += 1

    # 4. Generate 18 additional clean, realistic cases (HHG-002 through HHG-019)
    for i in range(2, count):
        cust = REAL_CUSTOMERS[i % len(REAL_CUSTOMERS)]
        merch = rng.choice(REAL_MERCHANTS)
        suspicious = i in [3, 7, 12, 16]
        
        amount = round(rng.uniform(1200.0, 4800.0), 2) if suspicious else round(rng.uniform(45.0, 320.0), 2)
        dev = f"Card-{rng.randint(10000, 99999)}"
        timestamp = start - timedelta(minutes=i * 30)

        tx = TransactionIn(
            id=f"HHG-{i:03d}",
            customer_id=cust,
            merchant_id=merch,
            amount=amount,
            currency="USD",
            timestamp=timestamp,
            device_id=dev,
            ip_address=f"198.51.100.{i + 10}",
            latitude=40.7128 if not suspicious else 51.5074,
            longitude=-74.0060 if not suspicious else -0.1278,
            fraud_label=suspicious,
        )
        ingest(
            db,
            tx,
            "demo-generator",
            "synthetic",
            "high_risk_burst" if suspicious else "normal_baseline",
        )
        inserted += 1

    db.commit()
    return {
        "inserted": inserted,
        "genuine_sample": "3514030",
        "risk_sample": "TXN-HHG-001",
        "target_notification_email": "gokulakrishnankadhirvelu@gmail.com",
        "total_cases": count,
        "source": "Clean 20-Case Demo Dataset",
    }

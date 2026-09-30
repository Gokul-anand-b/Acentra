import random
from datetime import datetime, timezone, timedelta
try:
    from datetime import UTC
except ImportError:
    UTC = timezone.utc

from app.models import Transaction
from app.schemas import TransactionIn
from app.services.transactions import ingest


REAL_CUSTOMERS = [
    "CUST-ALICE-VANCE",
    "CUST-MARCUS-CHEN",
    "CUST-SARAH-CONNOR",
    "CUST-ELENA-ROSTOVA",
    "CUST-GLOBAL-TECH-CORP",
    "CUST-DAVID-KIM",
    "CUST-PRIYA-SHARMA",
    "CUST-LIAM-O-CONNOR",
    "CUST-HIKARI-TANAKA",
    "CUST-VICTOR-DUBOIS",
]

REAL_MERCHANTS = [
    "Amazon Web Services",
    "Stripe Billing",
    "Apple Store Fifth Ave",
    "Binance Crypto Exchange",
    "Delta Air Lines",
    "Nordstrom NYC",
    "Uber Technologies",
    "Starbucks Coffee",
    "Sephora Beauty",
    "Coinbase Global",
]

REAL_LOCATIONS = [
    (40.7128, -74.0060, "New York, USA", "198.51.100.12"),
    (51.5074, -0.1278, "London, UK", "198.51.100.45"),
    (35.6762, 139.6503, "Tokyo, Japan", "203.0.113.88"),
    (1.3521, 103.8198, "Singapore", "203.0.113.102"),
    (13.0827, 80.2707, "Chennai, India", "106.51.22.15"),
]


def generate(db, count=20, seed=42):
    rng = random.Random(seed)
    start = datetime(2026, 9, 30, 10, 0, tzinfo=UTC)
    inserted = 0

    # 1. First, create the 1 Primary Pitch Sample Input Case (TX-PITCH-DEMO-01)
    pitch_tx = TransactionIn(
        id="TX-PITCH-DEMO-01",
        customer_id="CUST-ALICE-VANCE",
        merchant_id="Binance Crypto Exchange",
        amount=8500.00,
        currency="USD",
        timestamp=start,
        device_id="DEV-SHARED-PROXY-99",
        ip_address="198.51.100.250",
        latitude=48.8566, # Paris, France (Impossible travel from NY)
        longitude=2.3522,
        fraud_label=True,
    )
    if not db.get(Transaction, pitch_tx.id):
        ingest(db, pitch_tx, "pitch-demo", "synthetic", "impossible_travel_spikes")
        inserted += 1

    # 2. Next, generate 19 highly realistic investigation cases
    for i in range(1, count):
        cust = rng.choice(REAL_CUSTOMERS)
        merch = rng.choice(REAL_MERCHANTS)
        lat, lon, loc_name, ip = rng.choice(REAL_LOCATIONS)
        suspicious = i in [3, 7, 12, 15, 18]
        
        amount = round(rng.uniform(4500.0, 9200.0), 2) if suspicious else round(rng.uniform(25.0, 480.0), 2)
        dev = "DEV-SHARED-PROXY-99" if suspicious else f"DEV-IPHONE-{cust.split('-')[1]}"
        timestamp = start - timedelta(minutes=i * 25)

        tx = TransactionIn(
            id=f"TX-REAL-2026-{i:03d}",
            customer_id=cust,
            merchant_id=merch,
            amount=amount,
            currency="USD",
            timestamp=timestamp,
            device_id=dev,
            ip_address=ip,
            latitude=lat,
            longitude=lon,
            fraud_label=suspicious,
        )
        if not db.get(Transaction, tx.id):
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
        "pitch_case_id": "TX-PITCH-DEMO-01",
        "total_cases": count,
        "source": "Realistic Demo Dataset",
    }

from datetime import datetime, timezone, timedelta
try:
    from datetime import UTC
except ImportError:
    UTC = timezone.utc
from types import SimpleNamespace

import pytest
from sqlalchemy import func, select

from app.models import Assessment, Outbox, RuleConfig
from app.rules.base import FraudRule
from app.rules.geo import haversine
from app.rules.registry import _registry, register
from app.schemas import TransactionIn
from app.services.engine import evaluate, rule_catalog
from app.services.transactions import ingest

START = datetime(2025, 1, 1, 10, tzinfo=UTC)


def tx(i=0, **overrides):
    return TransactionIn.model_validate(
        dict(
            id=f"T-{i}",
            customer_id="C-1",
            merchant_id="M-1",
            amount=2000,
            currency="INR",
            timestamp=START + timedelta(minutes=i),
            latitude=13.0827,
            longitude=80.2707,
            device_id="D-1",
        )
        | overrides
    )


def test_normal_cold_start_is_explicit(db):
    row = ingest(db, tx())
    assessment = db.get(Assessment, row.id)
    assert assessment.risk_level == "LOW"
    assert not assessment.flagged
    assert next(r for r in assessment.rules if r["rule_name"] == "unusual_amount")["status"] == "unavailable"


def test_three_rules_combined_create_durable_notification(db):
    for i in range(5):
        ingest(db, tx(i))
    row = ingest(db, tx(5, amount=85000, latitude=51.5074, longitude=-0.1278))
    db.commit()
    assessment = db.get(Assessment, row.id)
    assert assessment.raw_score == 95
    assert assessment.normalized_score == 95
    assert assessment.risk_level == "CRITICAL"
    assert len([r for r in assessment.rules if r["triggered"]]) == 3
    assert db.scalar(select(func.count()).select_from(Outbox)) == 1


def test_velocity_boundary(db):
    for i in range(5):
        row = ingest(db, tx(i))
    assert not db.get(Assessment, row.id).flagged
    row = ingest(db, tx(5))
    assert next(r for r in db.get(Assessment, row.id).rules if r["rule_name"] == "transaction_velocity")[
        "triggered"
    ]


def test_amount_and_currency_isolation(db):
    for i in range(5):
        ingest(db, tx(i, timestamp=START + timedelta(hours=i)))
    row = ingest(db, tx(6, timestamp=START + timedelta(hours=6), amount=25000))
    assert db.get(Assessment, row.id).raw_score == 30
    other = ingest(db, tx(7, timestamp=START + timedelta(hours=7), amount=500000, currency="USD"))
    assert (
        next(r for r in db.get(Assessment, other.id).rules if r["rule_name"] == "unusual_amount")["status"]
        == "unavailable"
    )


def test_out_of_order_excludes_future_history(db):
    for i in range(5):
        ingest(db, tx(i, timestamp=START + timedelta(days=10, minutes=i)))
    older = ingest(db, tx(20, timestamp=START, amount=100000, latitude=51.5074, longitude=-0.1278))
    assessment = db.get(Assessment, older.id)
    assert assessment.raw_score == 0
    assert assessment.behavior["history_count"] == 0


def test_equal_timestamps_and_missing_location(db):
    ingest(db, tx())
    row = ingest(db, tx(1, timestamp=START, latitude=51.5074, longitude=-0.1278))
    geo = next(r for r in db.get(Assessment, row.id).rules if r["rule_name"] == "impossible_travel")
    assert geo["triggered"] and geo["evidence"]["speed_kmh"] is None
    assert geo["evidence"]["simultaneous_locations"]
    row = ingest(db, tx(2, latitude=None, longitude=None))
    assert (
        next(r for r in db.get(Assessment, row.id).rules if r["rule_name"] == "impossible_travel")["status"]
        == "unavailable"
    )


def test_haversine():
    assert haversine(0, 0, 0, 0) == 0
    assert haversine(0, 0, 0, 1) == pytest.approx(111.195, rel=0.001)
    assert 8100 < haversine(13.0827, 80.2707, 51.5074, -0.1278) < 8300


def test_new_plugin_without_engine_changes_and_capping(db):
    @register
    class TestRule(FraudRule):
        name = "test_plugin"
        title = "Test"
        description = "Test plugin"
        defaults = {"score": 100}
        bounds = {"score": (0, 100)}

        def evaluate(self, transaction, context):
            return self.result(True, "Known test signal", {})

    try:
        for i in range(6):
            row = ingest(db, tx(i))
        result = db.get(Assessment, row.id)
        assert result.raw_score == 125 and result.normalized_score == 100
    finally:
        _registry.pop("test_plugin")


def test_rule_failure_cannot_look_like_clean_evaluation(db, monkeypatch):
    from app.rules.velocity import VelocityRule

    monkeypatch.setattr(VelocityRule, "evaluate", lambda *args: 1 / 0)
    row = ingest(db, tx())
    result = db.get(Assessment, row.id)
    assert not result.complete and result.flagged and row.status == "PENDING"


def test_all_rules_disabled_requires_review(db):
    for cls, _ in rule_catalog(db):
        db.add(RuleConfig(name=cls.name, parameters=cls.defaults, enabled=False))
    db.flush()
    result = evaluate(db, SimpleNamespace(**tx().model_dump()))
    assert result["flagged"] and not result["complete"]


def test_shared_device_distinct_customers(db):
    for i in range(3):
        row = ingest(db, tx(i, customer_id=f"C-{i}"))
    assert next(r for r in db.get(Assessment, row.id).rules if r["rule_name"] == "shared_device")["triggered"]


@pytest.mark.parametrize(
    "change",
    [
        {"amount": -1},
        {"amount": "NaN"},
        {"latitude": 91},
        {"longitude": None},
        {"timestamp": "2025-01-01T10:00:00"},
        {"timestamp": "2099-01-01T00:00:00Z"},
        {"ip_address": "not-an-ip"},
        {"amount": "1.123"},
    ],
)
def test_validation(change):
    with pytest.raises(ValueError):
        tx(**change)

import logging
from datetime import timedelta
from statistics import mean, median, pstdev

from sqlalchemy import func, select

from app.config import settings
from app.ml.runtime import predict
from app.models import RuleConfig, Transaction
from app.rules.base import RuleResult
from app.rules.registry import discover

logger = logging.getLogger(__name__)


def rule_catalog(db):
    registry = discover(settings().rule_modules)
    configs = {c.name: c for c in db.scalars(select(RuleConfig))}
    return [(cls, configs.get(name)) for name, cls in registry.items()]


def evaluate(db, transaction):
    catalog = rule_catalog(db)
    enabled = [
        (cls(config.parameters if config else None), config)
        for cls, config in catalog
        if config is None or config.enabled
    ]
    prior = (
        Transaction.customer_id == transaction.customer_id,
        Transaction.timestamp <= transaction.timestamp,
        Transaction.id != transaction.id,
    )
    history = list(
        db.scalars(
            select(Transaction)
            .where(*prior)
            .order_by(Transaction.timestamp.desc(), Transaction.id)
            .limit(200)
        )
    )
    previous = db.scalar(
        select(Transaction)
        .where(*prior, Transaction.latitude.is_not(None))
        .order_by(Transaction.timestamp.desc(), Transaction.id)
        .limit(1)
    )
    windows = {
        rule.parameters["window_minutes"] for rule, _ in enabled if "window_minutes" in rule.parameters
    }
    velocity_counts = {
        window: db.scalar(
            select(func.count())
            .select_from(Transaction)
            .where(*prior, Transaction.timestamp >= transaction.timestamp - timedelta(minutes=window))
        )
        for window in windows
    }
    device_customers = (
        set(
            db.scalars(
                select(Transaction.customer_id)
                .where(
                    Transaction.device_id == transaction.device_id,
                    Transaction.timestamp <= transaction.timestamp,
                    Transaction.id != transaction.id,
                )
                .distinct()
            )
        )
        if transaction.device_id
        else set()
    )
    device_customers.add(transaction.customer_id)
    context = {
        "history": history,
        "previous_location": previous,
        "velocity_counts": velocity_counts,
        "shared_device_customers": len(device_customers),
    }
    results = []
    complete = True
    for rule, config in enabled:
        try:
            result = rule.evaluate(transaction, context).dict()
        except Exception:
            logger.exception("Rule evaluation failed: %s", rule.name)
            result = RuleResult(
                rule.name, reason="Rule failed; manual review required", status="error"
            ).dict()
            complete = False
        result["configuration"] = rule.parameters
        result["configuration_version"] = config.version if config else 1
        results.append(result)
    if not enabled:
        complete = False
    raw = sum(r["score"] for r in results)
    score = min(100, raw)
    level = (
        "CRITICAL"
        if score >= settings().critical_risk_threshold
        else "HIGH"
        if score >= settings().high_risk_threshold
        else "MEDIUM"
        if score >= 30
        else "LOW"
    )
    amounts = [float(t.amount) for t in history if t.currency == transaction.currency]
    behavior = {
        "history_count": len(amounts),
        "currency": transaction.currency,
        "average": mean(amounts) if amounts else None,
        "median": median(amounts) if amounts else None,
        "standard_deviation": pstdev(amounts) if amounts else None,
        "unique_merchants": len({t.merchant_id for t in history}),
        "unique_devices": len({t.device_id for t in history if t.device_id}),
        "history_limit": 200,
    }
    recent_count = db.scalar(
        select(func.count())
        .select_from(Transaction)
        .where(*prior, Transaction.timestamp >= transaction.timestamp - timedelta(minutes=10))
    )
    ml = predict(transaction, history, recent_count)
    return {
        "raw_score": raw,
        "normalized_score": score,
        "risk_level": level,
        "flagged": any(r["triggered"] for r in results) or not complete,
        "complete": complete,
        "rules": results,
        "behavior": behavior,
        "graph": {
            "shared_device_customers": len(device_customers) if transaction.device_id else None,
            "as_of": transaction.timestamp.isoformat(),
        },
        "scoring": {
            "method": "capped_sum_of_rule_scores",
            "rule_score": score,
            "behavior": "context_only",
            "graph": "shared_device_rule",
            "ml": ml,
            "gnn_score": None,
            "gnn_status": "unavailable: no trained model",
            "note": "Risk is a review priority, not a fraud probability.",
        },
    }

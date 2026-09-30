from math import cos, log1p, pi, sin
from statistics import mean, median, pstdev

from app.rules.geo import utc

FEATURE_NAMES = [
    "log_amount",
    "hour_sin",
    "hour_cos",
    "weekday",
    "history_count",
    "log_average",
    "log_median",
    "log_std",
    "amount_to_median",
    "recent_transactions",
]
FEATURE_VERSION = "behavior-v1"


def features(transaction, history, recent_count):
    amounts = [float(t.amount) for t in history if t.currency == transaction.currency]
    amount = float(transaction.amount)
    timestamp = utc(transaction.timestamp)
    hour = timestamp.hour + timestamp.minute / 60
    med = median(amounts) if amounts else amount
    return [
        log1p(amount),
        sin(2 * pi * hour / 24),
        cos(2 * pi * hour / 24),
        timestamp.weekday(),
        len(amounts),
        log1p(mean(amounts)) if amounts else log1p(amount),
        log1p(med),
        log1p(pstdev(amounts)) if amounts else 0,
        min(amount / max(med, 0.01), 1000),
        recent_count + 1,
    ]

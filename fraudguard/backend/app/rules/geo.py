from datetime import UTC
from math import asin, cos, radians, sin, sqrt

from app.rules.base import FraudRule
from app.rules.registry import register


def utc(value):
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def haversine(a, b, c, d):
    a, b, c, d = map(radians, (a, b, c, d))
    h = sin((c - a) / 2) ** 2 + cos(a) * cos(c) * sin((d - b) / 2) ** 2
    return 6371.0088 * 2 * asin(sqrt(min(1, max(0, h))))


@register
class GeoRule(FraudRule):
    name = "impossible_travel"
    title = "Impossible travel"
    description = "Haversine travel speed between observed transaction coordinates."
    defaults = {"speed_kmh": 900, "min_distance_km": 50, "score": 40}
    bounds = {"speed_kmh": (100, 3000), "min_distance_km": (1, 1000), "score": (0, 100)}

    def evaluate(self, transaction, context):
        previous = context["previous_location"]
        if transaction.latitude is None or previous is None:
            return self.result(False, "Location history unavailable", {}, "unavailable")
        distance = haversine(
            previous.latitude, previous.longitude, transaction.latitude, transaction.longitude
        )
        minutes = (utc(transaction.timestamp) - utc(previous.timestamp)).total_seconds() / 60
        speed = distance / (minutes / 60) if minutes > 0 else None
        triggered = distance > self.parameters["min_distance_km"] and (
            speed is None or speed > self.parameters["speed_kmh"]
        )
        return self.result(
            triggered,
            f"{distance:,.0f} km between transactions {minutes:.1f} minutes apart",
            {
                "distance_km": distance,
                "elapsed_minutes": minutes,
                "speed_kmh": speed,
                "simultaneous_locations": minutes == 0,
                "threshold_kmh": self.parameters["speed_kmh"],
                "previous_transaction": previous.id,
                "current_transaction": transaction.id,
            },
        )

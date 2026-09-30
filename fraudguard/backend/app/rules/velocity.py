from app.rules.base import FraudRule
from app.rules.registry import register


@register
class VelocityRule(FraudRule):
    name = "transaction_velocity"
    title = "Transaction velocity"
    description = "Rapid transactions from the same customer, including this event."
    defaults = {"window_minutes": 10, "threshold": 5, "score": 25}
    bounds = {"window_minutes": (1, 1440), "threshold": (1, 1000), "score": (0, 100)}

    def evaluate(self, transaction, context):
        count = context["velocity_counts"][self.parameters["window_minutes"]] + 1
        return self.result(
            count > self.parameters["threshold"],
            f"{count} transactions within {self.parameters['window_minutes']:g} minutes",
            {"transaction_count": count, **self.parameters},
        )

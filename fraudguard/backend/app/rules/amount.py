from statistics import mean, median, pstdev

from app.rules.base import FraudRule
from app.rules.registry import register


@register
class AmountRule(FraudRule):
    name = "unusual_amount"
    title = "Unusual amount"
    description = "Compare same-currency spending with the last 200 prior transactions."
    defaults = {"multiplier": 5, "min_history": 5, "score": 30}
    bounds = {"multiplier": (1.1, 100), "min_history": (2, 200), "score": (0, 100)}

    def evaluate(self, transaction, context):
        values = [float(t.amount) for t in context["history"] if t.currency == transaction.currency]
        if len(values) < self.parameters["min_history"]:
            return self.result(
                False, "Insufficient same-currency history", {"history_count": len(values)}, "unavailable"
            )
        avg, med, std = mean(values), median(values), pstdev(values)
        amount = float(transaction.amount)
        mad = median([abs(v - med) for v in values])
        multiplier = amount / med
        triggered = amount > med * self.parameters["multiplier"] and (
            mad == 0 or (amount - med) / (1.4826 * mad) > 3.5
        )
        return self.result(
            triggered,
            f"{amount:,.2f} {transaction.currency} is {multiplier:.1f}× the historical median",
            {
                "historical_average": avg,
                "median": med,
                "standard_deviation": std,
                "mad": mad,
                "percentile": 100 * sum(v <= amount for v in values) / len(values),
                "multiplier": multiplier,
                "history_count": len(values),
                "threshold": self.parameters["multiplier"],
            },
        )

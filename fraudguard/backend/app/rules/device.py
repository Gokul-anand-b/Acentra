from app.rules.base import FraudRule
from app.rules.registry import register


@register
class DeviceRule(FraudRule):
    name = "shared_device"
    title = "Shared device"
    description = "A device observed across many distinct customer identities."
    defaults = {"customer_threshold": 3, "score": 20}
    bounds = {"customer_threshold": (2, 100), "score": (0, 100)}

    def evaluate(self, transaction, context):
        if not transaction.device_id:
            return self.result(False, "Device identifier unavailable", {}, "unavailable")
        count = context["shared_device_customers"]
        return self.result(
            count >= self.parameters["customer_threshold"],
            f"Device shared by {count} customers",
            {"customer_count": count, **self.parameters},
        )

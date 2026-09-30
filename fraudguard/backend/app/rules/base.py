from abc import ABC, abstractmethod
from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass
class RuleResult:
    rule_name: str
    triggered: bool = False
    score: float = 0
    severity: str = "LOW"
    reason: str = "No risk signal"
    evidence: dict[str, Any] = field(default_factory=dict)
    status: str = "evaluated"

    def dict(self):
        return asdict(self)


class FraudRule(ABC):
    name: str
    title: str
    description: str
    defaults: dict[str, float]
    bounds: dict[str, tuple[float, float]]

    def __init__(self, parameters=None):
        self.parameters = self.defaults | (parameters or {})
        if set(self.parameters) != set(self.defaults):
            raise ValueError("Unknown rule parameter")
        for key, value in self.parameters.items():
            low, high = self.bounds[key]
            if not low <= value <= high:
                raise ValueError(f"{key} must be between {low} and {high}")

    @abstractmethod
    def evaluate(self, transaction, context) -> RuleResult: ...

    def result(self, triggered, reason, evidence, status="evaluated"):
        return RuleResult(
            self.name,
            triggered,
            self.parameters["score"] if triggered else 0,
            "HIGH" if triggered else "LOW",
            reason,
            evidence,
            status,
        )

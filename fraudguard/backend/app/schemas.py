from datetime import UTC, datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, IPvAnyAddress, field_validator, model_validator

Identifier = Annotated[str, Field(min_length=1, max_length=100, pattern=r"^[a-zA-Z0-9_.:@-]+$")]


class TransactionIn(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    id: Identifier
    customer_id: Identifier
    merchant_id: Identifier
    amount: Decimal = Field(gt=0, max_digits=18, decimal_places=2, allow_inf_nan=False)
    currency: str = Field(default="INR", pattern=r"^[A-Z]{3}$")
    timestamp: datetime
    latitude: float | None = Field(default=None, ge=-90, le=90, allow_inf_nan=False)
    longitude: float | None = Field(default=None, ge=-180, le=180, allow_inf_nan=False)
    device_id: Identifier | None = None
    ip_address: IPvAnyAddress | None = None
    card_id: Identifier | None = None
    fraud_label: bool | None = None

    @field_validator("timestamp")
    @classmethod
    def aware(cls, value):
        if value.tzinfo is None:
            raise ValueError("timestamp must include a timezone, e.g. +05:30 or Z")
        if value > datetime.now(UTC):
            raise ValueError("future timestamps are not accepted")
        return value.astimezone(UTC)

    @model_validator(mode="after")
    def coordinates(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("latitude and longitude must both be present or both omitted")
        return self


class ReviewIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    version: int = Field(ge=1)
    reason: str = Field(min_length=3, max_length=2000)


class RuleUpdate(BaseModel):
    version: int = Field(ge=1)
    enabled: bool
    parameters: dict[str, float]


class CaseUpdate(BaseModel):
    version: int = Field(ge=1)
    status: Literal["OPEN", "INVESTIGATING", "PENDING_REVIEW", "CLOSED"]
    assigned_to: str | None = None
    note: str = Field(default="", max_length=2000)

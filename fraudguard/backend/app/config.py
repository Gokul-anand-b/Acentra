from functools import lru_cache
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    app_env: Literal["development", "test", "production"] = "development"
    database_url: str = "sqlite:///./fraudguard.db"
    jwt_secret: str = Field(min_length=32)
    jwt_expiration_minutes: int = Field(default=60, ge=1, le=1440)
    notification_provider: Literal["console", "sns", "ses"] = "console"
    aws_region: str = "ap-south-1"
    aws_sns_topic_arn: str = ""
    aws_ses_from_email: str = ""
    aws_ses_to_email: str = ""
    ml_model_dir: str = "../models"
    high_risk_threshold: int = Field(default=60, ge=30, le=99)
    critical_risk_threshold: int = Field(default=80, ge=31, le=100)
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    rule_modules: list[str] = ["app.rules.velocity", "app.rules.amount", "app.rules.geo", "app.rules.device"]

    @model_validator(mode="after")
    def validate_config(self):
        if self.critical_risk_threshold <= self.high_risk_threshold:
            raise ValueError("Critical threshold must exceed high threshold")
        if self.app_env == "production" and not self.database_url.startswith("postgresql"):
            raise ValueError("Production requires PostgreSQL")
        if self.notification_provider == "sns" and not self.aws_sns_topic_arn:
            raise ValueError("SNS requires AWS_SNS_TOPIC_ARN")
        if self.notification_provider == "ses" and not (self.aws_ses_from_email and self.aws_ses_to_email):
            raise ValueError("SES requires sender and recipient")
        return self


@lru_cache
def settings():
    return Settings()

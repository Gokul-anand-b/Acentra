from datetime import datetime, timezone, timedelta
try:
    from datetime import UTC
except ImportError:
    UTC = timezone.utc
from typing import Annotated

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User

hasher = PasswordHasher()
bearer = HTTPBearer(auto_error=False)
Db = Annotated[Session, Depends(get_db)]


def issue_token(user):
    return jwt.encode(
        {
            "sub": user.id,
            "exp": datetime.now(UTC) + timedelta(minutes=settings().jwt_expiration_minutes),
            "iss": "fraudguard",
            "aud": "review-console",
        },
        settings().jwt_secret,
        algorithm="HS256",
    )


def verify_password(encoded, password):
    try:
        return hasher.verify(encoded, password)
    except (VerificationError, InvalidHashError):
        return False


def current_user(db: Db, credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]):
    try:
        if not credentials:
            raise ValueError()
        claims = jwt.decode(
            credentials.credentials,
            settings().jwt_secret,
            algorithms=["HS256"],
            issuer="fraudguard",
            audience="review-console",
            options={"require": ["exp", "sub"]},
        )
        user = db.get(User, claims["sub"])
        if not user or not user.active:
            raise ValueError()
        return user
    except (jwt.PyJWTError, ValueError):
        raise HTTPException(401, "Authentication required")


Actor = Annotated[User, Depends(current_user)]


def administrator(user: Actor):
    if user.role != "admin":
        raise HTTPException(403, "Administrator access required")
    return user


Admin = Annotated[User, Depends(administrator)]

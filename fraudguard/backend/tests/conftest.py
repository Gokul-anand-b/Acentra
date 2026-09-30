import os

os.environ["JWT_SECRET"] = "test-only-secret-with-more-than-32-characters"
os.environ["APP_ENV"] = "test"
os.environ["ML_MODEL_DIR"] = "./tests/no-trained-model"
os.environ["NOTIFICATION_PROVIDER"] = "console"
os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL", "sqlite://")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api import login_attempts
from app.auth import hasher, issue_token
from app.database import Base, get_db
from app.main import app
from app.models import User


@pytest.fixture
def db():
    url = os.environ["DATABASE_URL"]
    kwargs = (
        {"poolclass": StaticPool, "connect_args": {"check_same_thread": False}} if url == "sqlite://" else {}
    )
    if url != "sqlite://" and not url.endswith("_test"):
        raise ValueError("TEST_DATABASE_URL must reference a disposable database ending in _test")
    engine = create_engine(url, **kwargs)
    Base.metadata.create_all(engine)
    with sessionmaker(engine, expire_on_commit=False)() as session:
        yield session
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture
def users(db):
    admin = User(
        email="admin@example.test",
        name="Admin",
        role="admin",
        password_hash=hasher.hash("Testing-password-123"),
    )
    reviewer = User(
        email="reviewer@example.test",
        name="Reviewer",
        role="reviewer",
        password_hash=hasher.hash("Testing-password-123"),
    )
    db.add_all([admin, reviewer])
    db.commit()
    return admin, reviewer


@pytest.fixture
def client(db, users):
    app.dependency_overrides[get_db] = lambda: db
    login_attempts.clear()
    with TestClient(app) as client:
        client.headers["Authorization"] = "Bearer " + issue_token(users[0])
        yield client
    app.dependency_overrides.clear()

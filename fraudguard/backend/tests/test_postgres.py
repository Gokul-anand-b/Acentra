from concurrent.futures import ThreadPoolExecutor

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Assessment, Outbox, Transaction
from app.services.transactions import ingest
from tests.test_engine import START, tx


def require_postgres(db):
    if db.bind.dialect.name != "postgresql":
        pytest.skip("PostgreSQL-specific concurrency semantics")


def test_concurrent_customer_ingestion_is_serialized(db):
    require_postgres(db)

    def submit(i):
        with Session(db.bind) as session:
            ingest(session, tx(i, timestamp=START))
            session.commit()

    with ThreadPoolExecutor(max_workers=6) as pool:
        list(pool.map(submit, range(6)))
    assert db.scalar(select(func.count()).select_from(Transaction)) == 6
    assessments = list(db.scalars(select(Assessment)))
    assert sum(a.flagged for a in assessments) == 1
    assert max(a.raw_score for a in assessments) == 25


def test_outbox_workers_skip_claimed_rows(db):
    require_postgres(db)
    for i in range(5):
        ingest(db, tx(i))
    ingest(db, tx(5, amount=85000, latitude=51.5074, longitude=-0.1278))
    db.commit()
    with Session(db.bind) as first, Session(db.bind) as second:
        claimed = first.scalar(select(Outbox).with_for_update(skip_locked=True))
        assert claimed
        assert second.scalar(select(Outbox).with_for_update(skip_locked=True)) is None

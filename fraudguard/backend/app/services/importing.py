from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError

from app.schemas import TransactionIn
from app.services.transactions import ingest


def import_rows(db, rows, actor, mapping=None, source="import"):
    report = {
        "rows_received": len(rows),
        "inserted": 0,
        "duplicates": 0,
        "invalid": 0,
        "errors": [],
        "processed": 0,
    }
    valid = []
    for number, row in enumerate(rows, 1):
        try:
            normalized = {target: row.get(column) for target, column in mapping.items()} if mapping else row
            normalized = {k: v for k, v in normalized.items() if v != ""}
            valid.append((number, TransactionIn.model_validate(normalized)))
        except (ValidationError, AttributeError) as error:
            report["invalid"] += 1
            report["errors"].append({"row": number, "error": str(error)[:500]})
    # Event-time ordering within each import; each row has a savepoint.
    for number, data in sorted(valid, key=lambda item: (item[1].timestamp, item[0])):
        try:
            with db.begin_nested():
                ingest(db, data, actor, source)
            report["inserted"] += 1
        except HTTPException as error:
            if error.status_code != 409:
                raise
            report["duplicates"] += 1
        except IntegrityError:
            # Concurrent duplicate submissions are rejected by the database unique key.
            report["duplicates"] += 1
    report["processed"] = report["inserted"]
    db.commit()
    return report

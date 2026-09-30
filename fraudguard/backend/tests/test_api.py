import json

from sqlalchemy import func, select

from app.auth import issue_token
from app.models import Audit, Outbox, Transaction
from tests.test_engine import tx


def payload(i=0, **kwargs):
    return tx(i, **kwargs).model_dump(mode="json")


def test_authentication_and_roles(client, users):
    client.headers.pop("Authorization")
    assert client.get("/api/transactions").status_code == 401
    result = client.post(
        "/api/auth/login", json={"email": "reviewer@example.test", "password": "Testing-password-123"}
    )
    assert result.status_code == 200
    client.headers["Authorization"] = "Bearer " + result.json()["access_token"]
    assert client.get("/api/transactions").status_code == 200
    assert client.post("/api/transactions", json=payload()).status_code == 403
    assert (
        client.put(
            "/api/rules/unusual_amount", json={"version": 1, "enabled": False, "parameters": {}}
        ).status_code
        == 403
    )


def test_bad_password_and_rate_limit(client):
    for i in range(10):
        assert (
            client.post(
                "/api/auth/login", json={"email": "admin@example.test", "password": "bad"}
            ).status_code
            == 401
        )
    assert (
        client.post("/api/auth/login", json={"email": "admin@example.test", "password": "bad"}).status_code
        == 429
    )


def test_ingest_review_clear_audit_and_duplicate(client, db, users):
    for i in range(6):
        result = client.post(
            "/api/transactions",
            json=payload(
                i,
                amount=85000 if i == 5 else 2000,
                latitude=51.5074 if i == 5 else 13.0827,
                longitude=-0.1278 if i == 5 else 80.2707,
            ),
        )
        assert result.status_code == 201, result.text
    assert client.post("/api/transactions", json=payload(5)).status_code == 409
    alerts = client.get("/api/alerts?risk=CRITICAL").json()
    assert alerts["total"] == 1
    client.headers["Authorization"] = "Bearer " + issue_token(users[1])
    version = alerts["items"][0]["version"]
    result = client.post(
        "/api/transactions/T-5/review", json={"version": version, "reason": "Checked customer history"}
    )
    assert result.status_code == 200, result.text
    assert result.json()["status"] == "REVIEWED"
    assert (
        client.post(
            "/api/transactions/T-5/clear", json={"version": version, "reason": "Outdated form"}
        ).status_code
        == 409
    )
    result = client.post(
        "/api/transactions/T-5/clear",
        json={"version": result.json()["version"], "reason": "Customer verified travel"},
    )
    assert result.status_code == 200 and result.json()["status"] == "CLEARED"
    assert any(a["action"] == "CLEAR" for a in result.json()["audit"])
    assert (
        client.post(
            "/api/transactions/T-5/confirm-fraud",
            json={"version": result.json()["version"], "reason": "Change final decision"},
        ).status_code
        == 409
    )
    assert db.scalar(select(func.count()).select_from(Outbox)) == 1
    assert client.get("/api/dashboard/summary").json()["statuses"]["CLEARED"] == 1


def test_csv_mapping_validation_duplicates(client):
    content = "ref,customer,merchant,amt,time\nA1,C1,M1,2000,2025-01-01T10:00:00Z\nA2,C1,M1,-3,2025-01-01T10:01:00Z\nA1,C1,M1,2000,2025-01-01T10:00:00Z\n"
    mapping = {
        "id": "ref",
        "customer_id": "customer",
        "merchant_id": "merchant",
        "amount": "amt",
        "timestamp": "time",
    }
    result = client.post(
        "/api/import/csv",
        files={"file": ("data.csv", content, "text/csv")},
        data={"mapping": json.dumps(mapping)},
    )
    assert result.status_code == 200, result.text
    report = result.json()
    assert (report["inserted"], report["duplicates"], report["invalid"]) == (1, 1, 1)
    assert report["errors"][0]["row"] == 2
    assert (
        client.post(
            "/api/import/csv", files={"file": ("data.csv", content)}, data={"mapping": "[]"}
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/import/csv", files={"file": ("data.csv", content)}, data={"mapping": '{"id":"missing"}'}
        ).status_code
        == 422
    )


def test_bulk_sorted_in_event_order(client):
    result = client.post("/api/transactions/bulk", json=[payload(i) for i in reversed(range(6))])
    assert result.status_code == 200 and result.json()["inserted"] == 6
    assert client.get("/api/transactions/T-5").json()["assessment"]["raw_score"] == 25


def test_simulation_does_not_persist(client, db):
    result = client.post("/api/rules/simulate", json=payload())
    assert result.status_code == 200
    assert db.scalar(select(func.count()).select_from(Transaction)) == 0
    assert db.scalar(select(func.count()).select_from(Audit)) == 0


def test_rule_configuration_preserves_old_evidence(client):
    client.post("/api/transactions", json=payload())
    rule = next(r for r in client.get("/api/rules").json() if r["name"] == "transaction_velocity")
    update = {"version": rule["version"], "enabled": True, "parameters": rule["parameters"] | {"score": 75}}
    result = client.put("/api/rules/" + rule["name"], json=update)
    assert result.status_code == 200
    assert (
        next(
            r
            for r in client.get("/api/transactions/T-0").json()["assessment"]["rules"]
            if r["rule_name"] == "transaction_velocity"
        )["configuration"]["score"]
        == 25
    )
    assert client.put("/api/rules/" + rule["name"], json=update).status_code == 409
    assert (
        client.put(
            "/api/rules/" + rule["name"], json=update | {"version": 2, "parameters": {"score": 999}}
        ).status_code
        == 422
    )


def test_case_lifecycle_and_graph(client, db, users):
    client.post("/api/transactions", json=payload())
    result = client.post(
        "/api/transactions/T-0/escalate", json={"version": 1, "reason": "Needs further investigation"}
    )
    assert result.status_code == 200, result.text
    case = client.get("/api/cases").json()[0]
    update = {
        "version": case["version"],
        "status": "INVESTIGATING",
        "assigned_to": users[1].id,
        "note": "Device checked",
    }
    assert client.patch("/api/cases/" + case["id"], json=update).status_code == 200
    cases = client.get("/api/cases").json()
    assert cases[0]["notes"][0]["note"] == "Device checked"
    assert client.patch("/api/cases/" + case["id"], json=update).status_code == 409
    graph = client.get("/api/graph/transaction/T-0").json()
    assert any(n["data"]["kind"] == "customer" for n in graph["nodes"])
    assert len(graph["edges"]) > 0
    assert client.get("/api/ml/status").json()["available"] is False
    assert client.get("/api/transactions/missing").status_code == 404


def test_dashboard_filters_pagination(client):
    client.post("/api/transactions/bulk", json=[payload(i) for i in range(7)])
    assert client.get("/api/dashboard/summary").json()["total"] == 7
    assert client.get("/api/transactions?page_size=3&page=2").json()["items"][0]["id"]
    assert len(client.get("/api/transactions?page_size=3&page=2").json()["items"]) == 3
    assert client.get("/api/alerts?q=T-6").json()["total"] == 1
    assert client.get("/api/transactions?customer=absent").json()["total"] == 0
    assert client.get("/api/transactions?page=0").status_code == 422
    assert client.get("/api/dashboard/trends").json()[0]["transactions"] == 7


def test_daily_trends_use_utc(client):
    client.post("/api/transactions", json=payload(timestamp="2025-01-01T23:55:00Z"))
    assert client.get("/api/dashboard/trends").json()[0]["day"] == "2025-01-01"


def test_case_can_close_only_after_transaction_resolution(client):
    client.post("/api/transactions", json=payload())
    client.post(
        "/api/transactions/T-0/escalate", json={"version": 1, "reason": "Investigate device evidence"}
    )
    case = client.get("/api/cases").json()[0]
    assert (
        client.patch(
            "/api/cases/" + case["id"], json={"version": case["version"], "status": "CLOSED"}
        ).status_code
        == 409
    )
    version = client.get("/api/transactions/T-0").json()["version"]
    assert (
        client.post("/api/transactions/T-0/clear", json={"version": version, "reason": "   "}).status_code
        == 422
    )
    assert (
        client.post(
            "/api/transactions/T-0/clear", json={"version": version, "reason": "Verified legitimate activity"}
        ).status_code
        == 200
    )
    case = client.get("/api/cases").json()[0]
    assert case["status"] == "CLEARED"
    result = client.patch("/api/cases/" + case["id"], json={"version": case["version"], "status": "CLOSED"})
    assert result.status_code == 200, result.text
    assert client.get("/api/cases").json()[0]["status"] == "CLOSED"

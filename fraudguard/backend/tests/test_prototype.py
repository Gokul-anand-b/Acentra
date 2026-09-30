from sqlalchemy import select

from app.auth import issue_token
from app.models import Outbox


def test_demo_notification_retry_and_case_detail(client, db, users):
    result = client.post("/api/demo/scenario")
    assert result.status_code == 201, result.text
    transaction = result.json()
    assert transaction["source"] == "synthetic"
    assert transaction["assessment"]["normalized_score"] == 95
    events = client.get("/api/notifications").json()
    assert events["total"] >= 1
    event = db.scalar(select(Outbox).where(Outbox.transaction_id == transaction["id"]))
    assert client.post(f"/api/notifications/{event.id}/retry").status_code == 409
    event.status = "FAILED"
    event.attempts = 5
    db.commit()
    assert client.post(f"/api/notifications/{event.id}/retry").json()["status"] == "PENDING"
    assert event.attempts == 0
    response = client.post(
        f"/api/transactions/{transaction['id']}/escalate",
        json={"version": transaction["version"], "reason": "Inspect suspicious synthetic event"},
    )
    assert response.status_code == 200, response.text
    detail = client.get(f"/api/transactions/{transaction['id']}").json()
    case = client.get(f"/api/cases/{detail['case_id']}")
    assert case.status_code == 200
    assert case.json()["transaction"]["id"] == transaction["id"]
    client.headers["Authorization"] = "Bearer " + issue_token(users[1])
    assert client.post("/api/demo/scenario").status_code == 403
    assert client.post(f"/api/notifications/{event.id}/retry").status_code == 403

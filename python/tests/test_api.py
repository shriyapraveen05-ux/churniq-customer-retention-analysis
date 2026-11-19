import pytest
from fastapi.testclient import TestClient
import churniq.api as api


@pytest.fixture
def client(result, monkeypatch):
    monkeypatch.setattr(api, "_state", result)
    return TestClient(api.app)


def test_endpoints(client):
    for endpoint in api.ENDPOINTS:
        response = client.get("/api/" + endpoint)
        assert response.status_code == 200, response.text
        assert response.json()["ok"] is True
    r = client.get("/api/customer-risk?risk=High&page_size=2").json()["data"]
    assert len(r["rows"]) == 2
    assert all(c["riskCategory"] == "High" and not c["churn"] for c in r["rows"])


def test_bad_upload(client):
    r = client.post("/api/upload-dataset", files={"file": ("bad.csv", b"garbage", "text/csv")})
    assert r.status_code == 400
    assert r.json()["ok"] is False


def test_empty_filter(client):
    r = client.get("/api/overview?contract=nonexistent")
    assert r.status_code == 200, r.text
    assert r.json()["data"]["totalCustomers"] == 0

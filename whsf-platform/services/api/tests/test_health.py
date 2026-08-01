from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_contract_and_request_id() -> None:
    response = client.get("/health", headers={"x-request-id": "test-request"})
    assert response.status_code == 200
    assert response.headers["x-request-id"] == "test-request"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.json()["service"] == "api"
    assert response.json()["status"] == "ok"


def test_versioned_meta_route() -> None:
    response = client.get("/v1/meta")
    assert response.status_code == 200
    assert response.json()["name"] == "WHSF Humanitarian Platform"

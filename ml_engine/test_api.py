import json
import os
import tempfile
import pytest

# Isolate DB for API tests
temp_db = tempfile.NamedTemporaryFile(delete=False)
temp_db_path = temp_db.name
temp_db.close()
os.environ["KPIT_DB_PATH"] = temp_db_path

from fastapi.testclient import TestClient
from main import app
from database import init_db

# Initialize test DB
init_db()

client = TestClient(app)

def test_health():
    """Verify backend server is online."""
    print("1. Testing Health Check...")
    res = client.get("/")
    print(f"Status: {res.status_code} | Response: {res.json()}\n")
    assert res.status_code == 200

def test_analyze():
    """Test OBD telemetry analysis and RAG retrieval."""
    print("2. Testing /api/v1/analyze endpoint...")
    payload = {
        "vehicle_id": "V102",
        "vehicle_model": "Truck_X",
        "mileage": 74000,
        "dtc_code": "P0403, P0404",
        "symptom": "Low power under load",
        "LOAD_PCT": 26.3,
        "ECT": 169.0,
        "MAP": 14.4,
        "RPM": 790.0,
        "VSS": 0.0,
        "IAT": 106.0,
        "MAF": 0.02,
        "FRP": 4507.5,
        "BARO": 14.2,
        "VPWR": 13.64,
        "AAT": 126.0,
        "Mode": 0
    }
    res = client.post("/api/v1/analyze", json=payload)
    print(f"Status: {res.status_code}")
    print("Response Payload:")
    print(json.dumps(res.json(), indent=2))
    print("\n" + "="*50 + "\n")
    assert res.status_code == 200

def test_repair_feedback():
    """Test closed-loop feedback storage into fleet memory CSV."""
    print("3. Testing /api/v1/repair-feedback endpoint...")
    payload = {
        "vehicle_id": "V102",
        "vehicle_model": "Truck_X",
        "mileage": 74000,
        "dtc_code": "P0420",
        "actual_repair": "Replaced cracked intake manifold gasket",
        "outcome": "Resolved"
    }
    res = client.post("/api/v1/repair-feedback", json=payload)
    print(f"Status: {res.status_code} | Response: {res.json()}\n")
    assert res.status_code == 200
    
    print("4. Testing /api/v1/vehicles/{vehicle_id}/service-history endpoint...")
    res2 = client.get("/api/v1/vehicles/V102/service-history")
    print(f"Status: {res2.status_code}")
    print("Service History Result:")
    print(json.dumps(res2.json(), indent=2))
    print("\n" + "="*50 + "\n")
    assert res2.status_code == 200

if __name__ == "__main__":
    test_health()
    test_analyze()
    test_repair_feedback()
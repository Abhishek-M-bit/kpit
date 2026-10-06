import requests
import json

BASE_URL = "http://127.0.0.1:8000"

def test_health():
    """Verify backend server is online."""
    print("1. Testing Health Check...")
    res = requests.get(f"{BASE_URL}/")
    print(f"Status: {res.status_code} | Response: {res.json()}\n")

def test_analyze():
    """Test OBD telemetry analysis and RAG retrieval."""
    print("2. Testing /api/v1/analyze endpoint...")
    payload = {
        "vehicle_id": "V102",
        "vehicle_model": "Truck_X",
        "mileage": 74000,
        "dtc_code": "P0420",
        "rpm": 2200,
        "engine_load": 78.0,
        "coolant_temp": 98.0,
        "long_fuel_trim": 22.5,
        "symptom": "Low power under load"
    }
    res = requests.post(f"{BASE_URL}/api/v1/analyze", json=payload)
    print(f"Status: {res.status_code}")
    print("Response Payload:")
    print(json.dumps(res.json(), indent=2))
    print("\n" + "="*50 + "\n")

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
    res = requests.post(f"{BASE_URL}/api/v1/repair-feedback", json=payload)
    print(f"Status: {res.status_code} | Response: {res.json()}\n")

if __name__ == "__main__":
    test_health()
    test_analyze()
    test_repair_feedback()
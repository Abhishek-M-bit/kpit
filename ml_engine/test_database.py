import os
import sqlite3
import json
import pytest
import tempfile

# Set environment variable BEFORE importing database/main to isolate DB
temp_db = tempfile.NamedTemporaryFile(delete=False)
temp_db_path = temp_db.name
temp_db.close()
os.environ["KPIT_DB_PATH"] = temp_db_path

from fastapi.testclient import TestClient
from main import app
from database import init_db, get_connection, save_analysis, get_db_path
from schemas import DiagnosticRequest

client = TestClient(app)

def test_a_database_initialization():
    """Test A: Database initializes correctly with all tables."""
    init_db()
    assert os.path.exists(get_db_path())
    
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row["name"] for row in cursor.fetchall()]
    conn.close()
    
    assert "vehicles" in tables
    assert "incidents" in tables
    assert "diagnostic_results" in tables
    assert "service_history" in tables

def test_bc_save_and_retrieve_analysis():
    """Test B & C: Save an analysis and retrieve complete nested JSON."""
    payload = DiagnosticRequest(
        vehicle_id="TEST-V1",
        vehicle_model="TEST-Model",
        mileage=10000,
        dtc_code="P0000",
        symptom="Test Symptom",
        LOAD_PCT=10.0, ECT=20.0, MAP=30.0, RPM=40.0, VSS=50.0,
        IAT=60.0, MAF=70.0, FRP=80.0, BARO=90.0, VPWR=100.0, AAT=110.0, Mode=0
    )
    
    response_data = {
        "incident": {"dtc_code": "P0000", "symptom": "Test Symptom"},
        "similarity": {
            "top_score": 0.99,
            "top_cases": [{"id": 1, "score": 0.99}],
            "summary": "Similarity ok"
        },
        "anomaly": {
            "anomaly": True,
            "anomaly_score": 0.5,
            "severity": "high",
            "feature_contributions": [{"feature": "RPM", "value": 40.0}]
        },
        "rag": {
            "exact_dtc_matches": [{"title": "Match 1"}],
            "semantic_matches": []
        },
        "service_history": {"available": False, "reason": "None"},
        "evidence_summary": ["Test evidence"],
        "investigation_leads": ["Test lead"]
    }
    
    # Save directly via db layer
    analysis_id = save_analysis(payload, response_data)
    assert analysis_id is not None
    assert analysis_id.startswith("ANA-")
    
    # E. GET /api/v1/incidents/{analysis_id}
    res = client.get(f"/api/v1/incidents/{analysis_id}")
    assert res.status_code == 200
    retrieved = res.json()
    
    # Verify complete nested structure is preserved
    assert retrieved["similarity"]["top_score"] == 0.99
    assert retrieved["similarity"]["top_cases"][0]["id"] == 1
    assert retrieved["anomaly"]["anomaly"] is True
    assert retrieved["anomaly"]["feature_contributions"][0]["feature"] == "RPM"
    assert retrieved["rag"]["exact_dtc_matches"][0]["title"] == "Match 1"

def test_d_get_incidents():
    """Test D: GET /api/v1/incidents returns 200 and the list of incidents."""
    res = client.get("/api/v1/incidents")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) > 0
    assert "analysis_id" in data[0]

def test_f_invalid_analysis_id():
    """Test F: Invalid analysis ID returns 404."""
    res = client.get("/api/v1/incidents/INVALID-ID")
    assert res.status_code == 404

def test_g_service_history():
    """Test G: Service history endpoint."""
    res = client.get("/api/v1/vehicles/TEST-V1/service-history")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) == 0 # No fake data fabricated

def test_h_existing_analysis_flow():
    """Test H: Full e2e analysis pipeline persists accurately."""
    payload = {
        "vehicle_id": "TEST-V2",
        "vehicle_model": "Truck_Y",
        "mileage": 80000,
        "dtc_code": "P0403",
        "symptom": "Power loss",
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
    assert res.status_code == 200
    data = res.json()
    
    analysis_id = data.get("analysis_id")
    assert analysis_id is not None
    
    # Retrieve
    retrieve_res = client.get(f"/api/v1/incidents/{analysis_id}")
    assert retrieve_res.status_code == 200
    retrieved = retrieve_res.json()
    
    assert retrieved["similarity"]["top_score"] == data["similarity"]["top_score"]
    assert retrieved["anomaly"]["severity"] == data["anomaly"]["severity"]

def test_i_repair_feedback():
    """Test I: Repair feedback is saved and retrieved from service history."""
    payload = {
        "vehicle_id": "TEST-V3",
        "vehicle_model": "Truck_Z",
        "mileage": 10000,
        "dtc_code": "P0420",
        "actual_repair": "Replaced catalytic converter",
        "outcome": "Resolved"
    }
    res = client.post("/api/v1/repair-feedback", json=payload)
    assert res.status_code == 200
    
    res2 = client.get("/api/v1/vehicles/TEST-V3/service-history")
    assert res2.status_code == 200
    data = res2.json()
    assert len(data) == 1
    assert data[0]["actual_repair"] == "Replaced catalytic converter"
    assert data[0]["outcome"] == "Resolved"
    assert data[0]["component"] == "P0420"
    
def test_j_no_service_history():
    """Test J: Verify a vehicle with no history still returns the empty state."""
    res = client.get("/api/v1/vehicles/TEST-NON-EXISTENT/service-history")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) == 0

def test_k_repair_feedback_failure(monkeypatch):
    """Test K: Database failure is not reported as success."""
    def mock_save_service_history(*args, **kwargs):
        return None
    import database
    monkeypatch.setattr(database, "save_service_history", mock_save_service_history)
    
    payload = {
        "vehicle_id": "TEST-V4",
        "vehicle_model": "Truck_Z",
        "mileage": 10000,
        "dtc_code": "P0420",
        "actual_repair": "Replaced catalytic converter",
        "outcome": "Resolved"
    }
    res = client.post("/api/v1/repair-feedback", json=payload)
    assert res.status_code == 500
    assert "Failed to save repair feedback to database" in res.json()["detail"]

if __name__ == "__main__":
    pytest.main(["-v", __file__])

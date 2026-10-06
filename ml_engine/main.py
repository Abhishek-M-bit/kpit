from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import os

from schemas import DiagnosticRequest, DiagnosticResponse, RepairFeedbackRequest
import database

# Import the NEW ML engine inference entry point
from inference import analyze_incident

app = FastAPI(
    title="SyntaxSquad AI Fleet Memory API",
    description="Backend API for Structured Telemetry Analysis & ML Intelligence",
    version="2.0.0"
)

# Enable CORS for Streamlit / React Frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATASET_PATH = "fleet_memory.csv"

@app.get("/")
def root():
    return {
        "status": "online",
        "system": "SyntaxSquad ML Inference Engine",
        "docs_url": "http://localhost:8000/docs"
    }

@app.post("/api/v1/analyze", response_model=DiagnosticResponse)
def analyze_telemetry(payload: DiagnosticRequest):
    """Inbound telemetry endpoint: routes to the ML inference pipeline and returns the final Evidence Package."""
    try:
        # Request Mapping Adapter
        # Map FastAPI request -> ML incident object
        active_dtcs = [d.strip().upper() for d in payload.dtc_code.split(",") if d.strip()]
        
        ml_incident = {
            "LOAD_PCT": payload.LOAD_PCT,
            "ECT": payload.ECT,
            "MAP": payload.MAP,
            "RPM": payload.RPM,
            "VSS": payload.VSS,
            "IAT": payload.IAT,
            "MAF": payload.MAF,
            "FRP": payload.FRP,
            "BARO": payload.BARO,
            "VPWR": payload.VPWR,
            "AAT": payload.AAT,
            "Mode": payload.Mode,
            "active_dtcs": active_dtcs
        }
        
        # Call the existing ML Engine Pipeline
        evidence_package = analyze_incident(ml_incident)
        
        # ML Engine handles sub-component failures internally, but if it returned an explicit top-level error:
        if "error" in evidence_package:
            raise ValueError(evidence_package.get("message", "Unknown ML Engine Error"))
            
        # Enrich the response incident with the ORIGINAL request metadata
        evidence_package["incident"]["vehicle_id"] = payload.vehicle_id
        evidence_package["incident"]["vehicle_model"] = payload.vehicle_model
        evidence_package["incident"]["mileage"] = payload.mileage
        evidence_package["incident"]["dtc_code"] = payload.dtc_code
        evidence_package["incident"]["symptom"] = payload.symptom
        
        # Save to database
        analysis_id = database.save_analysis(payload, evidence_package)
        
        # Response Mapping Adapter
        return DiagnosticResponse(
            analysis_id=analysis_id,
            vehicle_id=payload.vehicle_id,
            incident=evidence_package["incident"],
            similarity=evidence_package["similarity"],
            anomaly=evidence_package["anomaly"],
            rag=evidence_package["rag"],
            service_history=evidence_package["service_history"],
            evidence_summary=evidence_package["evidence_summary"],
            investigation_leads=evidence_package["investigation_leads"]
        )
    except ValueError as ve:
        # Validation or explicit ML pipeline error
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        # Unexpected internal runtime errors
        raise HTTPException(status_code=500, detail=f"Diagnostic Pipeline Error: {str(e)}")

@app.post("/api/v1/repair-feedback")
def submit_feedback(feedback: RepairFeedbackRequest):
    """Active Learning loop: stores technician repair outcome back into fleet memory."""
    try:
        # Save to SQLite service_history table instead of fleet_memory.csv
        result = database.save_service_history(feedback)
        if result is None:
            raise HTTPException(status_code=500, detail="Failed to save repair feedback to database.")
            
        return {
            "status": "success",
            "message": f"Repair outcome for {feedback.vehicle_id} successfully logged into Fleet Memory."
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Feedback Submission Error: {str(e)}")

@app.get("/api/v1/incidents")
def get_incidents(limit: int = 50):
    try:
        return database.get_recent_incidents(limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.get("/api/v1/incidents/{analysis_id}")
def get_incident_detail(analysis_id: str):
    try:
        incident = database.get_incident(analysis_id)
        if not incident:
            raise HTTPException(status_code=404, detail="Analysis not found")
        return incident
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.get("/api/v1/vehicles/{vehicle_id}/service-history")
def get_vehicle_service_history(vehicle_id: str):
    try:
        return database.get_service_history(vehicle_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
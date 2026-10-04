from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import os

from schemas import DiagnosticRequest, DiagnosticResponse, RepairFeedbackRequest
from rag_engine import run_rag_pipeline

app = FastAPI(
    title="SyntaxSquad AI Fleet Memory API",
    description="Backend API for Structured Telemetry Analysis & RAG Root-Cause Intelligence",
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
        "system": "SyntaxSquad RAG Engine",
        "docs_url": "http://localhost:8000/docs"
    }

@app.post("/api/v1/analyze", response_model=DiagnosticResponse)
def analyze_telemetry(payload: DiagnosticRequest):
    """Inbound telemetry endpoint: runs RAG pipeline and returns Evidence Card JSON."""
    try:
        data = payload.dict()
        data["dtc_code"] = data["dtc_code"].strip().upper()
        
        result = run_rag_pipeline(data, dataset_path=DATASET_PATH)
        
        return DiagnosticResponse(
            vehicle_id=data["vehicle_id"],
            pipeline_tier=result["pipeline_tier"],
            primary_hypothesis=result["primary_hypothesis"],
            confidence_score=result["confidence_score"],
            anomaly_detected=result["anomaly_detected"],
            evidence_summary=result["evidence_summary"],
            retrieved_citations=result["retrieved_citations"],
            similar_cases_count=result["similar_cases_count"],
            recommended_actions=result["recommended_actions"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Diagnostic Pipeline Error: {str(e)}")

@app.post("/api/v1/repair-feedback")
def submit_feedback(feedback: RepairFeedbackRequest):
    """Active Learning loop: stores technician repair outcome back into fleet memory."""
    try:
        new_row = pd.DataFrame([feedback.dict()])
        
        if os.path.exists(DATASET_PATH):
            new_row.to_csv(DATASET_PATH, mode='a', header=False, index=False)
        else:
            new_row.to_csv(DATASET_PATH, mode='w', header=True, index=False)
            
        return {
            "status": "success",
            "message": f"Repair outcome for {feedback.vehicle_id} successfully logged into Fleet Memory."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Feedback Submission Error: {str(e)}")
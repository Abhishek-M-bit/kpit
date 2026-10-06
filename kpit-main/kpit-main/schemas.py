from pydantic import BaseModel
from typing import List, Optional

class DiagnosticRequest(BaseModel):
    vehicle_id: str
    vehicle_model: str
    mileage: float
    dtc_code: str
    rpm: float
    engine_load: float
    coolant_temp: float
    long_fuel_trim: float
    symptom: Optional[str] = "Unspecified"

class DiagnosticResponse(BaseModel):
    vehicle_id: str
    pipeline_tier: str            # "Tier 1 (Fast Triage)" or "Tier 2 (Deep Explorer)"
    primary_hypothesis: str
    confidence_score: float
    anomaly_detected: bool
    evidence_summary: List[str]
    retrieved_citations: List[str] # RAG output: OEM TSBs & mechanic notes
    similar_cases_count: int
    recommended_actions: List[str]

class RepairFeedbackRequest(BaseModel):
    vehicle_id: str
    vehicle_model: str
    mileage: float
    dtc_code: str
    actual_repair: str
    outcome: str                  # "Resolved" or "Unresolved"
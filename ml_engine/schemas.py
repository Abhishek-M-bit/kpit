from pydantic import BaseModel
from typing import List, Optional, Any, Dict

class DiagnosticRequest(BaseModel):
    vehicle_id: str
    vehicle_model: str
    mileage: float
    dtc_code: str
    symptom: Optional[str] = "Unspecified"
    
    # ML Engine Required Sensors
    LOAD_PCT: float
    ECT: float
    MAP: float
    RPM: float
    VSS: float
    IAT: float
    MAF: float
    FRP: float
    BARO: float
    VPWR: float
    AAT: float
    Mode: int

class SimilarityData(BaseModel):
    top_cases: List[Dict[str, Any]]
    top_score: float
    summary: str

class AnomalyData(BaseModel):
    anomaly: bool
    anomaly_score: float
    severity: str
    feature_contributions: List[Dict[str, Any]]

class RAGData(BaseModel):
    exact_dtc_matches: List[Dict[str, Any]]
    semantic_matches: List[Dict[str, Any]]

class ServiceHistoryData(BaseModel):
    available: bool
    reason: str

class IncidentData(BaseModel):
    vehicle_id: str
    vehicle_model: str
    mileage: float
    dtc_code: str
    symptom: Optional[str] = "Unspecified"
    
    LOAD_PCT: float
    ECT: float
    MAP: float
    RPM: float
    VSS: float
    IAT: float
    MAF: float
    FRP: float
    BARO: float
    VPWR: float
    AAT: float
    Mode: int
    active_dtcs: List[str]

class DiagnosticResponse(BaseModel):
    analysis_id: Optional[str] = None
    vehicle_id: str
    incident: IncidentData
    similarity: SimilarityData
    anomaly: AnomalyData
    rag: RAGData
    service_history: ServiceHistoryData
    evidence_summary: List[str]
    investigation_leads: List[str]

class RepairFeedbackRequest(BaseModel):
    vehicle_id: str
    vehicle_model: str
    mileage: float
    dtc_code: str
    actual_repair: str
    outcome: str                  # "Resolved" or "Unresolved"
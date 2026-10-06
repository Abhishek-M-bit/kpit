import sqlite3
import json
import os
import uuid
from datetime import datetime

def get_db_path():
    """Returns the database path, allowing override via KPIT_DB_PATH environment variable."""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    default_path = os.path.join(base_dir, "data", "kpit_diagnostics.db")
    return os.environ.get("KPIT_DB_PATH", default_path)

def get_connection():
    db_path = get_db_path()
    os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    
    # Create vehicles table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS vehicles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vehicle_id TEXT UNIQUE NOT NULL,
        vehicle_model TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    # Create incidents table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS incidents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        analysis_id TEXT UNIQUE NOT NULL,
        vehicle_id TEXT NOT NULL,
        vehicle_model TEXT,
        mileage REAL,
        dtc_code TEXT,
        symptom TEXT,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        LOAD_PCT REAL,
        ECT REAL,
        MAP REAL,
        RPM REAL,
        VSS REAL,
        IAT REAL,
        MAF REAL,
        FRP REAL,
        BARO REAL,
        VPWR REAL,
        AAT REAL,
        Mode INTEGER,
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id)
    )
    ''')
    
    # Create diagnostic_results table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS diagnostic_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        analysis_id TEXT NOT NULL,
        anomaly BOOLEAN,
        anomaly_score REAL,
        severity TEXT,
        top_similarity_score REAL,
        investigation_leads TEXT,
        evidence_summary TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (analysis_id) REFERENCES incidents(analysis_id)
    )
    ''')
    
    # Create service_history table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS service_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vehicle_id TEXT NOT NULL,
        service_date TEXT,
        service_type TEXT,
        component TEXT,
        description TEXT,
        mileage REAL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id)
    )
    ''')
    
    # Safe migration for response_json
    try:
        cursor.execute("ALTER TABLE diagnostic_results ADD COLUMN response_json TEXT")
    except sqlite3.OperationalError:
        pass
        
    # Safe migrations for service_history
    try:
        cursor.execute("ALTER TABLE service_history ADD COLUMN actual_repair TEXT")
    except sqlite3.OperationalError:
        pass
    try:
        cursor.execute("ALTER TABLE service_history ADD COLUMN outcome TEXT")
    except sqlite3.OperationalError:
        pass
    
    conn.commit()
    conn.close()

def save_analysis(payload, response_data):
    """
    Saves a successful analysis to the SQLite database.
    payload: The initial request data (DiagnosticRequest)
    response_data: The DiagnosticResponse dictionary
    """
    conn = get_connection()
    cursor = conn.cursor()
    try:
        analysis_id = "ANA-" + str(uuid.uuid4())[:8].upper()
        now = datetime.utcnow().isoformat()
        
        # 1. Insert or ignore vehicle
        cursor.execute('''
            INSERT OR IGNORE INTO vehicles (vehicle_id, vehicle_model, created_at, updated_at)
            VALUES (?, ?, ?, ?)
        ''', (payload.vehicle_id, getattr(payload, "vehicle_model", "Unknown"), now, now))
        
        # 2. Insert incident
        cursor.execute('''
            INSERT INTO incidents (
                analysis_id, vehicle_id, vehicle_model, mileage, dtc_code, symptom, timestamp,
                LOAD_PCT, ECT, MAP, RPM, VSS, IAT, MAF, FRP, BARO, VPWR, AAT, Mode
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            analysis_id, payload.vehicle_id, getattr(payload, "vehicle_model", "Unknown"), 
            getattr(payload, "mileage", 0.0), payload.dtc_code, getattr(payload, "symptom", "Unknown"), now,
            payload.LOAD_PCT, payload.ECT, payload.MAP, payload.RPM, payload.VSS, payload.IAT, payload.MAF, payload.FRP, payload.BARO, payload.VPWR, payload.AAT, payload.Mode
        ))
        
        # 3. Insert diagnostic_results
        anomaly_data = response_data.get("anomaly", {})
        similarity_data = response_data.get("similarity", {})
        investigation_leads = json.dumps(response_data.get("investigation_leads", []))
        evidence_summary = json.dumps(response_data.get("evidence_summary", []))
        
        cursor.execute('''
            INSERT INTO diagnostic_results (
                analysis_id, anomaly, anomaly_score, severity, top_similarity_score,
                investigation_leads, evidence_summary, created_at, response_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            analysis_id, 
            anomaly_data.get("anomaly", False),
            anomaly_data.get("anomaly_score", 0.0),
            anomaly_data.get("severity", "normal"),
            similarity_data.get("top_score", 0.0),
            investigation_leads,
            evidence_summary,
            now,
            json.dumps(response_data)
        ))
        
        conn.commit()
        return analysis_id
    except Exception as e:
        conn.rollback()
        print(f"DB Error saving analysis: {e}")
        return None
    finally:
        conn.close()

def get_recent_incidents(limit=50):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT analysis_id, vehicle_id, vehicle_model, dtc_code, symptom, mileage, timestamp
        FROM incidents
        ORDER BY timestamp DESC
        LIMIT ?
    ''', (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_incident(analysis_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT i.*, r.anomaly, r.anomaly_score, r.severity, r.top_similarity_score, r.investigation_leads, r.evidence_summary, r.response_json
        FROM incidents i
        LEFT JOIN diagnostic_results r ON i.analysis_id = r.analysis_id
        WHERE i.analysis_id = ?
    ''', (analysis_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        result = dict(row)
        
        # If complete JSON exists, prefer returning that
        if result.get("response_json"):
            try:
                full_resp = json.loads(result["response_json"])
                full_resp["analysis_id"] = result["analysis_id"]
                return full_resp
            except:
                pass
                
        # Parse JSON fields for legacy/fallback records
        if result.get("investigation_leads"):
            try: result["investigation_leads"] = json.loads(result["investigation_leads"])
            except: pass
        if result.get("evidence_summary"):
            try: result["evidence_summary"] = json.loads(result["evidence_summary"])
            except: pass
        return result
    return None

def get_service_history(vehicle_id):
    conn = get_connection()
    cursor = conn.cursor()
    # Safely select columns, handling cases where migrations might not have run for old data
    cursor.execute('''
        SELECT service_date, service_type, component, description, mileage, actual_repair, outcome
        FROM service_history
        WHERE vehicle_id = ?
        ORDER BY service_date DESC
    ''', (vehicle_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def save_service_history(feedback):
    """
    Saves a repair feedback record into the service_history table.
    """
    conn = get_connection()
    cursor = conn.cursor()
    try:
        from datetime import datetime
        now = datetime.utcnow().isoformat()
        
        # Ensure vehicle exists
        cursor.execute('''
            INSERT OR IGNORE INTO vehicles (vehicle_id, vehicle_model, created_at, updated_at)
            VALUES (?, ?, ?, ?)
        ''', (feedback.vehicle_id, getattr(feedback, "vehicle_model", "Unknown"), now, now))
        
        cursor.execute('''
            INSERT INTO service_history (
                vehicle_id, service_date, service_type, component, description, mileage, actual_repair, outcome, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            feedback.vehicle_id,
            now,
            "Repair Feedback",
            feedback.dtc_code,
            feedback.actual_repair,
            feedback.mileage,
            feedback.actual_repair,
            feedback.outcome,
            now
        ))
        conn.commit()
        return cursor.lastrowid
    except Exception as e:
        conn.rollback()
        print(f"DB Error saving service history: {e}")
        return None
    finally:
        conn.close()

# Auto-initialize DB on import
init_db()

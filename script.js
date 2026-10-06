// ============================================================
// SYNTAXSQUAD ROOT-CAUSE EXPLORER
// COMPLETE FRONTEND SCRIPT
// Similarity + Service History + RAG + Anomaly Detection
// ============================================================

const API_URL = "http://127.0.0.1:8000/api/v1";

// ============================================================
// STATE & NAVIGATION
// ============================================================

let currentAnalysisResult = null;

document.addEventListener("DOMContentLoaded", () => {
    setupNavigation();
});

function setupNavigation() {
    const navItems = document.querySelectorAll("#sidebar-nav .nav-item");
    const views = document.querySelectorAll(".view-content");

    navItems.forEach(btn => {
        btn.addEventListener("click", () => {
            // Update active button
            navItems.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            // Hide all views
            views.forEach(v => v.classList.add("hidden"));

            // Show selected view
            const viewId = "view-" + btn.dataset.view;
            const targetView = $(viewId);
            if (targetView) {
                targetView.classList.remove("hidden");
                renderView(btn.dataset.view);
            }
        });
    });
}

function renderView(viewName) {
    if (viewName === "dashboard") return;

    const containerId = viewName + "-container";
    const container = $(containerId);
    if (!container) return;

    if (viewName === "incidents") {
        container.innerHTML = `<div class="panel"><div class="panel-header"><h2>Loading incidents...</h2></div></div>`;
        fetch(`${API_URL}/incidents`)
            .then(res => res.json())
            .then(data => {
                let html = `
                    <div class="panel">
                        <div class="panel-header">
                            <div>
                                <span class="section-label">INCIDENT HISTORY</span>
                                <h2>Recent Diagnosed Incidents</h2>
                            </div>
                        </div>
                        <div class="panel-content">
                            <table class="data-table" style="width: 100%; border-collapse: collapse;">
                                <thead>
                                    <tr style="text-align: left; border-bottom: 1px solid #333;">
                                        <th style="padding: 10px;">Analysis ID</th>
                                        <th style="padding: 10px;">Vehicle ID</th>
                                        <th style="padding: 10px;">Model</th>
                                        <th style="padding: 10px;">DTC</th>
                                        <th style="padding: 10px;">Symptom</th>
                                        <th style="padding: 10px;">Mileage</th>
                                        <th style="padding: 10px;">Timestamp</th>
                                    </tr>
                                </thead>
                                <tbody>
                `;
                if (!data || data.length === 0) {
                    html += `<tr><td colspan="7" style="padding: 10px; text-align: center;">No recorded incidents.</td></tr>`;
                } else {
                    data.forEach(inc => {
                        html += `
                            <tr style="border-bottom: 1px solid #222;">
                                <td style="padding: 10px; color: #4facfe; cursor: pointer;" onclick="loadSpecificIncident('${inc.analysis_id}')">${safe(inc.analysis_id)}</td>
                                <td style="padding: 10px;">${safe(inc.vehicle_id)}</td>
                                <td style="padding: 10px;">${safe(inc.vehicle_model)}</td>
                                <td style="padding: 10px;">${safe(inc.dtc_code)}</td>
                                <td style="padding: 10px;">${safe(inc.symptom)}</td>
                                <td style="padding: 10px;">${safe(inc.mileage)}</td>
                                <td style="padding: 10px;">${new Date(inc.timestamp).toLocaleString()}</td>
                            </tr>
                        `;
                    });
                }
                html += `</tbody></table></div></div>`;
                container.innerHTML = html;
            })
            .catch(err => {
                container.innerHTML = `<div class="panel"><p>Error loading incidents: ${err.message}</p></div>`;
            });
        return;
    }
    
    if (!currentAnalysisResult) {
        container.innerHTML = `
            <div class="panel">
                <div class="empty-state">Run a vehicle analysis on the Dashboard to populate this section.</div>
            </div>`;
        return;
    }

    if (viewName === "root-cause") {
        // We can just move the resultsSection into this container, or clone it.
        // Actually, since Root-Cause is supposed to show the investigation lead, we can clone resultsSection
        const results = $("resultsSection");
        container.innerHTML = "";
        if (results) {
            container.appendChild(results.cloneNode(true));
        }
    } else if (viewName === "anomaly") {
        container.innerHTML = "";
        const section = $("anomalyDetectionSection");
        if (section) {
            container.appendChild(section.cloneNode(true));
        }
    } else if (viewName === "service-history") {
        const vid = currentAnalysisResult.vehicle_id;
        container.innerHTML = `<div class="panel"><div class="panel-header"><h2>Loading service history...</h2></div></div>`;
        fetch(`${API_URL}/vehicles/${vid}/service-history`)
            .then(res => res.json())
            .then(data => {
                let html = `
                    <div class="panel">
                        <div class="panel-header">
                            <div>
                                <span class="section-label">SERVICE HISTORY</span>
                                <h2>Previous Repairs & Outcomes</h2>
                            </div>
                        </div>
                        <div class="panel-content">
                `;
                if (!data || data.length === 0) {
                    html += `<p>No service-history records available for this vehicle.</p>`;
                } else {
                    html += `<ul style="list-style-type: none; padding: 0;">`;
                    data.forEach(sh => {
                        html += `
                            <li style="margin-bottom: 15px; padding: 15px; background: rgba(255,255,255,0.05); border-radius: 6px;">
                                <strong>Date:</strong> ${safe(sh.service_date)} | <strong>Type:</strong> ${safe(sh.service_type)}<br/>
                                <strong>Component:</strong> ${safe(sh.component)} | <strong>Mileage:</strong> ${safe(sh.mileage)}<br/>
                                <strong>Description:</strong> ${safe(sh.description)}
                            </li>
                        `;
                    });
                    html += `</ul>`;
                }
                html += `</div></div>`;
                container.innerHTML = html;
            })
            .catch(err => {
                container.innerHTML = `<div class="panel"><p>Error loading service history: ${err.message}</p></div>`;
            });
    } else if (viewName === "reports") {
        container.innerHTML = `
            <div class="panel">
                <div class="panel-header">
                    <div>
                        <span class="section-label">DIAGNOSTIC REPORT</span>
                        <h2>Full Analysis Report</h2>
                    </div>
                    <button class="analyze-button" onclick="window.print()" style="width: auto; padding: 10px 20px;">
                        Print / Save Report
                    </button>
                </div>
                <div class="panel-content" style="margin-top: 20px; line-height: 1.6;">
                    <h3>Vehicle Information</h3>
                    <p><strong>Vehicle ID:</strong> ${safe(currentAnalysisResult.incident?.vehicle_id || currentAnalysisResult.vehicle_id)}</p>
                    <p><strong>DTC Code:</strong> ${safe(currentAnalysisResult.incident?.dtc_code || "Unknown")}</p>
                    <p><strong>Symptom:</strong> ${safe(currentAnalysisResult.incident?.symptom || "Unknown")}</p>
                    
                    <h3>Investigation Lead</h3>
                    <p>${safe((currentAnalysisResult.investigation_leads || []).join(" "))}</p>
                    
                    <h3>Evidence Summary</h3>
                    <ul>
                        ${(currentAnalysisResult.evidence_summary || []).map(e => `<li>${safe(e)}</li>`).join("")}
                    </ul>
                    <div id="reportLatestFeedback"></div>
                </div>
            </div>
        `;
        
        // Fetch service history for the report
        fetch(`${API_URL}/vehicles/${currentAnalysisResult.vehicle_id}/service-history`)
            .then(res => res.json())
            .then(data => {
                if (data && data.length > 0) {
                    const latest = data[0]; // Assuming ordered by date DESC
                    const feedbackDiv = $("reportLatestFeedback");
                    if (feedbackDiv) {
                        feedbackDiv.innerHTML = `
                            <h3>Latest Technician Feedback</h3>
                            <p><strong>Date:</strong> ${safe(latest.service_date)}</p>
                            <p><strong>Actual Repair:</strong> ${safe(latest.actual_repair || latest.description)}</p>
                            <p><strong>Outcome:</strong> ${safe(latest.outcome || "Unknown")}</p>
                        `;
                    }
                }
            })
            .catch(err => console.error("Error loading service history for report:", err));
    }
}

async function loadSpecificIncident(analysisId) {
    try {
        const res = await fetch(`${API_URL}/incidents/${analysisId}`);
        if (!res.ok) throw new Error("Failed to fetch incident");
        const data = await res.json();
        
        if (data.similarity && data.anomaly && data.rag) {
            // It's the full DiagnosticResponse stored natively!
            currentAnalysisResult = data;
        } else {
            // Legacy / Fallback reconstruction
            const incidentData = {
                LOAD_PCT: data.LOAD_PCT,
                ECT: data.ECT,
                MAP: data.MAP,
                RPM: data.RPM,
                VSS: data.VSS,
                IAT: data.IAT,
                MAF: data.MAF,
                FRP: data.FRP,
                BARO: data.BARO,
                VPWR: data.VPWR,
                AAT: data.AAT,
                Mode: data.Mode,
                dtc_code: data.dtc_code,
                symptom: data.symptom,
                mileage: data.mileage
            };

            const reconstructed = {
                analysis_id: data.analysis_id,
                vehicle_id: data.vehicle_id,
                incident: incidentData,
                similarity: {
                    top_score: data.top_similarity_score,
                    top_cases: [],
                    summary: "Loaded from database (legacy record)."
                },
                anomaly: {
                    anomaly: data.anomaly === 1 || data.anomaly === true,
                    anomaly_score: data.anomaly_score,
                    severity: data.severity,
                    feature_contributions: []
                },
                rag: { exact_dtc_matches: [], semantic_matches: [] },
                service_history: { available: false, reason: "" },
                evidence_summary: data.evidence_summary || [],
                investigation_leads: data.investigation_leads || []
            };

            currentAnalysisResult = reconstructed;
        }
        
        displayResults(currentAnalysisResult);
        
        // Switch to dashboard view to see it
        const navItems = document.querySelectorAll("#sidebar-nav .nav-item");
        const views = document.querySelectorAll(".view-content");
        navItems.forEach(b => b.classList.remove("active"));
        views.forEach(v => v.classList.add("hidden"));
        
        const dashBtn = document.querySelector('[data-view="dashboard"]');
        if (dashBtn) dashBtn.classList.add("active");
        const targetView = $("view-dashboard");
        if (targetView) targetView.classList.remove("hidden");
        
    } catch (error) {
        console.error(error);
        alert("Could not load incident: " + error.message);
    }
}


// ============================================================
// HELPERS
// ============================================================

function $(id) {
    return document.getElementById(id);
}

function value(id, fallback = "") {
    const el = $(id);
    return el ? el.value : fallback;
}

function number(id, fallback = 0) {
    const n = Number(value(id, fallback));
    return Number.isFinite(n) ? n : fallback;
}

function safe(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function get(obj, keys, fallback = "-") {
    if (!obj) return fallback;

    for (const key of keys) {
        if (
            obj[key] !== undefined &&
            obj[key] !== null &&
            obj[key] !== ""
        ) {
            return obj[key];
        }
    }

    return fallback;
}

function percent(v) {
    let n = Number(v);

    if (!Number.isFinite(n)) return 0;

    if (n <= 1) n *= 100;

    return Math.max(0, Math.min(100, n));
}


// ============================================================
// ANALYZE INCIDENT
// ============================================================

async function analyzeIncident() {

    const incident = {
        vehicle_id: value("vehicleId", "V102"),
        vehicle_model: value("vehicleModel", "Truck_X"),
        mileage: number("odometer", 82450),
        dtc_code: value("dtcCode", "P0403, P0404"),
        symptom: value("symptom", "Low engine power"),

        LOAD_PCT: number("engineLoad", 26.3),
        ECT: number("coolantTemp", 169.0),
        MAP: 14.4,
        RPM: number("engineRpm", 790.0),
        VSS: number("vehicleSpeed", 0.0),
        IAT: 106.0,
        MAF: 0.02,
        FRP: 4507.5,
        BARO: number("baro", 14.2),
        VPWR: 13.64,
        AAT: 126.0,
        Mode: 0
    };


    console.log(
        "Sending incident:",
        incident
    );


    setLoading(true);


    try {

        const response = await fetch(
            `${API_URL}/analyze`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify(incident)
            }
        );


        if (!response.ok) {
            let errorMsg = `Backend error: ${response.status}`;
            try {
                const errData = await response.json();
                if (errData.detail) {
                    errorMsg = typeof errData.detail === "string" ? errData.detail : JSON.stringify(errData.detail);
                }
            } catch(e) {}
            throw new Error(errorMsg);
        }


        const data =
            await response.json();


        console.log(
            "ANALYSIS RESPONSE:",
            data
        );


        if (data.status === "error") {

            throw new Error(
                data.message ||
                "Analysis failed"
            );
        }

        currentAnalysisResult = data;

        displayResults(data);

    }

    catch (error) {

        console.error(error);

        alert(
            "Could not connect to the backend.\n\n" +
            "Make sure FastAPI is running at:\n" +
            "http://127.0.0.1:8000\n\n" +
            error.message
        );

    }

    finally {

        setLoading(false);

    }
}


// ============================================================
// SUBMIT REPAIR FEEDBACK
// ============================================================

async function submitRepairFeedback() {
    if (!currentAnalysisResult) {
        alert("Run or load a vehicle analysis before recording technician feedback.");
        return;
    }

    const actualRepair = value("feedbackActualRepair").trim();
    const outcome = value("feedbackOutcome");

    if (!actualRepair || !outcome) {
        alert("Please enter the actual repair performed and select an outcome.");
        return;
    }

    const payload = {
        vehicle_id: currentAnalysisResult.vehicle_id || "",
        vehicle_model: $("feedbackVehicleModel").textContent || "Unknown",
        mileage: Number($("feedbackMileage").textContent) || 0,
        dtc_code: $("feedbackDtcCode").textContent || "Unknown",
        actual_repair: actualRepair,
        outcome: outcome
    };

    const btn = $("submitFeedbackBtn");
    const statusText = $("feedbackStatusText");

    if (btn) btn.disabled = true;
    const btnText = $("feedbackBtnText");
    if (btnText) btnText.textContent = "SAVING...";
    
    if (statusText) {
        statusText.textContent = "Saving repair feedback...";
        statusText.style.color = "#55d6ff";
    }

    try {
        const response = await fetch(`${API_URL}/repair-feedback`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            let errorMsg = `Backend error: ${response.status}`;
            try {
                const errData = await response.json();
                if (errData.detail) {
                    errorMsg = typeof errData.detail === "string" ? errData.detail : JSON.stringify(errData.detail);
                }
            } catch(e) {}
            throw new Error(errorMsg);
        }

        const data = await response.json();
        
        if (statusText) {
            statusText.textContent = "Repair feedback saved successfully.";
            statusText.style.color = "#57e0b1";
        }
        if (btnText) {
            btnText.textContent = "SAVED";
        }
        
        // Refresh Service History by dynamically rendering it in the background
        renderView("service-history");

    } catch (error) {
        console.error(error);
        if (statusText) {
            statusText.textContent = `Error: ${error.message}`;
            statusText.style.color = "#ff5050";
        }
        if (btn) btn.disabled = false;
        if (btnText) btnText.textContent = "SUBMIT REPAIR FEEDBACK";
    }
}


// ============================================================
// LOADING
// ============================================================

function setLoading(loading) {

    const loader = $("loading");

    const button =
        document.querySelector(".analyze-button");

    const buttonText =
        $("buttonText");


    if (loader) {

        loader.classList.toggle(
            "hidden",
            !loading
        );

    }


    if (button) {

        button.disabled = loading;

    }


    if (buttonText) {

        buttonText.textContent =
            loading
                ? "ANALYZING..."
                : "ANALYZE INCIDENT";

    }
}


// ============================================================
// DISPLAY MAIN RESULTS
// ============================================================

function displayResults(data) {

    const results =
        $("resultsSection");


    if (results) {

        results.classList.remove(
            "hidden"
        );

    }


    const incident =
        data.incident || {};


    const similar =
        (data.similarity && Array.isArray(data.similarity.top_cases))
            ? data.similarity.top_cases
            : [];


    const service = []; // Service history records are not provided in array form from the ML backend


    const rag =
        (data.rag && Array.isArray(data.rag.exact_dtc_matches))
            ? data.rag.exact_dtc_matches
            : [];


    // --------------------------------------------------------
    // HYPOTHESIS
    // --------------------------------------------------------

    const hypothesisList = $("hypothesisList");
    if (hypothesisList) {
        if (Array.isArray(data.investigation_leads) && data.investigation_leads.length > 0) {
            hypothesisList.innerHTML = data.investigation_leads.map(lead => `<li style="margin-bottom: 8px;">${safe(lead)}</li>`).join("");
        } else {
            hypothesisList.innerHTML = `<li>No investigation leads available from pipeline.</li>`;
        }
    }
    
    const evidenceSummaryList = $("evidenceSummaryList");
    if (evidenceSummaryList) {
        if (Array.isArray(data.evidence_summary) && data.evidence_summary.length > 0) {
            evidenceSummaryList.innerHTML = data.evidence_summary.map(item => `<li style="margin-bottom: 8px;">${safe(item)}</li>`).join("");
        } else {
            evidenceSummaryList.innerHTML = `<li>No evidence summary available.</li>`;
        }
    }


    // --------------------------------------------------------
    // STATISTICS
    // --------------------------------------------------------


    setText(
        "similarCount",
        similar.length
    );


    setText(
        "serviceEvidenceCount",
        "N/A"
    );


    setText(
        "resolvedCount",
        "N/A"
    );


    const similarity =
        percent(
            data.similarity ? data.similarity.top_score : 0
        );


    setText(
        "avgSimilarity",
        similarity.toFixed(1) + "%"
    );


    // --------------------------------------------------------
    // RENDER
    // --------------------------------------------------------

    renderSimilarCases(similar);

    // We can show the reason if available
    renderServiceHistory(data.service_history);

    renderRAG(data.rag);

    renderAnomalies(data.anomaly);

    // Populate Technician Feedback form
    if ($("feedbackSection")) {
        $("feedbackVehicleId").textContent = data.incident?.vehicle_id || data.vehicle_id || "";
        $("feedbackVehicleModel").textContent = data.incident?.vehicle_model || "";
        $("feedbackMileage").textContent = data.incident?.mileage || "";
        $("feedbackDtcCode").textContent = data.incident?.dtc_code || "";
        
        $("feedbackActualRepair").value = "";
        $("feedbackOutcome").value = "";
        
        const statusText = $("feedbackStatusText");
        if (statusText) {
            statusText.textContent = "Record technician feedback after completing the repair.";
            statusText.style.color = "#94a8bb";
        }
        
        const btn = $("submitFeedbackBtn");
        if (btn) btn.disabled = false;
        
        const btnText = $("feedbackBtnText");
        if (btnText) btnText.textContent = "SUBMIT REPAIR FEEDBACK";
    }

}


// ============================================================
// SET TEXT
// ============================================================

function setText(id, text) {

    document
        .querySelectorAll(`#${id}`)
        .forEach(el => {

            el.textContent =
                text ?? "";

        });
}


// ============================================================
// SIMILAR CASES
// ============================================================

function renderSimilarCases(cases) {
    const table = $("similarCasesTable");
    if (!table) return;

    table.innerHTML = "";
    if (!cases.length) {
        table.innerHTML = `<tr><td colspan="3">No similar historical cases found.</td></tr>`;
        return;
    }

    cases.slice(0, 10).forEach((item, index) => {
        const similarityVal = percent(get(item, ["similarity_score", "similarity"], 0));
        const recordId = get(item, ["record_id", "id", "historical_index"], index + 1);
        const dtc = get(item, ["dtc_signature", "dtc_code", "dtc"], "N/A");

        const row = document.createElement("tr");
        row.innerHTML = `
            <td>Case #${safe(recordId)}</td>
            <td>${safe(dtc)}</td>
            <td><strong>${similarityVal.toFixed(1)}%</strong></td>
        `;
        table.appendChild(row);
    });
}

// ============================================================
// SERVICE HISTORY
// ============================================================

function renderServiceHistory(serviceData) {

    const table =
        $("serviceHistoryTable");


    if (!table) return;


    table.innerHTML = "";


    if (!serviceData || !serviceData.available) {

        table.innerHTML = `
            <tr>
                <td colspan="7">
                    ${safe(serviceData ? serviceData.reason : "No service history found.")}
                </td>
            </tr>
        `;

        return;
    }

    const records = serviceData.records || [];

    if (!records.length) {

        table.innerHTML = `
            <tr>
                <td colspan="7">
                    No service history records available.
                </td>
            </tr>
        `;

        return;
    }


    records
        .slice(0, 10)
        .forEach((item, index) => {

            const row =
                document.createElement("tr");


            row.innerHTML = `

                <td>
                    ${safe(
                        get(
                            item,
                            [
                                "service_id",
                                "record_id",
                                "id"
                            ],
                            index + 1
                        )
                    )}
                </td>

                <td>
                    ${safe(
                        get(
                            item,
                            ["vehicle_id"],
                            "-"
                        )
                    )}
                </td>

                <td>
                    ${safe(
                        get(
                            item,
                            ["dtc_code"],
                            "-"
                        )
                    )}
                </td>

                <td>
                    ${safe(
                        get(
                            item,
                            [
                                "repair_action",
                                "action"
                            ],
                            "-"
                        )
                    )}
                </td>

                <td>
                    ${safe(
                        get(
                            item,
                            [
                                "repair_outcome",
                                "outcome"
                            ],
                            "-"
                        )
                    )}
                </td>

                <td>
                    ${safe(
                        get(
                            item,
                            ["downtime_hours"],
                            "-"
                        )
                    )}
                </td>

                <td>
                    ${safe(
                        get(
                            item,
                            [
                                "service_note",
                                "notes"
                            ],
                            "-"
                        )
                    )}
                </td>

            `;


            table.appendChild(row);

        });
}


// ============================================================
// RAG
// ============================================================

function renderRAG(ragData) {
    const exactContainer = $("ragExactMatches");
    const semanticContainer = $("ragSemanticMatches");
    if (!exactContainer || !semanticContainer) return;

    exactContainer.innerHTML = "";
    semanticContainer.innerHTML = "";

    const exact = (ragData && Array.isArray(ragData.exact_dtc_matches)) ? ragData.exact_dtc_matches : [];
    const semantic = (ragData && Array.isArray(ragData.semantic_matches)) ? ragData.semantic_matches : [];

    const renderCard = (item) => {
        const dtc = get(item, ["DTC_code", "dtc"], "");
        const title = get(item, ["title", "name"], "Knowledge Evidence");
        const desc = get(item, ["description", "text", "content"], "");
        const component = get(item, ["affected_components"], []).join(", ") || "Unknown";
        const causes = get(item, ["common_causes"], []).join(", ") || "Unknown";

        return `
            <div class="rag-case-card" style="margin-bottom: 0;">
                <div class="rag-case-top">
                    <div class="rag-case-title">
                        <span class="rag-badge">${safe(dtc)}</span>
                        <strong>${safe(title)}</strong>
                    </div>
                </div>
                <p style="color: #d9e3ed; font-size: 13px; margin: 8px 0;">${safe(desc)}</p>
                <div class="rag-case-grid" style="grid-template-columns: 1fr 1fr; margin-top: 12px;">
                    <div>
                        <span class="rag-label">Affected Components</span>
                        <strong>${safe(component)}</strong>
                    </div>
                    <div>
                        <span class="rag-label">Common Causes</span>
                        <strong>${safe(causes)}</strong>
                    </div>
                </div>
            </div>
        `;
    };

    if (exact.length === 0) {
        exactContainer.innerHTML = `<div class="empty-state">No exact DTC matches found.</div>`;
    } else {
        exactContainer.innerHTML = exact.map(renderCard).join("");
    }

    if (semantic.length === 0) {
        semanticContainer.innerHTML = `<div class="empty-state">No semantic matches found.</div>`;
    } else {
        semanticContainer.innerHTML = semantic.map(renderCard).join("");
    }
}

// ============================================================
// ANOMALY SECTION
// ============================================================

function createAnomalySection() { return $("anomalySection"); }

// ============================================================
// RENDER ANOMALIES
// ============================================================

function renderAnomalies(anomalyData) {
    const section = $("anomalySection");
    if (!section) return;
    
    if (!anomalyData) {
        section.classList.add("hidden");
        return;
    }
    
    section.classList.remove("hidden");

    const isAnomaly = anomalyData.anomaly ? "ANOMALY DETECTED" : "NORMAL";
    const score = (anomalyData.anomaly_score || 0).toFixed(4);
    const severity = (anomalyData.severity || "unknown").toUpperCase();
    const features = anomalyData.feature_contributions || [];

    let featuresHtml = "";
    if (features.length === 0) {
        featuresHtml = `<div class="empty-state">No significant feature deviations detected.</div>`;
    } else {
        featuresHtml = `
            <table class="data-table" style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                <thead>
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); text-align: left;">
                        <th style="padding: 10px; color: #94a8bb;">Sensor</th>
                        <th style="padding: 10px; color: #94a8bb;">Raw Value</th>
                        <th style="padding: 10px; color: #94a8bb;">Deviation</th>
                    </tr>
                </thead>
                <tbody>
                    ${features.map(f => `
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                            <td style="padding: 10px;"><strong>${safe(f.feature)}</strong></td>
                            <td style="padding: 10px;">${safe(f.raw_value)}</td>
                            <td style="padding: 10px; color: #ffaa32;">${Number(f.deviation_magnitude).toFixed(4)}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        `;
    }

    section.innerHTML = `
        <div class="panel-header">
            <div>
                <span class="section-label">AI • ANOMALY DETECTION</span>
                <h2>Fleet Anomalies & Unusual Patterns</h2>
            </div>
        </div>

        <div class="anomaly-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 20px;">
            <div class="anomaly-card" style="background: rgba(15, 30, 48, 0.75); border: 1px solid rgba(100, 180, 255, 0.15); border-radius: 14px; padding: 18px;">
                <span style="color: #9caec2; font-size: 13px; display: block; margin-bottom: 5px;">Status</span>
                <strong style="font-size: 20px; color: ${anomalyData.anomaly ? '#ff5050' : '#57e0b1'};">${isAnomaly}</strong>
            </div>
            <div class="anomaly-card" style="background: rgba(15, 30, 48, 0.75); border: 1px solid rgba(100, 180, 255, 0.15); border-radius: 14px; padding: 18px;">
                <span style="color: #9caec2; font-size: 13px; display: block; margin-bottom: 5px;">Anomaly Score</span>
                <strong style="font-size: 20px; color: #55d6ff;">${score}</strong>
            </div>
            <div class="anomaly-card" style="background: rgba(15, 30, 48, 0.75); border: 1px solid rgba(100, 180, 255, 0.15); border-radius: 14px; padding: 18px;">
                <span style="color: #9caec2; font-size: 13px; display: block; margin-bottom: 5px;">Severity</span>
                <strong style="font-size: 20px; color: #fff;">${severity}</strong>
            </div>
        </div>

        <div style="margin-top: 25px;">
            <h3 style="color: #55d6ff; font-size: 14px; margin-bottom: 10px;">FEATURE CONTRIBUTIONS</h3>
            ${featuresHtml}
        </div>
    `;
}

// ============================================================
// ANOMALY LIST
// ============================================================

function renderAnomalyList(
    elementId,
    records,
    type
) {

    const container =
        $(elementId);


    if (!container) return;


    if (
        !Array.isArray(records) ||
        records.length === 0
    ) {

        container.innerHTML = `

            <div class="anomaly-empty">

                <strong>
                    No anomalies detected
                </strong>

                <p>
                    No unusual patterns were returned
                    by the anomaly engine.
                </p>

            </div>

        `;

        return;
    }


    container.innerHTML =
        records
            .slice(0, 10)
            .map(
                (item, index) =>
                    anomalyCard(
                        item,
                        index,
                        type
                    )
            )
            .join("");
}


// ============================================================
// ANOMALY CARD
// ============================================================

function anomalyCard(
    item,
    index,
    type
) {

    let title =
        "Anomaly";


    if (type === "vehicle") {

        title =
            "Unusual Vehicle Event";

    }

    if (type === "fleet") {

        title =
            "Fleet DTC Spike";

    }

    if (type === "combination") {

        title =
            "Uncommon DTC + Vehicle";

    }


    const vehicle =
        get(
            item,
            [
                "vehicle_id",
                "vehicle",
                "vehicleId"
            ],
            "-"
        );


    const model =
        get(
            item,
            [
                "vehicle_model",
                "model",
                "vehicleModel"
            ],
            "-"
        );


    const dtc =
        get(
            item,
            [
                "dtc_code",
                "dtc",
                "fault_code",
                "faultCode"
            ],
            "-"
        );


    const reason =
        get(
            item,
            [
                "reason",
                "description",
                "message",
                "explanation",
                "finding",
                "details"
            ],
            "Unusual pattern detected."
        );


    const score =
        get(
            item,
            [
                "anomaly_score",
                "score",
                "confidence"
            ],
            ""
        );


    const count =
        get(
            item,
            [
                "count",
                "frequency",
                "occurrences",
                "occurrence_count"
            ],
            ""
        );


    return `

        <div class="anomaly-card">

            <div class="anomaly-card-header">

                <div>

                    <span class="anomaly-index">
                        #${index + 1}
                    </span>

                    <strong>
                        ${safe(title)}
                    </strong>

                </div>

            </div>


            <div class="anomaly-card-grid">

                <div>

                    <span class="anomaly-field-label">
                        Vehicle
                    </span>

                    <strong>
                        ${safe(vehicle)}
                    </strong>

                </div>


                <div>

                    <span class="anomaly-field-label">
                        Model
                    </span>

                    <strong>
                        ${safe(model)}
                    </strong>

                </div>


                <div>

                    <span class="anomaly-field-label">
                        DTC
                    </span>

                    <strong>
                        ${safe(dtc)}
                    </strong>

                </div>


                ${
                    count !== ""
                        ? `
                            <div>

                                <span class="anomaly-field-label">
                                    Frequency
                                </span>

                                <strong>
                                    ${safe(count)}
                                </strong>

                            </div>
                        `
                        : ""
                }

            </div>


            ${
                score !== ""
                    ? `
                        <p>
                            <strong>
                                Anomaly Score:
                            </strong>

                            ${safe(score)}
                        </p>
                    `
                    : ""
            }


            <div class="anomaly-reason">

                <span class="anomaly-field-label">
                    Why it was flagged
                </span>

                <p>
                    ${safe(reason)}
                </p>

            </div>

        </div>
    `;
}


// ============================================================
// ANOMALY ERROR
// ============================================================

function renderAnomalyError(message) {

    const html = `

        <div class="anomaly-error">

            <strong>
                Anomaly detection unavailable
            </strong>

            <p>
                ${safe(message)}
            </p>

            <small>
                Make sure your FastAPI backend contains
                the /anomalies endpoint.
            </small>

        </div>
    `;


    [
        "vehicleAnomaliesList",
        "fleetSpikesList",
        "combinationAnomaliesList"
    ].forEach(id => {

        const el = $(id);

        if (el) {

            el.innerHTML = html;

        }

    });


    setText(
        "vehicleAnomalyCount",
        "—"
    );


    setText(
        "fleetSpikeCount",
        "—"
    );


    setText(
        "combinationAnomalyCount",
        "—"
    );
}


// ============================================================
// BACKEND STATUS
// ============================================================

async function checkBackend() {
    try {
        const response = await fetch(`${API_URL}/health`);
        if (response.ok) {
            console.log("Backend connected.");
        }
        return true;
    } catch (error) {
        console.error("Backend offline:", error);
        return false;
    }
}


// ============================================================
// LOCAL HYPOTHESIS
// ============================================================

function buildHypothesis(
    incident,
    similar,
    service
) {

    const dtc =
        incident.dtc_code ||
        "the selected DTC";


    const symptom =
        incident.symptom ||
        "the reported symptom";


    let text =
        `Historical ${dtc} incidents with similar operating conditions were found across the fleet.`;


    text +=
        ` The historical records were reviewed for the symptom "${symptom}".`;


    if (service.length) {

        const actions = {};


        service.forEach(item => {

            const action =
                get(
                    item,
                    [
                        "repair_action",
                        "action"
                    ],
                    "No repair"
                );


            actions[action] =
                (actions[action] || 0) + 1;

        });


        const top =
            Object.entries(actions)
                .sort(
                    (a, b) =>
                        b[1] - a[1]
                )[0];


        if (top) {

            text +=
                ` The most common historical repair action was "${top[0]}" in ${top[1]} case(s).`;

        }

    }


    text +=
        " This evidence should be used as an investigation lead before deciding on a repair.";


    return text;
}


// ============================================================
// RESOLVED COUNT
// ============================================================

function countResolved(records) {

    return records.filter(item => {

        const outcome =
            String(
                get(
                    item,
                    [
                        "repair_outcome",
                        "outcome"
                    ],
                    ""
                )
            ).toLowerCase();


        return outcome.includes(
            "resolved"
        );

    }).length;
}


// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        console.log(
            "SyntaxSquad frontend loaded."
        );


        // createAnomalySection();


        await checkBackend();

    }
);


// ============================================================
// GLOBAL FUNCTIONS
// ============================================================

window.analyzeIncident = analyzeIncident;
window.checkBackend = checkBackend;

window.checkBackend =
    checkBackend;

window.createAnomalySection =
    createAnomalySection;

window.renderAnomalies =
    renderAnomalies;
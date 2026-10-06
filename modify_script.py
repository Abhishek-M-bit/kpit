import re
import sys

def modify_script():
    with open('script.js', 'r', encoding='utf-8') as f:
        js = f.read()

    # 1. Update Hypothesis rendering in displayResults
    js = js.replace('''    const hypothesis =
        (Array.isArray(data.investigation_leads) && data.investigation_leads.length > 0)
            ? data.investigation_leads.join(" ")
            : "No investigation leads available from pipeline.";


    if ($("hypothesisText")) {

        $("hypothesisText").textContent =
            hypothesis;

    }''', '''    const hypothesisList = $("hypothesisList");
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
    }''')

    # 2. Update Feedback fields to use textContent instead of value for the read-only divs
    js = js.replace('''        $("feedbackVehicleId").value = data.incident?.vehicle_id || data.vehicle_id || "";
        $("feedbackVehicleModel").value = data.incident?.vehicle_model || "";
        $("feedbackMileage").value = data.incident?.mileage || "";
        $("feedbackDtcCode").value = data.incident?.dtc_code || "";''', 
'''        $("feedbackVehicleId").textContent = data.incident?.vehicle_id || data.vehicle_id || "";
        $("feedbackVehicleModel").textContent = data.incident?.vehicle_model || "";
        $("feedbackMileage").textContent = data.incident?.mileage || "";
        $("feedbackDtcCode").textContent = data.incident?.dtc_code || "";''')
        
    js = js.replace('''        vehicle_model: $("feedbackVehicleModel").value || "Unknown",
        mileage: Number($("feedbackMileage").value) || 0,
        dtc_code: $("feedbackDtcCode").value || "Unknown",''',
'''        vehicle_model: $("feedbackVehicleModel").textContent || "Unknown",
        mileage: Number($("feedbackMileage").textContent) || 0,
        dtc_code: $("feedbackDtcCode").textContent || "Unknown",''')

    # 3. Update Similar Cases rendering (columns: Historical Case | DTC Signature | Similarity)
    js = re.sub(r'function renderSimilarCases\(cases\) \{.*?(?=\n// ============================================================)', 
'''function renderSimilarCases(cases) {
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
''', js, flags=re.DOTALL)

    # 4. Update RAG rendering
    js = re.sub(r'function renderRAG\(records\) \{.*?(?=\n// ============================================================)',
'''function renderRAG(ragData) {
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
''', js, flags=re.DOTALL)

    # 5. RAG render call change
    js = js.replace('renderRAG(rag);', 'renderRAG(data.rag);')

    # 6. Update Anomaly rendering (Sensor | Raw Value | Deviation)
    js = re.sub(r'function renderAnomalies\(anomalyData\) \{.*?(?=\n// ============================================================)',
'''function renderAnomalies(anomalyData) {
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
''', js, flags=re.DOTALL)

    # 7. Don't create anomaly detection section dynamically anymore
    js = js.replace('createAnomalySection();', '// createAnomalySection();')
    js = js.replace('''function createAnomalySection() {
    const results = $("resultsSection");
    if (!results) return null;

    let section = $("anomalyDetectionSection");
    if (section) return section;

    section = document.createElement("section");
    section.id = "anomalyDetectionSection";
    section.className = "anomaly-detection-section";
    
    // We will populate innerHTML later during renderAnomalies
    results.appendChild(section);
    return section;
}''', 'function createAnomalySection() { return $("anomalySection"); }')

    with open('script.js', 'w', encoding='utf-8') as f:
        f.write(js)
        
    print("Updated script.js")

if __name__ == '__main__':
    modify_script()

import re
import sys

def process():
    with open('index (3).html', 'r', encoding='utf-8') as f:
        html = f.read()

    # We want to re-order the resultsSection.
    # The current order is: Hypothesis -> Result Cards -> Similar Cases -> Service History -> RAG -> Anomaly -> Feedback -> Disclaimer.
    # Let's extract the results section.
    start_str = '<section\n            id="resultsSection"\n            class="hidden"\n        >'
    start_idx = html.find(start_str)
    if start_idx == -1:
        print("Could not find resultsSection")
        return
        
    start_idx += len(start_str)
    
    end_str = '\n        </section>\n\n        </div>'
    end_idx = html.find(end_str, start_idx)
    
    if end_idx == -1:
        print("Could not find end of resultsSection")
        return

    inner_html = html[start_idx:end_idx]
    
    # Let's define the new inner HTML. We can just keep the structure and rewrite it with the new layout requested.
    new_inner_html = """
            <!-- =============================================
                 INVESTIGATION LEAD
            ============================================== -->
            <div class="panel hypothesis-panel">
                <div class="panel-header">
                    <div>
                        <span class="section-label">AI INVESTIGATION LEAD</span>
                        <h2>Investigation Hypothesis</h2>
                    </div>
                    <div class="confidence">[Evidence Based]</div>
                </div>
                <div class="hypothesis-content">
                    <div class="hypothesis-icon">AI</div>
                    <div>
                        <ul id="hypothesisList" style="margin: 0; padding-left: 20px; color: #d9e3ed; font-size: 15px; line-height: 1.5;">
                            <!-- populated by js -->
                        </ul>
                        <div class="disclaimer" style="margin-top: 15px;">
                            ⚠ This is an evidence-based investigation lead, not a confirmed diagnosis.
                        </div>
                    </div>
                </div>
            </div>

            <!-- =============================================
                 DIAGNOSTIC SUMMARY CARDS
            ============================================== -->
            <div class="result-grid" style="margin-top: 24px;">
                <div class="result-card">
                    <span class="result-number" id="similarCount">0</span>
                    <span>Historical Matches</span>
                </div>
                <div class="result-card">
                    <span class="result-number" id="avgSimilarity">0%</span>
                    <span>Top Similarity Score</span>
                </div>
                <div class="result-card">
                    <span class="result-number" id="serviceEvidenceCount">0</span>
                    <span>Service Evidence</span>
                </div>
                <div class="result-card">
                    <span class="result-number" id="resolvedCount">0</span>
                    <span>Resolved Cases</span>
                </div>
            </div>

            <!-- =============================================
                 SIMILAR CASES
            ============================================== -->
            <div class="panel" style="margin-top: 24px;">
                <div class="panel-header">
                    <div>
                        <span class="section-label">HISTORICAL EVIDENCE</span>
                        <h2>Similar Historical Incidents</h2>
                    </div>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Historical Case</th>
                                <th>DTC Signature</th>
                                <th>Similarity</th>
                            </tr>
                        </thead>
                        <tbody id="similarCasesTable">
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- =============================================
                 ANOMALY DETECTION
            ============================================== -->
            <section id="anomalySection" class="panel anomaly-panel hidden" style="margin-top: 24px;">
                <!-- Populated by JS -->
            </section>

            <!-- =============================================
                 RAG EVIDENCE
            ============================================== -->
            <section id="ragEvidenceContainer" class="panel" style="margin-top: 24px; background: rgba(7, 20, 35, 0.8); border-radius: 16px; border: 1px solid rgba(70, 180, 255, 0.14);">
                <div class="panel-header">
                    <div>
                        <span class="section-label">RAG / DIAGNOSTIC KNOWLEDGE</span>
                        <h2>Diagnostic Reference Knowledge</h2>
                    </div>
                </div>
                <div style="padding: 20px;">
                    <h3 style="color: #55d6ff; margin-bottom: 10px; font-size: 14px;">Exact DTC Matches</h3>
                    <div id="ragExactMatches" style="display: grid; grid-template-columns: 1fr; gap: 15px; margin-bottom: 20px;">
                        <!-- populated by js -->
                    </div>
                    
                    <h3 style="color: #55d6ff; margin-bottom: 10px; font-size: 14px;">Semantic Matches</h3>
                    <div id="ragSemanticMatches" style="display: grid; grid-template-columns: 1fr; gap: 15px;">
                        <!-- populated by js -->
                    </div>
                </div>
            </section>

            <!-- =============================================
                 EVIDENCE SUMMARY
            ============================================== -->
            <section class="panel" style="margin-top: 24px;">
                <div class="panel-header">
                    <div>
                        <span class="section-label">EVIDENCE SUMMARY</span>
                        <h2>Evidence Summary</h2>
                    </div>
                </div>
                <div style="padding: 20px;">
                    <ul id="evidenceSummaryList" style="margin: 0; padding-left: 20px; color: #d9e3ed; line-height: 1.6; display: grid; gap: 10px;">
                        <!-- populated by js -->
                    </ul>
                </div>
            </section>
            
            <!-- =============================================
                 SERVICE HISTORY
            ============================================== -->
            <div class="panel" style="margin-top: 24px;">
                <div class="panel-header">
                    <div>
                        <span class="section-label">SERVICE HISTORY</span>
                        <h2>Previous Repairs & Outcomes</h2>
                    </div>
                </div>
                <div class="service-list" id="serviceHistoryList">
                </div>
            </div>

            <!-- =============================================
                 TECHNICIAN FEEDBACK
            ============================================== -->
            <section id="feedbackSection" class="panel" style="margin-top: 24px; border: 1px solid rgba(100, 200, 255, 0.2);">
                <div class="panel-header">
                    <div>
                        <span class="section-label" style="color: #55d6ff;">ACTIVE LEARNING</span>
                        <h2>Technician Repair Feedback</h2>
                        <p id="feedbackStatusText" style="color: #94a8bb;">Record technician feedback after completing the repair.</p>
                    </div>
                </div>

                <div class="form-grid" style="margin-top: 20px;">
                    <div class="input-group">
                        <label>Vehicle ID</label>
                        <div id="feedbackVehicleId" style="padding: 12px; background: rgba(0,0,0,0.3); color: #8da2b6; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);"></div>
                    </div>
                    <div class="input-group">
                        <label>Vehicle Model</label>
                        <div id="feedbackVehicleModel" style="padding: 12px; background: rgba(0,0,0,0.3); color: #8da2b6; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);"></div>
                    </div>
                    <div class="input-group">
                        <label>Mileage (km)</label>
                        <div id="feedbackMileage" style="padding: 12px; background: rgba(0,0,0,0.3); color: #8da2b6; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);"></div>
                    </div>
                    <div class="input-group">
                        <label>DTC Code</label>
                        <div id="feedbackDtcCode" style="padding: 12px; background: rgba(0,0,0,0.3); color: #8da2b6; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);"></div>
                    </div>
                    
                    <div class="input-group" style="grid-column: span 2;">
                        <label>Actual Repair Performed <span style="color: #ff5050;">*</span></label>
                        <input type="text" id="feedbackActualRepair" placeholder="e.g. Replaced O2 Sensor">
                    </div>
                    
                    <div class="input-group" style="grid-column: span 2;">
                        <label>Outcome <span style="color: #ff5050;">*</span></label>
                        <select id="feedbackOutcome">
                            <option value="">Select Outcome...</option>
                            <option value="Resolved">Resolved</option>
                            <option value="Partially Resolved">Partially Resolved</option>
                            <option value="Not Resolved">Not Resolved</option>
                            <option value="Unable to Diagnose">Unable to Diagnose</option>
                        </select>
                    </div>
                </div>

                <button class="analyze-button" id="submitFeedbackBtn" onclick="submitRepairFeedback()" style="margin-top: 20px; background: linear-gradient(135deg, #0f62fe, #0a4ebd);">
                    <span id="feedbackBtnIcon">✓</span>
                    <span id="feedbackBtnText">SUBMIT REPAIR FEEDBACK</span>
                </button>
            </section>

            <!-- =============================================
                 HUMAN VERIFICATION NOTICE
            ============================================== -->
            <div class="final-note" style="margin-top: 24px; padding: 20px; border-left: 4px solid #ffaa32; background: rgba(255, 170, 50, 0.1);">
                <strong style="color: #ffaa32; font-size: 16px;">
                    ⚠ Human Verification Required
                </strong>
                <p style="margin-top: 8px; color: #d9e3ed; font-size: 14px;">
                    SyntaxSquad provides evidence-based investigation
                    leads from historical fleet data. Final diagnosis
                    and repair decisions must be performed by a
                    qualified mechanic or engineer.
                </p>
            </div>
"""

    new_html = html[:start_idx] + new_inner_html + html[end_idx:]
    with open('index (3).html', 'w', encoding='utf-8') as f:
        f.write(new_html)
        
    print("Updated index (3).html")

if __name__ == '__main__':
    process()

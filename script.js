// ============================================================
// SYNTAXSQUAD ROOT-CAUSE EXPLORER
// COMPLETE FRONTEND SCRIPT
// Similarity + Service History + RAG + Anomaly Detection
// ============================================================

const API_URL = "http://127.0.0.1:8000";


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

        vehicle_model:
            value("vehicleModel", "Truck_X"),

        dtc_code:
            value("dtcCode", "P0420"),

        odometer_km:
            number("odometer", 82450),

        engine_rpm:
            number("engineRpm", 2200),

        vehicle_speed_kmph:
            number("vehicleSpeed", 55),

        engine_load_pct:
            number("engineLoad", 78),

        coolant_temp_c:
            number("coolantTemp", 98),

        intake_air_temp_c: 34,

        map_kpa: 73,

        maf_gps: 42,

        throttle_position_pct: 43,

        fuel_pressure_kpa: 350,

        stft_bank1_pct: 5,

        ltft_bank1_pct: 11,

        stft_bank2_pct: 4,

        ltft_bank2_pct: 10,

        o2_b1s1_v: 0.65,

        o2_b1s2_v: 0.60,

        o2_b2s1_v: 0.64,

        o2_b2s2_v: 0.59,

        timing_advance_deg: 18,

        battery_voltage_v: 13.8,

        engine_runtime_sec: 4200,

        fuel_level_pct: 55,

        ambient_temp_c: 30,

        symptom:
            value("symptom", "Low engine power")
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

            throw new Error(
                `Backend error: ${response.status}`
            );
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


        displayResults(data);


        // Load anomaly detection separately
        await loadAnomalies();

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
        data.current_incident || {};


    const similar =
        Array.isArray(data.similar_cases)
            ? data.similar_cases
            : [];


    const service =
        Array.isArray(data.service_history)
            ? data.service_history
            : [];


    const rag =
        Array.isArray(data.rag_evidence)
            ? data.rag_evidence
            : [];


    // --------------------------------------------------------
    // HYPOTHESIS
    // --------------------------------------------------------

    const hypothesis =
        data.hypothesis ||
        buildHypothesis(
            incident,
            similar,
            service
        );


    if ($("hypothesisText")) {

        $("hypothesisText").textContent =
            hypothesis;

    }


    // --------------------------------------------------------
    // STATISTICS
    // --------------------------------------------------------

    const stats =
        data.statistics || {};


    setText(
        "similarCount",
        stats.similar_cases ??
        similar.length
    );


    setText(
        "serviceEvidenceCount",
        stats.service_cases ??
        service.length
    );


    setText(
        "resolvedCount",
        stats.resolved_cases ??
        countResolved(service)
    );


    const similarity =
        percent(
            stats.average_similarity || 0
        );


    setText(
        "avgSimilarity",
        similarity.toFixed(1) + "%"
    );


    // --------------------------------------------------------
    // RENDER
    // --------------------------------------------------------

    renderSimilarCases(similar);

    renderServiceHistory(service);

    renderRAG(rag);


    // Create anomaly section
    createAnomalySection();

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

    const table =
        $("similarCasesTable");


    if (!table) return;


    table.innerHTML = "";


    if (!cases.length) {

        table.innerHTML = `
            <tr>
                <td colspan="6">
                    No similar historical cases found.
                </td>
            </tr>
        `;

        return;
    }


    cases
        .slice(0, 10)
        .forEach((item, index) => {

            const similarity =
                percent(
                    get(
                        item,
                        [
                            "similarity_score",
                            "similarity"
                        ],
                        0
                    )
                );


            const row =
                document.createElement("tr");


            row.innerHTML = `

                <td>
                    ${safe(
                        get(
                            item,
                            ["record_id", "id"],
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
                            ["vehicle_model"],
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
                            ["symptom", "complaint"],
                            "-"
                        )
                    )}
                </td>

                <td>
                    <strong>
                        ${similarity.toFixed(1)}%
                    </strong>
                </td>

            `;


            table.appendChild(row);

        });
}


// ============================================================
// SERVICE HISTORY
// ============================================================

function renderServiceHistory(records) {

    const table =
        $("serviceHistoryTable");


    if (!table) return;


    table.innerHTML = "";


    if (!records.length) {

        table.innerHTML = `
            <tr>
                <td colspan="7">
                    No service history found.
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

function renderRAG(records) {

    const container =
        $("ragEvidence");


    if (!container) return;


    container.innerHTML = "";


    if (!records.length) {

        container.innerHTML = `
            <div class="empty-state">
                No additional knowledge evidence found.
            </div>
        `;

        return;
    }


    records
        .slice(0, 8)
        .forEach(item => {

            const card =
                document.createElement("div");


            card.className =
                "rag-card";


            card.innerHTML = `

                <h4>
                    ${safe(
                        get(
                            item,
                            [
                                "title",
                                "topic",
                                "name"
                            ],
                            "Knowledge Evidence"
                        )
                    )}
                </h4>

                <p>
                    ${safe(
                        get(
                            item,
                            [
                                "text",
                                "content",
                                "description",
                                "evidence"
                            ],
                            ""
                        )
                    )}
                </p>

            `;


            container.appendChild(card);

        });
}


// ============================================================
// ANOMALY SECTION
// ============================================================

function createAnomalySection() {

    const results =
        $("resultsSection");


    if (!results) return null;


    let section =
        $("anomalyDetectionSection");


    if (section) {

        return section;

    }


    section =
        document.createElement("section");


    section.id =
        "anomalyDetectionSection";


    section.className =
        "anomaly-detection-section";


    section.innerHTML = `

        <div class="anomaly-title-area">

            <div class="anomaly-label">
                AI • ANOMALY DETECTION
            </div>

            <h2>
                Fleet Anomalies & Unusual Patterns
            </h2>

            <p>
                Detect unusual vehicle behavior,
                DTC spikes and uncommon combinations.
            </p>

        </div>


        <div class="anomaly-summary-grid">

            <div class="anomaly-summary-card">

                <div
                    class="anomaly-number"
                    id="vehicleAnomalyCount"
                >
                    0
                </div>

                <div class="anomaly-name">
                    Vehicle Anomalies
                </div>

            </div>


            <div class="anomaly-summary-card">

                <div
                    class="anomaly-number"
                    id="fleetSpikeCount"
                >
                    0
                </div>

                <div class="anomaly-name">
                    Fleet DTC Spikes
                </div>

            </div>


            <div class="anomaly-summary-card">

                <div
                    class="anomaly-number"
                    id="combinationAnomalyCount"
                >
                    0
                </div>

                <div class="anomaly-name">
                    Uncommon Combinations
                </div>

            </div>

        </div>


        <div class="anomaly-group">

            <div class="anomaly-section-label">
                VEHICLE-LEVEL ANOMALIES
            </div>

            <h3>
                Unusual Vehicle Events
            </h3>

            <div
                id="vehicleAnomaliesList"
                class="anomaly-list"
            >
                Loading...
            </div>

        </div>


        <div class="anomaly-group">

            <div class="anomaly-section-label">
                FLEET-LEVEL PATTERNS
            </div>

            <h3>
                DTC Spike Detection
            </h3>

            <div
                id="fleetSpikesList"
                class="anomaly-list"
            >
                Loading...
            </div>

        </div>


        <div class="anomaly-group">

            <div class="anomaly-section-label">
                RELATIONSHIP ANOMALIES
            </div>

            <h3>
                Uncommon DTC + Vehicle Combinations
            </h3>

            <div
                id="combinationAnomaliesList"
                class="anomaly-list"
            >
                Loading...
            </div>

        </div>


        <div class="anomaly-help">

            <strong>
                How anomaly detection helps
            </strong>

            <p>
                The system highlights unusual patterns
                that may deserve engineering investigation.
                An anomaly does not automatically mean
                a component has failed.
            </p>

        </div>


        <div class="anomaly-human-check">

            <strong>
                Human Verification Required
            </strong>

            <p>
                SyntaxSquad provides evidence-based
                investigation leads from historical fleet
                data. Final diagnosis and repair decisions
                must be performed by a qualified mechanic
                or engineer.
            </p>

        </div>
    `;


    // ========================================================
    // IMPORTANT FIX
    // Never use insertBefore() here.
    // appendChild is safe and removes the previous DOM error.
    // ========================================================

    results.appendChild(section);


    return section;
}


// ============================================================
// LOAD ANOMALIES
// ============================================================

async function loadAnomalies() {

    createAnomalySection();


    try {

        console.log(
            "Loading /anomalies..."
        );


        const response =
            await fetch(
                `${API_URL}/anomalies`
            );


        if (!response.ok) {

            throw new Error(
                `/anomalies returned HTTP ${response.status}`
            );

        }


        const raw =
            await response.json();


        console.log(
            "ANOMALY RESPONSE:",
            raw
        );


        if (raw.status === "error") {

            throw new Error(
                raw.message ||
                "Anomaly backend error"
            );

        }


        const data =
            raw.data ||
            raw.result ||
            raw;


        renderAnomalies(data);

    }

    catch (error) {

        console.error(
            "Anomaly detection error:",
            error
        );


        renderAnomalyError(
            error.message
        );

    }
}


// ============================================================
// FIND ARRAY
// ============================================================

function findArray(data, names) {

    if (!data || typeof data !== "object") {

        return [];

    }


    for (const name of names) {

        if (Array.isArray(data[name])) {

            return data[name];

        }

    }


    for (const key of Object.keys(data)) {

        const nested =
            data[key];


        if (
            nested &&
            typeof nested === "object" &&
            !Array.isArray(nested)
        ) {

            for (const name of names) {

                if (
                    Array.isArray(
                        nested[name]
                    )
                ) {

                    return nested[name];

                }

            }

        }

    }


    return [];
}


// ============================================================
// RENDER ANOMALIES
// ============================================================

function renderAnomalies(data) {

    createAnomalySection();


    const vehicle =
        findArray(
            data,
            [
                "vehicle_anomalies",
                "vehicle_level_anomalies",
                "vehicleAnomalies",
                "vehicle_events",
                "unusual_vehicle_events"
            ]
        );


    const fleet =
        findArray(
            data,
            [
                "fleet_spikes",
                "fleet_dtc_spikes",
                "dtc_spikes",
                "fleetSpikes",
                "spikes"
            ]
        );


    const combinations =
        findArray(
            data,
            [
                "uncommon_combinations",
                "combination_anomalies",
                "relationship_anomalies",
                "combinationAnomalies",
                "dtc_vehicle_combinations"
            ]
        );


    console.log(
        "Vehicle anomalies:",
        vehicle
    );


    console.log(
        "Fleet spikes:",
        fleet
    );


    console.log(
        "Combinations:",
        combinations
    );


    setText(
        "vehicleAnomalyCount",
        vehicle.length
    );


    setText(
        "fleetSpikeCount",
        fleet.length
    );


    setText(
        "combinationAnomalyCount",
        combinations.length
    );


    renderAnomalyList(
        "vehicleAnomaliesList",
        vehicle,
        "vehicle"
    );


    renderAnomalyList(
        "fleetSpikesList",
        fleet,
        "fleet"
    );


    renderAnomalyList(
        "combinationAnomaliesList",
        combinations,
        "combination"
    );
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

        const response =
            await fetch(
                `${API_URL}/status`
            );


        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );

        }


        console.log(
            "Backend connected."
        );


        createAnomalySection();

        await loadAnomalies();


        return true;

    }

    catch (error) {

        console.error(
            "Backend offline:",
            error
        );


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


        createAnomalySection();


        await checkBackend();

    }
);


// ============================================================
// GLOBAL FUNCTIONS
// ============================================================

window.analyzeIncident =
    analyzeIncident;

window.loadAnomalies =
    loadAnomalies;

window.checkBackend =
    checkBackend;

window.createAnomalySection =
    createAnomalySection;

window.renderAnomalies =
    renderAnomalies;
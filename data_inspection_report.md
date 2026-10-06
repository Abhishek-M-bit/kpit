# Data Inspection Report

## 1. Dataset Dimensions
- **MASTER_TRAIN_X.xlsx**: 118,477 rows × 26 columns
- **MASTER_TEST_X.xlsx**: 33,838 rows × 26 columns

## 2. Column Classification
- **Numerical Sensor Columns (11)**: `LOAD_PCT`, `ECT`, `MAP`, `RPM`, `VSS`, `IAT`, `MAF`, `FRP`, `BARO`, `VPWR`, `AAT`
- **DTC Indicator Columns (14)**: `P0000`, `P0562`, `P0113`, `P0102`, `P0403`, `P0404`, `P2562`, `P0234`, `P2015`, `P2009`, `P0107`, `P0069`, `P0089`, `P0406`
- **Other Columns**: `Mode`
- **Categorical Columns**: None natively, but `Mode` acts as categorical.

## 3. Missing-Value Summary
- **Train Dataset**: 0 missing values across all columns.
- **Test Dataset**: 0 missing values across all columns.
- **Infinite Values**: None found in either dataset.

## 4. Duplicate Summary
- **Train Dataset**: 90,657 exact duplicate rows (out of 118,477)
- **Test Dataset**: 26,280 exact duplicate rows (out of 33,838)
- **Train/Test Overlap**: 173 exact rows overlap between Train and Test datasets.

## 5. DTC Distribution (Train)
The DTCs are represented as binary indicator columns (`0` or `1`).
- `P0000`: 0 (88,803), 1 (29,674)
- `P0562`: 0 (102,318), 1 (16,159)
- `P0113` & `P0102`: 0 (94,305), 1 (24,172)
- `P0403`, `P0404`, `P2015`, `P2009`: 0 (90,352), 1 (28,125)
- `P2562`: 0 (98,379), 1 (20,098)
- `P0234` & `P0406`: 0 (114,403), 1 (4,074)
- `P0107`, `P0069`, `P0089`: 0 (102,521), 1 (15,956)

*Note: `P0000` typically represents "no fault". Here it is strangely represented as a `1/0` indicator column.*

## 6. Mode Distribution (Train)
- **Mode 1**: 48,922
- **Mode 2**: 37,171
- **Mode 0**: 32,384

## 7. Train/Test Comparison
- **Schema**: Both datasets have exactly identical schemas (26 columns).
- **Leakage**: There are 173 exact duplicate rows present in both the training and test sets.

## 8. OBDex Schema Summary
OBDex contains rich YAML files representing generic DTC knowledge, grouped by family (e.g., `P0xxx_enriched.yaml`).
Each entry provides:
- `code` and `category`
- `title` and `description` (multi-language support)
- `affected_components`
- `common_causes` (with `id`, `likelihood`, and `label`)
- `repair` (difficulty, diy_possible, estimated_cost_eur, estimated_hours)
- `flags` (mil, emissions_relevant)

## 9. carOBD Schema Summary
carOBD contains 1 Hz vehicle telemetry data from a 2014 Toyota Etios.
- It contains 27 vehicle parameters (PIDs) like RPM, SPEED, ENGINE_LOAD, and Coolant Temperature.
- Files are categorized by conditions: `idleX.csv`, `driveX.csv`, `liveX.csv`, `ufpeX.csv`, `longX.csv`.

## 10. Data-Quality Concerns
1. **Extreme Duplication**: ~76% of the Train dataset and ~77% of the Test dataset are exact duplicate rows.
2. **Data Leakage**: 173 overlapping rows between Train and Test sets.
3. **P0000 Representation**: P0000 (No fault code) is treated as a binary indicator column like active faults, which could confuse standard modeling if not handled properly.
4. **Co-occurring DTCs**: Several groups of DTCs have identical counts, indicating they likely trigger together consistently in this dataset.

## 11. Recommendations for Preprocessing
- **De-duplication**: Remove exact duplicate rows, especially before training anomaly detection models or populating a similarity index, to prevent extreme bias towards heavily duplicated steady-state conditions.
- **Leakage Prevention**: Remove overlapping rows from the Test set.
- **Feature Engineering**: Scale numerical sensors for similarity matching. Determine logic for handling `P0000` vs other faults.

## 12. Suitable Uses for the Data
- **Similarity Engine**: The 11 numerical sensor columns (`LOAD_PCT`, `RPM`, `ECT`, etc.) and the `Mode` column from the MASTER datasets.
- **Anomaly Detection**: The 11 numerical sensor columns from the MASTER datasets (representing continuous operating conditions).
- **RAG**: The YAML files from the `OBDex` repository, to provide rich historical evidence, repair info, and common causes for specific queried DTCs.

## 13. Unavailable Data (MUST NOT BE CLAIMED)
The following information is completely missing and **must not be claimed or fabricated**:
- Customer complaints
- Inspection findings
- Previous repairs
- Repair outcomes
- Vehicle downtime

***

PHASE 1 COMPLETE

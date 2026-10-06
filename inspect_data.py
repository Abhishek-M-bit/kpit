import pandas as pd
import numpy as np
import json
import os

def inspect_datasets():
    train_path = r"c:\Users\abhis\OneDrive\Desktop\kpitnew\MASTER_TRAIN_X.xlsx"
    test_path = r"c:\Users\abhis\OneDrive\Desktop\kpitnew\MASTER_TEST_X.xlsx"
    
    # Check if files exist
    print(f"Train exists: {os.path.exists(train_path)}")
    print(f"Test exists: {os.path.exists(test_path)}")
    
    # Load data
    train_df = pd.read_excel(train_path)
    test_df = pd.read_excel(test_path)
    
    # Sheet names
    train_sheets = pd.ExcelFile(train_path).sheet_names
    test_sheets = pd.ExcelFile(test_path).sheet_names
    
    report = {}
    report["dimensions"] = {
        "train": train_df.shape,
        "test": test_df.shape
    }
    report["sheets"] = {
        "train": train_sheets,
        "test": test_sheets
    }
    
    # Columns
    train_cols = list(train_df.columns)
    test_cols = list(test_df.columns)
    report["columns"] = {
        "train": train_cols,
        "test": test_cols
    }
    report["schema_match"] = train_cols == test_cols
    
    # Identify column types
    numerical_cols = train_df.select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = train_df.select_dtypes(exclude=[np.number]).columns.tolist()
    
    dtc_cols = [c for c in train_cols if c.startswith('P') and len(c) == 5]
    numerical_sensor_cols = [c for c in numerical_cols if c not in dtc_cols and c != 'Mode']
    
    report["column_classification"] = {
        "numerical_sensors": numerical_sensor_cols,
        "dtc_columns": dtc_cols,
        "categorical_columns": categorical_cols,
        "mode_column_present": 'Mode' in train_cols
    }
    
    # Missing values
    report["missing_values"] = {
        "train": train_df.isna().sum().to_dict(),
        "test": test_df.isna().sum().to_dict()
    }
    
    # Infinite values
    try:
        inf_train = np.isinf(train_df.select_dtypes(include=[np.number])).sum().to_dict()
        inf_test = np.isinf(test_df.select_dtypes(include=[np.number])).sum().to_dict()
    except Exception as e:
        inf_train = {}
        inf_test = {}
        
    report["infinite_values"] = {
        "train": inf_train,
        "test": inf_test
    }
    
    # Duplicates
    report["duplicates"] = {
        "train": int(train_df.duplicated().sum()),
        "test": int(test_df.duplicated().sum())
    }
    
    # DTC frequencies
    dtc_freq = {}
    for col in dtc_cols:
        dtc_freq[col] = train_df[col].value_counts().to_dict()
    report["dtc_frequencies_train"] = dtc_freq
    
    # P0000 specific check
    if 'P0000' in train_df.columns:
        p0000_unique = train_df['P0000'].unique().tolist()
        report["P0000_representation"] = p0000_unique
    
    # Mode column check
    if 'Mode' in train_df.columns:
        report["mode_distribution_train"] = train_df['Mode'].value_counts().to_dict()
        
    # Check for overlapping rows
    # Convert df to string for easy exact row matching
    train_str = train_df.astype(str).apply(lambda x: ''.join(x), axis=1)
    test_str = test_df.astype(str).apply(lambda x: ''.join(x), axis=1)
    overlapping = set(train_str).intersection(set(test_str))
    report["overlapping_rows_count"] = len(overlapping)
    
    with open(r"c:\Users\abhis\OneDrive\Desktop\kpitnew\inspection_results.json", "w") as f:
        json.dump(report, f, indent=4, default=str)
        
if __name__ == "__main__":
    inspect_datasets()

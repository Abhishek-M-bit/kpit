import sqlite3
conn = sqlite3.connect("data/kpit_diagnostics.db")
cursor = conn.cursor()

cursor.execute("SELECT vehicle_id FROM vehicles WHERE vehicle_id LIKE 'TEST-%' OR vehicle_id = 'V102'")
test_vids = [r[0] for r in cursor.fetchall()]
print("Found test vehicle_ids:", test_vids)

for vid in test_vids:
    cursor.execute("DELETE FROM service_history WHERE vehicle_id = ?", (vid,))
    cursor.execute("DELETE FROM diagnostic_results WHERE analysis_id IN (SELECT analysis_id FROM incidents WHERE vehicle_id = ?)", (vid,))
    cursor.execute("DELETE FROM incidents WHERE vehicle_id = ?", (vid,))
    cursor.execute("DELETE FROM vehicles WHERE vehicle_id = ?", (vid,))

conn.commit()

print('vehicles:', cursor.execute('SELECT COUNT(*) FROM vehicles').fetchone()[0])
print('incidents:', cursor.execute('SELECT COUNT(*) FROM incidents').fetchone()[0])
print('diagnostic_results:', cursor.execute('SELECT COUNT(*) FROM diagnostic_results').fetchone()[0])
print('service_history:', cursor.execute('SELECT COUNT(*) FROM service_history').fetchone()[0])
print('service_history vehicle_ids:', [r[0] for r in cursor.execute('SELECT vehicle_id FROM service_history').fetchall()])

conn.close()

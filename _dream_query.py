import sqlite3
import json

DB_PATH = r'C:\Users\Ronan\.local\share\mimocode\mimocode.db'
conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

# List tables
c.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [r[0] for r in c.fetchall()]
print("TABLES:", tables)

# Schema for key tables
for t in ['session', 'message', 'part', 'task', 'task_event', 'actor_registry']:
    try:
        c.execute(f"PRAGMA table_info({t})")
        cols = [(r[1], r[2]) for r in c.fetchall()]
        print(f"\n{t} columns: {cols}")
    except Exception as e:
        print(f"\n{t}: {e}")

# List all sessions
c.execute("SELECT id, project_id, directory, title, time_created FROM session ORDER BY time_created DESC LIMIT 30")
print("\n\nSESSIONS (newest first):")
for r in c.fetchall():
    print(f"  {r[0]} | proj={r[1][:12] if r[1] else 'None'}... | dir={r[2]} | title={r[3]} | created={r[4]}")

conn.close()

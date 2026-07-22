import sqlite3
import json

DB_PATH = r'C:\Users\Ronan\.local\share\mimocode\mimocode.db'
conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
c = conn.cursor()

# Get the user message from the work session
SID = 'ses_075fab39cffeKwYWj1QIobZK8C'
c.execute("""
    SELECT m.id, m.time_created, json_extract(m.data, '$.role') as role,
           p.id as part_id, json_extract(p.data, '$.type') as part_type,
           json_extract(p.data, '$.text') as text
    FROM message m
    JOIN part p ON p.message_id = m.id
    WHERE m.session_id = ? AND json_extract(m.data, '$.role') = 'user'
    ORDER BY m.time_created
""", (SID,))
print("=== USER MESSAGE ===")
for r in c.fetchall():
    print(f"User: {r['text'][:2000]}")

# Get the final assistant text (analysis/summary)
c.execute("""
    SELECT m.id, m.time_created,
           p.id as part_id, json_extract(p.data, '$.type') as part_type,
           json_extract(p.data, '$.text') as text
    FROM message m
    JOIN part p ON p.message_id = m.id
    WHERE m.session_id = ? AND json_extract(m.data, '$.role') = 'assistant'
      AND json_extract(p.data, '$.type') = 'text'
    ORDER BY m.time_created DESC
    LIMIT 5
""", (SID,))
print("\n=== ASSISTANT TEXT (newest first) ===")
for r in c.fetchall():
    if r['text']:
        print(f"\n  [{r['part_id'][:20]}] {r['text'][:3000]}")

# Also get reasoning parts
c.execute("""
    SELECT m.id, m.time_created,
           json_extract(p.data, '$.text') as text
    FROM message m
    JOIN part p ON p.message_id = m.id
    WHERE m.session_id = ? AND json_extract(m.data, '$.role') = 'assistant'
      AND json_extract(p.data, '$.type') = 'reasoning'
    ORDER BY m.time_created DESC
    LIMIT 3
""", (SID,))
print("\n=== ASSISTANT REASONING (newest first) ===")
for r in c.fetchall():
    if r['text']:
        print(f"\n  [{r['id'][:20]}] {r['text'][:2000]}")

# Check for any tool calls that modified files (write/patch)
c.execute("""
    SELECT m.id, m.time_created,
           json_extract(p.data, '$.tool') as tool,
           substr(p.data, 1, 500) as preview
    FROM message m
    JOIN part p ON p.message_id = m.id
    WHERE m.session_id = ?
      AND json_extract(p.data, '$.type') = 'tool'
      AND json_extract(p.data, '$.tool') IN ('write', 'edit', 'patch')
    ORDER BY m.time_created
""", (SID,))
print("\n=== FILE MODIFICATIONS ===")
for r in c.fetchall():
    print(f"  [{r['tool']}] {r['preview'][:300]}")

conn.close()

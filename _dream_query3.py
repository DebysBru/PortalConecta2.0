import sqlite3
import json

DB_PATH = r'C:\Users\Ronan\.local\share\mimocode\mimocode.db'
conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
c = conn.cursor()

# Get parts from the main work session
SID = 'ses_075fab39cffeKwYWj1QIobZK8C'
c.execute("""
    SELECT m.id as msg_id, m.agent_id, json_extract(m.data, '$.role') as role,
           p.id as part_id, json_extract(p.data, '$.type') as part_type,
           substr(p.data, 1, 500) as part_preview
    FROM message m
    JOIN part p ON p.message_id = m.id
    WHERE m.session_id = ?
    ORDER BY m.time_created, p.time_created
""", (SID,))
parts = c.fetchall()
print(f"=== PARTS IN SESSION {SID} ===")
print(f"Total parts: {len(parts)}")
for p in parts:
    agent = p['agent_id'] or 'main'
    print(f"\n  msg={p['msg_id'][:20]} role={p['role']} agent={agent} part_type={p['part_type']}")
    print(f"    preview: {p['part_preview'][:300]}")

# Also get user messages specifically
print("\n\n=== USER MESSAGES ===")
c.execute("""
    SELECT m.id, m.time_created, json_extract(m.data, '$.role') as role,
           json_extract(m.data, '$.content') as content
    FROM message m
    WHERE m.session_id = ? AND json_extract(m.data, '$.role') = 'user'
    ORDER BY m.time_created
""", (SID,))
for m in c.fetchall():
    content = m['content']
    if content and isinstance(content, str):
        print(f"  [{m['id'][:20]}] {content[:300]}")
    elif content and isinstance(content, list):
        for block in content:
            if isinstance(block, dict) and block.get('type') == 'text':
                print(f"  [{m['id'][:20]}] {block.get('text', '')[:300]}")
                break

# Get parts from "Auto Dream" session to see what happened
SID2 = 'ses_075fab357ffecGt1sQGIT5PzPx'
c.execute("""
    SELECT m.id as msg_id, json_extract(m.data, '$.role') as role,
           p.id as part_id, json_extract(p.data, '$.type') as part_type,
           substr(p.data, 1, 500) as part_preview
    FROM message m
    JOIN part p ON p.message_id = m.id
    WHERE m.session_id = ?
    ORDER BY m.time_created, p.time_created
""", (SID2,))
parts2 = c.fetchall()
print(f"\n\n=== PARTS IN SESSION {SID2} (Auto Dream) ===")
print(f"Total parts: {len(parts2)}")
for p in parts2:
    print(f"\n  msg={p['msg_id'][:20]} role={p['role']} part_type={p['part_type']}")
    print(f"    preview: {p['part_preview'][:300]}")

conn.close()

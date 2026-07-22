import sqlite3
import json

DB_PATH = r'C:\Users\Ronan\.local\share\mimocode\mimocode.db'
conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
c = conn.cursor()

# Get sessions for current project (287754b4)
PROJECT_ID = '287754b4-6fe9-4e0b-870c-4850e2413fbd'
c.execute("SELECT id, title, time_created, time_updated FROM session WHERE project_id = ? ORDER BY time_created DESC", (PROJECT_ID,))
sessions = c.fetchall()
print("=== SESSIONS FOR CURRENT PROJECT ===")
for s in sessions:
    print(f"  {s['id']} | {s['title'][:80] if s['title'] else 'No title'} | created={s['time_created']} | updated={s['time_updated']}")

# Get messages from the main work session (ses_075fab39cffeKwYWj1QIobZK8C - "Finalização projeto produção")
SID = 'ses_075fab39cffeKwYWj1QIobZK8C'
c.execute("SELECT id, agent_id, time_created, data FROM message WHERE session_id = ? ORDER BY time_created", (SID,))
messages = c.fetchall()
print(f"\n=== MESSAGES IN SESSION {SID} ===")
print(f"Total messages: {len(messages)}")
for m in messages:
    data = json.loads(m['data'])
    role = data.get('role', '?')
    content_preview = ''
    if 'content' in data:
        if isinstance(data['content'], str):
            content_preview = data['content'][:120]
        elif isinstance(data['content'], list):
            for block in data['content']:
                if isinstance(block, dict) and block.get('type') == 'text':
                    content_preview = block.get('text', '')[:120]
                    break
    agent = m['agent_id'] or 'main'
    print(f"  [{role}] agent={agent} | {content_preview}")

conn.close()

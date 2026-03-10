import type { Database } from 'better-sqlite3'

interface RegisterPayload {
  id: string; role: string; domain: string; skills: string[]; capacity: number
}

export function registerAgent(db: Database, payload: RegisterPayload) {
  db.prepare(`
    INSERT OR REPLACE INTO agents (id, role, domain, skills, capacity, status, last_heartbeat)
    VALUES (?, ?, ?, ?, ?, 'active', unixepoch())
  `).run(payload.id, payload.role, payload.domain, JSON.stringify(payload.skills), payload.capacity)

  db.prepare(`INSERT INTO events (type, agent, payload) VALUES ('register', ?, ?)`)
    .run(payload.id, JSON.stringify(payload))
}

export function heartbeat(db: Database, agentId: string) {
  db.prepare(`UPDATE agents SET last_heartbeat=unixepoch() WHERE id=?`).run(agentId)
}

export function markDegraded(db: Database, agentId: string) {
  db.prepare(`UPDATE agents SET status='degraded' WHERE id=?`).run(agentId)
  db.prepare(`INSERT INTO events (type, agent, payload) VALUES ('degraded', ?, ?)`)
    .run(agentId, JSON.stringify({ reason: 'missed_heartbeats' }))
}

export function getTeamState(db: Database) {
  const agents = db.prepare('SELECT * FROM agents').all()
  const tasks = db.prepare('SELECT * FROM tasks').all()
  const locks = db.prepare('SELECT * FROM locks').all()
  return { agents, tasks, locks }
}

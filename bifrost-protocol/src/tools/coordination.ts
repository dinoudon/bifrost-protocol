import type { Database } from 'better-sqlite3'

export function acquireLock(db: Database, file: string, agentId: string): { success: boolean } {
  const acquire = db.transaction(() => {
    const existing = db.prepare('SELECT * FROM locks WHERE file=?').get(file)
    if (existing) return { success: false }
    db.prepare('INSERT INTO locks (file, owner_agent) VALUES (?, ?)').run(file, agentId)
    db.prepare("INSERT INTO events (type, agent, payload) VALUES ('lock_acquire', ?, ?)")
      .run(agentId, JSON.stringify({ file }))
    return { success: true }
  })
  return acquire()
}

export function releaseLock(db: Database, file: string, agentId: string): { success: boolean } {
  const release = db.transaction(() => {
    const lock = db.prepare('SELECT * FROM locks WHERE file=?').get(file) as any
    if (!lock || lock.owner_agent !== agentId) return { success: false }
    db.prepare('DELETE FROM locks WHERE file=?').run(file)
    db.prepare("INSERT INTO events (type, agent, payload) VALUES ('lock_release', ?, ?)")
      .run(agentId, JSON.stringify({ file }))
    return { success: true }
  })
  return release()
}

export function writeCheckpoint(db: Database, cp: {
  agent: string; task: string; status: string; context: string; artifacts: string[]
}) {
  db.prepare(`
    INSERT INTO checkpoints (agent, task, status, context, artifacts)
    VALUES (?, ?, ?, ?, ?)
  `).run(cp.agent, cp.task, cp.status, cp.context, JSON.stringify(cp.artifacts))
}

export function writeHandoff(db: Database, payload: {
  from: string; to: string; task: string; summary: string
}) {
  db.prepare("INSERT INTO events (type, agent, payload) VALUES ('handoff', ?, ?)")
    .run(payload.from, JSON.stringify(payload))
  db.prepare("UPDATE tasks SET owner=? WHERE id=?").run(payload.to, payload.task)
}

export function writeShutdown(db: Database, payload: {
  agent: string; completed: string[]; incomplete: string[]; theta: string[]
}) {
  db.prepare("UPDATE agents SET status='offline' WHERE id=?").run(payload.agent)
  db.prepare("INSERT INTO events (type, agent, payload) VALUES ('shutdown', ?, ?)")
    .run(payload.agent, JSON.stringify(payload))
}

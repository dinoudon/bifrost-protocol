import type { Database, Statement } from 'better-sqlite3'

const statementCache = new Map<Database, Record<string, Statement>>()

function getStatements(db: Database) {
  let cached = statementCache.get(db)
  if (!cached) {
    cached = {
      getLock: db.prepare('SELECT * FROM locks WHERE file=?'),
      insertLock: db.prepare('INSERT INTO locks (file, owner_agent) VALUES (?, ?)'),
      insertEvent: db.prepare("INSERT INTO events (type, agent, payload) VALUES (?, ?, ?)"),
      deleteLock: db.prepare('DELETE FROM locks WHERE file=?'),
      insertCheckpoint: db.prepare(`
        INSERT INTO checkpoints (agent, task, status, context, artifacts)
        VALUES (?, ?, ?, ?, ?)
      `),
      updateTaskOwner: db.prepare("UPDATE tasks SET owner=? WHERE id=?"),
      updateTaskCompleted: db.prepare("UPDATE tasks SET status='completed', owner=NULL WHERE id=?"),
      updateAgentOffline: db.prepare("UPDATE agents SET status='offline' WHERE id=?")
    }
    statementCache.set(db, cached)
  }
  return cached
}

export function acquireLock(db: Database, file: string, agentId: string): { success: boolean } {
  const { getLock, insertLock, insertEvent } = getStatements(db)

  const acquire = db.transaction(() => {
    const existing = getLock.get(file)
    if (existing) return { success: false }
    insertLock.run(file, agentId)
    insertEvent.run('lock_acquire', agentId, JSON.stringify({ file }))
    return { success: true }
  })
  return acquire()
}

export function releaseLock(db: Database, file: string, agentId: string): { success: boolean } {
  const { getLock, deleteLock, insertEvent } = getStatements(db)

  const release = db.transaction(() => {
    const lock = getLock.get(file) as any
    if (!lock || lock.owner_agent !== agentId) return { success: false }
    deleteLock.run(file)
    insertEvent.run('lock_release', agentId, JSON.stringify({ file }))
    return { success: true }
  })
  return release()
}

export function writeCheckpoint(db: Database, cp: {
  agent: string; task: string; status: string; context: string; artifacts: string[]
}) {
  getStatements(db).insertCheckpoint.run(cp.agent, cp.task, cp.status, cp.context, JSON.stringify(cp.artifacts))
}

export function writeHandoff(db: Database, payload: {
  from: string; to: string; task: string; summary: string
}) {
  const { insertEvent, updateTaskOwner } = getStatements(db)

  db.transaction(() => {
    insertEvent.run('handoff', payload.from, JSON.stringify(payload))
    updateTaskOwner.run(payload.to, payload.task)
  })()
}

export function writeShutdown(db: Database, payload: {
  agent: string; completed: string[]; incomplete: string[]; theta: string[]
}) {
  const { updateAgentOffline, insertEvent, updateTaskCompleted } = getStatements(db)

  db.transaction(() => {
    updateAgentOffline.run(payload.agent)
    insertEvent.run('shutdown', payload.agent, JSON.stringify(payload))
    for (const taskId of payload.completed) {
      updateTaskCompleted.run(taskId)
    }
  })()
}

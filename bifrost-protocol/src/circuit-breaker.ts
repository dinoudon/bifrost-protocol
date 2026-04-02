import type { Database } from 'better-sqlite3'

interface CBOptions { thresholdSeconds: number; maxMissed: number }

export function checkHeartbeats(db: Database, opts: CBOptions): string[] {
  const cutoff = Math.floor(Date.now() / 1000) - opts.thresholdSeconds

  const runner = db.transaction(() => {
    // 1. Mark stale agents as degraded and get their IDs in one go.
    // Using RETURNING id allows us to know which agents were affected without a separate SELECT.
    const staleAgents = db.prepare(`
      UPDATE agents
      SET status = 'degraded'
      WHERE status = 'active' AND last_heartbeat < ?
      RETURNING id
    `).all(cutoff) as { id: string }[]

    if (staleAgents.length === 0) return []

    const staleIds = staleAgents.map(a => a.id)
    const staleIdsJson = JSON.stringify(staleIds)

    // 2. Unassign all tasks owned by these agents that are in_progress.
    // We use json_each to pass the list of IDs efficiently to the IN clause.
    const orphanedTasks = db.prepare(`
      UPDATE tasks
      SET status = 'unassigned', owner = NULL
      WHERE status = 'in_progress' AND owner IN (SELECT value FROM json_each(?))
      RETURNING id
    `).all(staleIdsJson) as { id: string }[]

    // 3. Clear all locks held by these agents.
    db.prepare(`
      DELETE FROM locks
      WHERE owner_agent IN (SELECT value FROM json_each(?))
    `).run(staleIdsJson)

    // 4. Record 'degraded' events for all affected agents in bulk.
    db.prepare(`
      INSERT INTO events (type, agent, payload)
      SELECT 'degraded', value, '{"reason":"missed_heartbeats"}'
      FROM json_each(?)
    `).run(staleIdsJson)

    return orphanedTasks.map(t => t.id)
  })

  return runner()
}

import type { Database } from 'better-sqlite3'

interface CBOptions { thresholdSeconds: number; maxMissed: number }

export function checkHeartbeats(db: Database, opts: CBOptions): string[] {
  const cutoff = Math.floor(Date.now() / 1000) - opts.thresholdSeconds

  // Use a transaction for consistency and speed when processing multiple stale agents.
  const check = db.transaction(() => {
    // 1. Identify and mark stale agents as degraded in one go.
    // Returning IDs to use for bulk operations on related tables.
    const staleAgents = db.prepare(`
      UPDATE agents
      SET status = 'degraded'
      WHERE status = 'active' AND last_heartbeat < ?
      RETURNING id
    `).all(cutoff) as { id: string }[]

    if (staleAgents.length === 0) return []

    const staleIds = staleAgents.map(a => a.id)
    const staleIdsJson = JSON.stringify(staleIds)

    // 2. Batch insert events for all newly degraded agents.
    db.prepare(`
      INSERT INTO events (type, agent, payload)
      SELECT 'degraded', value, ?
      FROM json_each(?)
    `).run(JSON.stringify({ reason: 'missed_heartbeats' }), staleIdsJson)

    // 3. Reassign tasks from all stale agents at once.
    // Using json_each to efficiently filter by a list of IDs.
    const orphanedTasks = db.prepare(`
      UPDATE tasks
      SET status = 'unassigned', owner = NULL
      WHERE status = 'in_progress'
      AND owner IN (SELECT value FROM json_each(?))
      RETURNING id
    `).all(staleIdsJson) as { id: string }[]

    // 4. Release all locks held by stale agents.
    db.prepare(`
      DELETE FROM locks
      WHERE owner_agent IN (SELECT value FROM json_each(?))
    `).run(staleIdsJson)

    return orphanedTasks.map(t => t.id)
  })

  return check()
}

import type { Database } from 'better-sqlite3'

interface CBOptions { thresholdSeconds: number; maxMissed: number }

/**
 * Checks for stale agents and unassigns their tasks.
 * Optimized to use bulk SQL operations for performance.
 */
export function checkHeartbeats(db: Database, opts: CBOptions): string[] {
  const cutoff = Math.floor(Date.now() / 1000) - opts.thresholdSeconds

  // Use a transaction to ensure atomicity and improve performance for multiple updates
  const updateTransaction = db.transaction(() => {
    // 1. Identify stale agents and mark them degraded in bulk using RETURNING to get their IDs
    const staleAgents = db.prepare(`
      UPDATE agents
      SET status = 'degraded'
      WHERE status = 'active' AND last_heartbeat < ?
      RETURNING id
    `).all(cutoff) as { id: string }[]

    if (staleAgents.length === 0) return []

    const agentIdsJson = JSON.stringify(staleAgents.map(a => a.id))

    // 2. Unassign tasks from all stale agents in a single bulk update
    // We use json_each to efficiently pass the list of agent IDs to the query
    const orphanedTasks = db.prepare(`
      UPDATE tasks
      SET status = 'unassigned', owner = NULL
      WHERE status = 'in_progress' AND owner IN (SELECT value FROM json_each(?))
      RETURNING id
    `).all(agentIdsJson) as { id: string }[]

    // 3. Delete all locks held by these agents in bulk
    db.prepare(`
      DELETE FROM locks
      WHERE owner_agent IN (SELECT value FROM json_each(?))
    `).run(agentIdsJson)

    // 4. Record 'degraded' events for all affected agents in bulk
    const insertEvent = db.prepare(`
      INSERT INTO events (type, agent, payload)
      SELECT 'degraded', value, ?
      FROM json_each(?)
    `)
    insertEvent.run(JSON.stringify({ reason: 'missed_heartbeats' }), agentIdsJson)

    return orphanedTasks.map(t => t.id)
  })

  return updateTransaction()
}

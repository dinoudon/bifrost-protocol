import type { Database } from 'better-sqlite3'

interface CBOptions { thresholdSeconds: number; maxMissed: number }

/**
 * Checks for agents that have missed heartbeats and reassigns their tasks.
 * ⚡ Optimized to use bulk SQL operations within a single transaction,
 * avoiding N+1 query patterns that were previously causing performance issues
 * when multiple agents became stale simultaneously.
 */
export function checkHeartbeats(db: Database, opts: CBOptions): string[] {
  const cutoff = Math.floor(Date.now() / 1000) - opts.thresholdSeconds

  const execution = db.transaction(() => {
    // 1. Identify and mark all stale agents as degraded in one go.
    // We use RETURNING id to get the IDs of all affected agents.
    const staleAgents = db.prepare(`
      UPDATE agents
      SET status = 'degraded'
      WHERE status = 'active' AND last_heartbeat < ?
      RETURNING id
    `).all(cutoff) as { id: string }[]

    if (staleAgents.length === 0) return []

    const staleAgentIds = staleAgents.map(a => a.id)
    const agentIdsJson = JSON.stringify(staleAgentIds)

    // 2. Insert 'degraded' events for all affected agents.
    // Using a subquery with json_each to perform a bulk insert.
    db.prepare(`
      INSERT INTO events (type, agent, payload)
      SELECT 'degraded', value, ?
      FROM json_each(?)
    `).run(JSON.stringify({ reason: 'missed_heartbeats' }), agentIdsJson)

    // 3. Reassign all 'in_progress' tasks owned by the stale agents.
    // We use RETURNING id to capture which tasks were rerouted.
    const orphanedTasks = db.prepare(`
      UPDATE tasks
      SET status = 'unassigned', owner = NULL
      WHERE status = 'in_progress'
      AND owner IN (SELECT value FROM json_each(?))
      RETURNING id
    `).all(agentIdsJson) as { id: string }[]

    // 4. Clear all locks held by the stale agents in bulk.
    db.prepare(`
      DELETE FROM locks
      WHERE owner_agent IN (SELECT value FROM json_each(?))
    `).run(agentIdsJson)

    return orphanedTasks.map(t => t.id)
  })

  return execution()
}

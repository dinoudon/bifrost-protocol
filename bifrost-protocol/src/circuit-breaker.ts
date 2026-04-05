import type { Database } from 'better-sqlite3'

interface CBOptions { thresholdSeconds: number; maxMissed: number }

export function checkHeartbeats(db: Database, opts: CBOptions): string[] {
  const cutoff = Math.floor(Date.now() / 1000) - opts.thresholdSeconds

  // Using a transaction and bulk SQL operations to optimize performance.
  // This avoids N+1 query patterns by updating all stale agents and their tasks in one go.
  const check = db.transaction(() => {
    // 1. Identify stale agents and mark them degraded in bulk.
    // We use RETURNING id to capture the affected agent IDs for subsequent steps.
    const staleAgents = db.prepare(`
      UPDATE agents
      SET status = 'degraded'
      WHERE status = 'active' AND last_heartbeat < ?
      RETURNING id
    `).all(cutoff) as { id: string }[]

    if (staleAgents.length === 0) return []

    const staleAgentIds = staleAgents.map(a => a.id)
    const agentIdsJson = JSON.stringify(staleAgentIds)

    // 2. Insert 'degraded' events for all affected agents in bulk.
    db.prepare(`
      INSERT INTO events (type, agent, payload)
      SELECT 'degraded', value, ?
      FROM json_each(?)
    `).run(JSON.stringify({ reason: 'missed_heartbeats' }), agentIdsJson)

    // 3. Reassign tasks from all stale agents in bulk.
    // We use RETURNING id to get the list of rerouted tasks.
    const reroutedTasks = db.prepare(`
      UPDATE tasks
      SET status = 'unassigned', owner = NULL
      WHERE status = 'in_progress' AND owner IN (SELECT value FROM json_each(?))
      RETURNING id
    `).all(agentIdsJson) as { id: string }[]

    // 4. Release locks held by stale agents in bulk.
    db.prepare(`
      DELETE FROM locks
      WHERE owner_agent IN (SELECT value FROM json_each(?))
    `).run(agentIdsJson)

    return reroutedTasks.map(t => t.id)
  })

  return check()
}

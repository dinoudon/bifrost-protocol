import type { Database } from 'better-sqlite3'

interface CBOptions { thresholdSeconds: number; maxMissed: number }

export function checkHeartbeats(db: Database, opts: CBOptions): string[] {
  const cutoff = Math.floor(Date.now() / 1000) - opts.thresholdSeconds

  // Perform bulk updates in a single transaction for better performance and consistency.
  // Using RETURNING and json_each allows us to avoid N+1 query patterns in JavaScript.
  const check = db.transaction(() => {
    // 1. Identify and mark all stale agents as degraded in one go.
    const staleAgents = db.prepare(`
      UPDATE agents
      SET status = 'degraded'
      WHERE status = 'active' AND last_heartbeat < ?
      RETURNING id
    `).all(cutoff) as { id: string }[]

    if (staleAgents.length === 0) return []

    const agentIds = staleAgents.map(a => a.id)
    const agentIdsJson = JSON.stringify(agentIds)

    // 2. Insert 'degraded' events for all affected agents.
    db.prepare(`
      INSERT INTO events (type, agent, payload)
      SELECT 'degraded', value, ?
      FROM json_each(?)
    `).run(JSON.stringify({ reason: 'missed_heartbeats' }), agentIdsJson)

    // 3. Reassign all 'in_progress' tasks owned by these agents.
    const reroutedTasks = db.prepare(`
      UPDATE tasks
      SET status = 'unassigned', owner = NULL
      WHERE status = 'in_progress' AND owner IN (SELECT value FROM json_each(?))
      RETURNING id
    `).all(agentIdsJson) as { id: string }[]

    // 4. Release all locks held by these agents.
    db.prepare(`
      DELETE FROM locks
      WHERE owner_agent IN (SELECT value FROM json_each(?))
    `).run(agentIdsJson)

    return reroutedTasks.map(t => t.id)
  })

  return check()
}

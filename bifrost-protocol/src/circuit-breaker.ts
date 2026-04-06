import type { Database } from 'better-sqlite3'

interface CBOptions { thresholdSeconds: number; maxMissed: number }

export function checkHeartbeats(db: Database, opts: CBOptions): string[] {
  // Use a single transaction and bulk SQL operations to avoid N+1 query patterns.
  // This is significantly faster when multiple agents go stale simultaneously.
  return db.transaction(() => {
    const cutoff = Math.floor(Date.now() / 1000) - opts.thresholdSeconds

    // 1. Identify and mark agents as degraded in one step
    const staleAgents = db.prepare(`
      UPDATE agents
      SET status = 'degraded'
      WHERE status = 'active' AND last_heartbeat < ?
      RETURNING id
    `).all(cutoff) as { id: string }[]

    if (staleAgents.length === 0) return []

    // Convert IDs to a JSON array for efficient use in subsequent queries via json_each
    const staleIdsJson = JSON.stringify(staleAgents.map(a => a.id))

    // 2. Batch insert degradation events
    db.prepare(`
      INSERT INTO events (type, agent, payload)
      SELECT 'degraded', value, ?
      FROM json_each(?)
    `).run(JSON.stringify({ reason: 'missed_heartbeats' }), staleIdsJson)

    // 3. Reassign tasks and capture rerouted IDs in bulk
    const rerouted = db.prepare(`
      UPDATE tasks
      SET status = 'unassigned', owner = NULL
      WHERE status = 'in_progress' AND owner IN (SELECT value FROM json_each(?))
      RETURNING id
    `).all(staleIdsJson) as { id: string }[]

    // 4. Release all locks held by stale agents
    db.prepare(`
      DELETE FROM locks
      WHERE owner_agent IN (SELECT value FROM json_each(?))
    `).run(staleIdsJson)

    return rerouted.map(t => t.id)
  })()
}

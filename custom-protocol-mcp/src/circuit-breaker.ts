import type { Database } from 'better-sqlite3'
import { markDegraded } from './tools/agent.js'

interface CBOptions { thresholdSeconds: number; maxMissed: number }

export function checkHeartbeats(db: Database, opts: CBOptions): string[] {
  const cutoff = Math.floor(Date.now() / 1000) - opts.thresholdSeconds
  const stale = db.prepare(
    "SELECT id FROM agents WHERE status='active' AND last_heartbeat < ?"
  ).all(cutoff) as { id: string }[]

  const reroutedTasks: string[] = []

  for (const { id } of stale) {
    markDegraded(db, id)
    const orphaned = db.prepare(
      "UPDATE tasks SET status='unassigned', owner=NULL WHERE owner=? AND status='in_progress' RETURNING id"
    ).all(id) as { id: string }[]
    reroutedTasks.push(...orphaned.map(t => t.id))
    db.prepare("DELETE FROM locks WHERE owner_agent=?").run(id)
  }

  return reroutedTasks
}

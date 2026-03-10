import { describe, it, expect, beforeEach, vi } from 'vitest'
import { initDb } from './db.js'
import { registerAgent } from './tools/agent.js'
import { addTask } from './tools/tasks.js'
import { checkHeartbeats } from './circuit-breaker.js'

let db: ReturnType<typeof initDb>

beforeEach(() => {
  db = initDb(':memory:')
  registerAgent(db, { id: 'A1', role: 'coder', domain: 'dev', skills: ['auth'], capacity: 2 })
  addTask(db, { id: 'T1', priority: 'P1', skills: ['auth'], description: 'fix jwt', parallel_safe: false })
  db.prepare("UPDATE tasks SET status='in_progress', owner='A1' WHERE id='T1'").run()
})

describe('checkHeartbeats', () => {
  it('marks agent degraded if heartbeat too old', () => {
    db.prepare("UPDATE agents SET last_heartbeat=unixepoch()-300 WHERE id='A1'").run()
    const rerouted = checkHeartbeats(db, { thresholdSeconds: 180, maxMissed: 1 })
    const agent = db.prepare("SELECT status FROM agents WHERE id='A1'").get() as any
    expect(agent.status).toBe('degraded')
    expect(rerouted).toContain('T1')
  })
  it('leaves healthy agent alone', () => {
    checkHeartbeats(db, { thresholdSeconds: 180, maxMissed: 1 })
    const agent = db.prepare("SELECT status FROM agents WHERE id='A1'").get() as any
    expect(agent.status).toBe('active')
  })
})

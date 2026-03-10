/**
 * Task 11: 3-Agent Pilot Test
 * End-to-end verification of the full protocol with 3 agents.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { initDb } from './db.js'
import { registerAgent, heartbeat, getTeamState } from './tools/agent.js'
import { addTask, availableTasks, claimTask } from './tools/tasks.js'
import { acquireLock, releaseLock, writeCheckpoint, writeHandoff, writeShutdown } from './tools/coordination.js'
import { checkHeartbeats } from './circuit-breaker.js'

let db: ReturnType<typeof initDb>

beforeEach(() => {
  db = initDb(':memory:')
})

describe('3-Agent Pilot Test', () => {
  it('Step 2: registers 3 agents', () => {
    registerAgent(db, { id: 'A1', role: 'coder', domain: 'dev', skills: ['typescript', 'auth'], capacity: 3 })
    registerAgent(db, { id: 'A2', role: 'researcher', domain: 'research', skills: ['sources', 'synthesis'], capacity: 2 })
    registerAgent(db, { id: 'A3', role: 'reviewer', domain: 'dev', skills: ['typescript', 'review'], capacity: 4 })

    const state = getTeamState(db)
    expect(state.agents).toHaveLength(3)
  })

  it('Step 3: adds tasks to queue', () => {
    addTask(db, { id: 'T1', priority: 'P1', skills: ['auth'], description: 'implement jwt refresh', parallel_safe: false })
    addTask(db, { id: 'T2', priority: 'P2', skills: ['sources'], description: 'research oauth best practices', parallel_safe: false })
    addTask(db, { id: 'T3', priority: 'P2', skills: ['review'], description: 'review auth implementation', parallel_safe: false })

    const state = getTeamState(db)
    expect(state.tasks).toHaveLength(3)
  })

  it('Step 4: work stealing — skill-based filtering and atomic claiming', () => {
    registerAgent(db, { id: 'A1', role: 'coder', domain: 'dev', skills: ['typescript', 'auth'], capacity: 3 })
    registerAgent(db, { id: 'A2', role: 'researcher', domain: 'research', skills: ['sources', 'synthesis'], capacity: 2 })
    addTask(db, { id: 'T1', priority: 'P1', skills: ['auth'], description: 'implement jwt refresh', parallel_safe: false })
    addTask(db, { id: 'T2', priority: 'P2', skills: ['sources'], description: 'research oauth', parallel_safe: false })

    // A1 sees T1 (has auth skill), not T2
    const a1Tasks = availableTasks(db, ['typescript', 'auth'])
    expect(a1Tasks.map((t: any) => t.id)).toContain('T1')
    expect(a1Tasks.map((t: any) => t.id)).not.toContain('T2')

    // A1 claims T1
    expect(claimTask(db, 'T1', 'A1').success).toBe(true)

    // A2 cannot double-claim T1
    expect(claimTask(db, 'T1', 'A2').success).toBe(false)
  })

  it('Step 5: lock system — acquire, deny, release, re-acquire', () => {
    registerAgent(db, { id: 'A1', role: 'coder', domain: 'dev', skills: [], capacity: 2 })
    registerAgent(db, { id: 'A2', role: 'coder', domain: 'dev', skills: [], capacity: 2 })
    registerAgent(db, { id: 'A3', role: 'reviewer', domain: 'dev', skills: [], capacity: 4 })

    expect(acquireLock(db, 'AUTH', 'A1').success).toBe(true)
    expect(acquireLock(db, 'AUTH', 'A2').success).toBe(false)
    expect(releaseLock(db, 'AUTH', 'A1').success).toBe(true)
    expect(acquireLock(db, 'AUTH', 'A3').success).toBe(true)
  })

  it('Step 6: circuit breaker — degrades stale agent, reroutes tasks', () => {
    registerAgent(db, { id: 'A1', role: 'coder', domain: 'dev', skills: ['auth'], capacity: 2 })
    addTask(db, { id: 'T1', priority: 'P1', skills: ['auth'], description: 'fix jwt', parallel_safe: false })
    db.prepare("UPDATE tasks SET status='in_progress', owner='A1' WHERE id='T1'").run()

    // Simulate stale heartbeat (5 min ago)
    db.prepare("UPDATE agents SET last_heartbeat=unixepoch()-300 WHERE id='A1'").run()

    const rerouted = checkHeartbeats(db, { thresholdSeconds: 180, maxMissed: 1 })

    const agent = db.prepare("SELECT status FROM agents WHERE id='A1'").get() as any
    expect(agent.status).toBe('degraded')
    expect(rerouted).toContain('T1')

    // T1 should be back to unassigned
    const task = db.prepare("SELECT status, owner FROM tasks WHERE id='T1'").get() as any
    expect(task.status).toBe('unassigned')
    expect(task.owner).toBeNull()
  })

  it('full lifecycle: register → claim → checkpoint → handoff → shutdown', () => {
    registerAgent(db, { id: 'A1', role: 'coder', domain: 'dev', skills: ['auth'], capacity: 3 })
    registerAgent(db, { id: 'A3', role: 'reviewer', domain: 'dev', skills: ['review'], capacity: 4 })
    addTask(db, { id: 'T1', priority: 'P1', skills: ['auth'], description: 'implement jwt', parallel_safe: false })

    // A1 claims and works
    claimTask(db, 'T1', 'A1')
    heartbeat(db, 'A1')
    writeCheckpoint(db, { agent: 'A1', task: 'T1', status: 'gamma', context: 'jwt refresh done', artifacts: ['src/auth.ts'] })

    // A1 hands off to A3 for review
    writeHandoff(db, { from: 'A1', to: 'A3', task: 'T1', summary: 'jwt refresh implemented, needs review' })
    const task = db.prepare("SELECT owner FROM tasks WHERE id='T1'").get() as any
    expect(task.owner).toBe('A3')

    // A1 shuts down
    writeShutdown(db, { agent: 'A1', completed: ['T1'], incomplete: [], theta: [] })
    const agent = db.prepare("SELECT status FROM agents WHERE id='A1'").get() as any
    expect(agent.status).toBe('offline')
  })
})

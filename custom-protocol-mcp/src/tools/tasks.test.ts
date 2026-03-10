import { describe, it, expect, beforeEach } from 'vitest'
import { initDb } from '../db.js'
import { registerAgent } from './agent.js'
import { addTask, claimTask, availableTasks } from './tasks.js'

let db: ReturnType<typeof initDb>

beforeEach(() => {
  db = initDb(':memory:')
  registerAgent(db, { id: 'A1', role: 'coder', domain: 'dev', skills: ['typescript','auth'], capacity: 3 })
})

describe('addTask', () => {
  it('inserts task with unassigned status', () => {
    addTask(db, { id: 'T1', priority: 'P0', skills: ['auth'], description: 'fix jwt', parallel_safe: false })
    const row = db.prepare('SELECT * FROM tasks WHERE id=?').get('T1') as any
    expect(row.status).toBe('unassigned')
  })
})

describe('availableTasks', () => {
  it('returns tasks matching agent skills', () => {
    addTask(db, { id: 'T1', priority: 'P1', skills: ['auth'], description: 'fix jwt', parallel_safe: false })
    addTask(db, { id: 'T2', priority: 'P1', skills: ['python'], description: 'other', parallel_safe: false })
    const tasks = availableTasks(db, ['typescript','auth'])
    expect(tasks.map((t: any) => t.id)).toContain('T1')
    expect(tasks.map((t: any) => t.id)).not.toContain('T2')
  })
})

describe('claimTask', () => {
  it('atomically assigns task to agent', () => {
    addTask(db, { id: 'T1', priority: 'P1', skills: ['auth'], description: 'fix jwt', parallel_safe: false })
    const result = claimTask(db, 'T1', 'A1')
    expect(result.success).toBe(true)
    const row = db.prepare('SELECT * FROM tasks WHERE id=?').get('T1') as any
    expect(row.owner).toBe('A1')
    expect(row.status).toBe('in_progress')
  })
  it('rejects double-claim', () => {
    registerAgent(db, { id: 'A2', role: 'coder', domain: 'dev', skills: ['auth'], capacity: 2 })
    addTask(db, { id: 'T1', priority: 'P1', skills: ['auth'], description: 'fix jwt', parallel_safe: false })
    claimTask(db, 'T1', 'A1')
    const result = claimTask(db, 'T1', 'A2')
    expect(result.success).toBe(false)
  })
})

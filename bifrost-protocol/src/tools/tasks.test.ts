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

  it('returns zero-skill tasks to any agent', () => {
    addTask(db, { id: 'T1', priority: 'P1', skills: [], description: 'no-skill task', parallel_safe: false })
    addTask(db, { id: 'T2', priority: 'P1', skills: ['python'], description: 'python task', parallel_safe: false })
    const tasks = availableTasks(db, ['typescript'])
    expect(tasks.map((t: any) => t.id)).toContain('T1')
    expect(tasks.map((t: any) => t.id)).not.toContain('T2')
  })

  it('returns zero-skill tasks when agent has no skills', () => {
    addTask(db, { id: 'T1', priority: 'P1', skills: [], description: 'no-skill task', parallel_safe: false })
    addTask(db, { id: 'T2', priority: 'P1', skills: ['auth'], description: 'auth task', parallel_safe: false })
    const tasks = availableTasks(db, [])
    expect(tasks.map((t: any) => t.id)).toContain('T1')
    expect(tasks.map((t: any) => t.id)).not.toContain('T2')
  })

  it('excludes in_progress and other non-unassigned tasks', () => {
    addTask(db, { id: 'T1', priority: 'P1', skills: ['auth'], description: 'fix jwt', parallel_safe: false })
    claimTask(db, 'T1', 'A1')
    const tasks = availableTasks(db, ['auth'])
    expect(tasks.map((t: any) => t.id)).not.toContain('T1')
  })

  it('returns tasks in priority order (P0 before P1 before P2)', () => {
    addTask(db, { id: 'T3', priority: 'P2', skills: ['auth'], description: 'low', parallel_safe: false })
    addTask(db, { id: 'T1', priority: 'P0', skills: ['auth'], description: 'urgent', parallel_safe: false })
    addTask(db, { id: 'T2', priority: 'P1', skills: ['auth'], description: 'normal', parallel_safe: false })
    const tasks = availableTasks(db, ['auth'])
    const ids = tasks.map((t: any) => t.id)
    expect(ids.indexOf('T1')).toBeLessThan(ids.indexOf('T2'))
    expect(ids.indexOf('T2')).toBeLessThan(ids.indexOf('T3'))
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

import { describe, it, expect, beforeEach } from 'vitest'
import { initDb } from '../db.js'
import { registerAgent, heartbeat, getTeamState } from './agent.js'
import type { Database } from 'better-sqlite3'

let db: ReturnType<typeof initDb>

beforeEach(() => { db = initDb(':memory:') })

describe('registerAgent', () => {
  it('inserts agent row', () => {
    registerAgent(db, { id: 'A1', role: 'coder', domain: 'dev', skills: ['typescript'], capacity: 3 })
    const row = db.prepare('SELECT * FROM agents WHERE id=?').get('A1') as any
    expect(row.role).toBe('coder')
    expect(JSON.parse(row.skills)).toContain('typescript')
  })
  it('logs register event', () => {
    registerAgent(db, { id: 'A1', role: 'coder', domain: 'dev', skills: [], capacity: 2 })
    const event = db.prepare("SELECT * FROM events WHERE type='register'").get() as any
    expect(event).toBeTruthy()
  })
})

describe('heartbeat', () => {
  it('updates last_heartbeat', () => {
    registerAgent(db, { id: 'A1', role: 'coder', domain: 'dev', skills: [], capacity: 2 })
    const before = (db.prepare('SELECT last_heartbeat FROM agents WHERE id=?').get('A1') as any).last_heartbeat
    heartbeat(db, 'A1')
    const after = (db.prepare('SELECT last_heartbeat FROM agents WHERE id=?').get('A1') as any).last_heartbeat
    expect(after).toBeGreaterThanOrEqual(before)
  })
})

describe('getTeamState', () => {
  it('returns agents and tasks', () => {
    registerAgent(db, { id: 'A1', role: 'coder', domain: 'dev', skills: [], capacity: 2 })
    const state = getTeamState(db)
    expect(state.agents).toHaveLength(1)
    expect(state.tasks).toHaveLength(0)
  })
})

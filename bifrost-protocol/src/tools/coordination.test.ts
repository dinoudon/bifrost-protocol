import { describe, it, expect, beforeEach } from 'vitest'
import { initDb } from '../db.js'
import { registerAgent } from './agent.js'
import { acquireLock, releaseLock, writeCheckpoint, writeHandoff, writeShutdown } from './coordination.js'

let db: ReturnType<typeof initDb>

beforeEach(() => {
  db = initDb(':memory:')
  registerAgent(db, { id: 'A1', role: 'coder', domain: 'dev', skills: [], capacity: 2 })
  registerAgent(db, { id: 'A2', role: 'coder', domain: 'dev', skills: [], capacity: 2 })
})

describe('acquireLock', () => {
  it('grants lock to first claimer', () => {
    expect(acquireLock(db, 'AUTH', 'A1').success).toBe(true)
  })
  it('denies lock to second claimer', () => {
    acquireLock(db, 'AUTH', 'A1')
    expect(acquireLock(db, 'AUTH', 'A2').success).toBe(false)
  })
})

describe('releaseLock', () => {
  it('releases owned lock', () => {
    acquireLock(db, 'AUTH', 'A1')
    expect(releaseLock(db, 'AUTH', 'A1').success).toBe(true)
    expect(acquireLock(db, 'AUTH', 'A2').success).toBe(true)
  })
  it('refuses to release lock owned by other', () => {
    acquireLock(db, 'AUTH', 'A1')
    expect(releaseLock(db, 'AUTH', 'A2').success).toBe(false)
  })
})

describe('writeCheckpoint', () => {
  it('inserts checkpoint row', () => {
    writeCheckpoint(db, { agent: 'A1', task: 'T1', status: 'gamma', context: 'half done', artifacts: ['src/auth.ts'] })
    const row = db.prepare('SELECT * FROM checkpoints WHERE agent=?').get('A1') as any
    expect(row.context).toBe('half done')
  })
})

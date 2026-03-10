import { describe, it, expect } from 'vitest'
import { initDb } from './db.js'

describe('initDb', () => {
  it('creates all required tables', () => {
    const db = initDb(':memory:')
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table'"
    ).all() as { name: string }[]
    const names = tables.map(t => t.name)
    expect(names).toContain('agents')
    expect(names).toContain('tasks')
    expect(names).toContain('locks')
    expect(names).toContain('checkpoints')
    expect(names).toContain('events')
  })
})

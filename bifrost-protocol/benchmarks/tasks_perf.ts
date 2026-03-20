import { initDb } from '../src/db.js'
import { addTask } from '../src/tools/tasks.js'
import { performance } from 'perf_hooks'
import type { Database } from 'better-sqlite3'

const db = initDb(':memory:')

// Seed database with 5000 tasks
console.log('Seeding 5000 tasks...')
for (let i = 0; i < 5000; i++) {
  addTask(db, {
    id: `T${i}`,
    priority: i % 3 === 0 ? 'P0' : (i % 3 === 1 ? 'P1' : 'P2'),
    skills: [`skill-${i % 10}`, `skill-${(i + 1) % 10}`],
    description: `Task ${i}`,
    parallel_safe: false
  })
}

const agentSkills = ['skill-1', 'skill-5']

function availableTasksOriginal(db: Database, agentSkills: string[]) {
  const all = db.prepare("SELECT * FROM tasks WHERE status='unassigned' ORDER BY priority ASC").all() as any[]
  return all.filter(t => {
    const required: string[] = JSON.parse(t.skills)
    return required.length === 0 || required.some(s => agentSkills.includes(s))
  })
}

function availableTasksOptimized(db: Database, agentSkills: string[]) {
  if (agentSkills.length === 0) {
      return db.prepare("SELECT * FROM tasks WHERE status='unassigned' AND json_array_length(skills) = 0 ORDER BY priority ASC").all() as any[]
  }
  const query = `
    SELECT tasks.*
    FROM tasks
    WHERE status = 'unassigned'
    AND (
      json_array_length(skills) = 0
      OR EXISTS (
        SELECT 1
        FROM json_each(tasks.skills)
        WHERE value IN (${agentSkills.map(() => '?').join(',')})
      )
    )
    ORDER BY priority ASC
  `
  return db.prepare(query).all(...agentSkills)
}

// Warmup
availableTasksOriginal(db, agentSkills)
availableTasksOptimized(db, agentSkills)

const iterations = 500

const startOrig = performance.now()
for (let i = 0; i < iterations; i++) {
  availableTasksOriginal(db, agentSkills)
}
const endOrig = performance.now()
console.log(`Average time for availableTasks (Original): ${(endOrig - startOrig) / iterations}ms`)

const startOpt = performance.now()
for (let i = 0; i < iterations; i++) {
  availableTasksOptimized(db, agentSkills)
}
const endOpt = performance.now()
console.log(`Average time for availableTasks (Optimized): ${(endOpt - startOpt) / iterations}ms`)

const countOrig = availableTasksOriginal(db, agentSkills).length
const countOpt = availableTasksOptimized(db, agentSkills).length
console.log(`Results count - Original: ${countOrig}, Optimized: ${countOpt}`)

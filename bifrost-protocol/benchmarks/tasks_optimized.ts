import { initDb } from '../src/db.js'
import { addTask, availableTasks } from '../src/tools/tasks.js'
import { performance } from 'perf_hooks'
import fs from 'fs'

async function runBenchmark() {
  const dbPath = 'benchmark_optimized.db'
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath)
  const db = initDb(dbPath)

  const numTasks = 10000
  const allSkills = ['typescript', 'python', 'rust', 'go', 'java', 'kotlin', 'swift', 'c++', 'ruby', 'php']

  console.log(`Populating database with ${numTasks} tasks...`)
  const startPopulate = performance.now()
  for (let i = 0; i < numTasks; i++) {
    const skills = []
    if (Math.random() > 0.2) {
      const numSkills = Math.floor(Math.random() * 3) + 1
      for (let j = 0; j < numSkills; j++) {
        skills.push(allSkills[Math.floor(Math.random() * allSkills.length)])
      }
    }
    addTask(db, {
      id: `task-${i}`,
      priority: `P${Math.floor(Math.random() * 4)}`,
      skills: skills,
      description: `Description for task ${i}`,
      parallel_safe: Math.random() > 0.5
    })
  }
  console.log(`Population took ${(performance.now() - startPopulate).toFixed(2)}ms`)

  const agentSkills = ['typescript', 'rust']
  const iterations = 100

  // Standard availableTasks implementation
  function originalAvailableTasks(db, agentSkills) {
    const all = db.prepare("SELECT * FROM tasks WHERE status='unassigned' ORDER BY priority ASC").all()
    return all.filter(t => {
      const required = JSON.parse(t.skills)
      return required.length === 0 || required.some(s => agentSkills.includes(s))
    })
  }

  // Optimized availableTasks implementation using JSON functions
  function optimizedAvailableTasks(db, agentSkills) {
    const skillsParam = JSON.stringify(agentSkills)
    const stmt = db.prepare(`
      SELECT * FROM tasks
      WHERE status='unassigned'
      AND (
        json_array_length(skills) = 0
        OR EXISTS (
          SELECT 1 FROM json_each(tasks.skills)
          WHERE value IN (SELECT value FROM json_each(?))
        )
      )
      ORDER BY priority ASC
    `)
    return stmt.all(skillsParam)
  }

  console.log(`Running ORIGINAL availableTasks benchmark (${iterations} iterations)...`)
  let start = performance.now()
  let totalResultsOrig = 0
  for (let i = 0; i < iterations; i++) {
    const tasks = originalAvailableTasks(db, agentSkills)
    totalResultsOrig += tasks.length
  }
  let end = performance.now()
  const avgTimeOrig = (end - start) / iterations
  console.log(`Average ORIGINAL availableTasks time: ${avgTimeOrig.toFixed(4)}ms`)

  console.log(`Running OPTIMIZED availableTasks benchmark (${iterations} iterations)...`)
  start = performance.now()
  let totalResultsOpt = 0
  for (let i = 0; i < iterations; i++) {
    const tasks = optimizedAvailableTasks(db, agentSkills)
    totalResultsOpt += tasks.length
  }
  end = performance.now()
  const avgTimeOpt = (end - start) / iterations
  console.log(`Average OPTIMIZED availableTasks time: ${avgTimeOpt.toFixed(4)}ms`)

  console.log(`Improvement: ${(((avgTimeOrig - avgTimeOpt) / avgTimeOrig) * 100).toFixed(2)}%`)
  console.log(`Results match: ${totalResultsOrig === totalResultsOpt} (${totalResultsOrig / iterations} vs ${totalResultsOpt / iterations})`)

  db.close()
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath)
}

runBenchmark().catch(console.error)

import { initDb } from '../src/db.js'
import { addTask, availableTasks } from '../src/tools/tasks.js'
import { performance } from 'perf_hooks'
import fs from 'fs'

async function runBenchmark() {
  const dbPath = 'benchmark.db'
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

  console.log(`Running availableTasks benchmark (${iterations} iterations)...`)
  const start = performance.now()
  let totalResults = 0
  for (let i = 0; i < iterations; i++) {
    const tasks = availableTasks(db, agentSkills)
    totalResults += tasks.length
  }
  const end = performance.now()

  const avgTime = (end - start) / iterations
  console.log(`Average availableTasks time: ${avgTime.toFixed(4)}ms`)
  console.log(`Total results found: ${totalResults / iterations}`)

  db.close()
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath)
}

runBenchmark().catch(console.error)

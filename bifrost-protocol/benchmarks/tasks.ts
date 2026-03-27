import Database from 'better-sqlite3';
import { addTask, availableTasks } from '../src/tools/tasks.js';
import { initDb } from '../src/db.js';
import { performance } from 'perf_hooks';
import fs from 'fs';

async function runBenchmark() {
  const dbPath = 'benchmark.db';
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  const db = initDb(dbPath);

  console.log('Populating database with 10,000 tasks...');
  const skillsPool = ['typescript', 'python', 'rust', 'go', 'java', 'sql', 'docker', 'kubernetes'];

  const startPopulate = performance.now();
  db.transaction(() => {
    for (let i = 0; i < 10000; i++) {
      const taskSkills = [];
      if (Math.random() > 0.2) {
        const numSkills = Math.floor(Math.random() * 3) + 1;
        for (let j = 0; j < numSkills; j++) {
          taskSkills.push(skillsPool[Math.floor(Math.random() * skillsPool.length)]);
        }
      }
      addTask(db, {
        id: `task-${i}`,
        priority: ['P0', 'P1', 'P2', 'P3'][Math.floor(Math.random() * 4)],
        skills: taskSkills,
        description: `Description for task ${i}`,
        parallel_safe: Math.random() > 0.5
      });
    }
  })();
  console.log(`Population took ${performance.now() - startPopulate}ms`);

  const agentSkills = ['typescript', 'sql'];

  // Warm up
  for (let i = 0; i < 10; i++) {
    availableTasks(db, agentSkills);
  }

  console.log('Running benchmark for availableTasks...');
  const start = performance.now();
  const iterations = 100;
  for (let i = 0; i < iterations; i++) {
    availableTasks(db, agentSkills);
  }
  const end = performance.now();
  console.log(`Average time for availableTasks: ${(end - start) / iterations}ms`);

  db.close();
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
}

runBenchmark().catch(console.error);

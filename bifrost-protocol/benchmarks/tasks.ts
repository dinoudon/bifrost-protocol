import { initDb } from '../src/db.js';
import { addTask, availableTasks } from '../src/tools/tasks.js';
import { performance } from 'perf_hooks';
import fs from 'fs';

async function benchmark() {
  const dbPath = 'benchmark.db';
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  const db = initDb(dbPath);

  const numTasks = 10000;
  console.log(`Adding ${numTasks} tasks...`);

  const insert = db.transaction((tasks) => {
    for (const t of tasks) {
      addTask(db, t);
    }
  });

  const tasks = [];
  for (let i = 0; i < numTasks; i++) {
    tasks.push({
      id: `task-${i}`,
      priority: i % 3 === 0 ? 'P0' : (i % 3 === 1 ? 'P1' : 'P2'),
      skills: [`skill-${i % 10}`, `skill-${(i + 1) % 10}`],
      description: `Task description ${i}`,
      parallel_safe: true
    });
  }
  insert(tasks);

  const agentSkills = ['skill-1', 'skill-5'];

  console.log('Benchmarking availableTasks...');
  const start = performance.now();
  for (let i = 0; i < 100; i++) {
    availableTasks(db, agentSkills);
  }
  const end = performance.now();

  console.log(`Average time for availableTasks: ${(end - start) / 100}ms`);

  db.close();
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
}

benchmark();

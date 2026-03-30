import { initDb } from '../src/db.js';
import { addTask, availableTasks } from '../src/tools/tasks.js';
import { performance } from 'perf_hooks';
import fs from 'fs';

async function benchmark() {
  const dbPath = 'benchmark.db';
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  const db = initDb(dbPath);

  console.log('Populating database with 10,000 tasks...');
  const insert = db.transaction((tasks) => {
    for (const t of tasks) {
      addTask(db, t);
    }
  });

  const tasks = [];
  for (let i = 0; i < 10000; i++) {
    tasks.push({
      id: `task-${i}`,
      priority: i % 3 === 0 ? 'P0' : (i % 3 === 1 ? 'P1' : 'P2'),
      skills: [`skill-${i % 100}`, `skill-${(i + 1) % 100}`],
      description: `Task description ${i}`,
      parallel_safe: true,
      group_id: `group-${i % 10}`
    });
  }
  insert(tasks);

  const agentSkills = ['skill-1', 'skill-50', 'skill-99'];

  console.log('Running availableTasks 100 times...');
  const start = performance.now();
  for (let i = 0; i < 100; i++) {
    availableTasks(db, agentSkills);
  }
  const end = performance.now();

  console.log(`Average execution time: ${((end - start) / 100).toFixed(4)}ms`);

  db.close();
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
}

benchmark().catch(console.error);

import { initDb } from '../src/db.js';
import { addTask, availableTasks } from '../src/tools/tasks.js';
import { performance } from 'perf_hooks';
import fs from 'fs';

const DB_PATH = 'benchmark.db';
if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);

const db = initDb(DB_PATH);

console.log('Seeding database with 10,000 tasks...');
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
    description: `Description for task ${i}`,
    parallel_safe: true
  });
}
insert(tasks);

const agentSkills = ['skill-1', 'skill-50', 'skill-99'];

console.log('Running benchmark for updated availableTasks...');
const start = performance.now();
for (let i = 0; i < 100; i++) {
  availableTasks(db, agentSkills);
}
const end = performance.now();
console.log(`Updated Average execution time: ${((end - start) / 100).toFixed(4)}ms`);

const count = availableTasks(db, agentSkills).length;
console.log(`Task count: ${count}`);

db.close();
if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);

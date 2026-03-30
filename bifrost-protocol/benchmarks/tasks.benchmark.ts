import Database from 'better-sqlite3';
import { addTask, availableTasks } from '../src/tools/tasks.js';
import { initDb } from '../src/db.js';

const db = initDb(':memory:');

// Insert 10,000 tasks
console.log('Inserting 10,000 tasks...');
const startInsert = Date.now();
for (let i = 0; i < 10000; i++) {
  addTask(db, {
    id: `T${i}`,
    priority: i % 3 === 0 ? 'P0' : (i % 3 === 1 ? 'P1' : 'P2'),
    skills: [`skill-${i % 50}`],
    description: `Task ${i}`,
    parallel_safe: false
  });
}
console.log(`Insertion took ${Date.now() - startInsert}ms`);

const agentSkills = ['skill-0', 'skill-10', 'skill-20', 'skill-30', 'skill-40'];

console.log('Benchmarking availableTasks...');
const startBench = Date.now();
let result;
for (let i = 0; i < 100; i++) {
  result = availableTasks(db, agentSkills);
}
const endBench = Date.now();
console.log(`100 calls to availableTasks took ${endBench - startBench}ms`);
console.log(`Average call time: ${(endBench - startBench) / 100}ms`);
console.log(`Found ${result.length} tasks`);

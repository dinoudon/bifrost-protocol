import { addTask, availableTasks } from '../src/tools/tasks.js';
import { initDb } from '../src/db.js';
import { performance } from 'perf_hooks';

const db = initDb(':memory:');

// Setup: Add 10000 tasks
console.log('Seeding 10000 tasks...');
for (let i = 0; i < 10000; i++) {
  addTask(db, {
    id: `task-${i}`,
    priority: i % 3 === 0 ? 'P0' : (i % 3 === 1 ? 'P1' : 'P2'),
    skills: [`skill-${i % 10}`, `skill-${(i + 1) % 10}`],
    description: `Description for task ${i}`,
    parallel_safe: true
  });
}

const agentSkills = ['skill-1', 'skill-5', 'skill-9'];

function benchmark(name, fn, iterations = 100) {
  // Warm up
  for (let i = 0; i < 10; i++) fn();

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const end = performance.now();
  console.log(`${name}: ${(end - start).toFixed(4)}ms (total for ${iterations} iterations), avg: ${((end - start) / iterations).toFixed(4)}ms`);
}

console.log('Starting baseline benchmark...');
benchmark('Original availableTasks', () => {
  availableTasks(db, agentSkills);
});

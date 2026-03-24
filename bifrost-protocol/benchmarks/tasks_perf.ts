
import { initDb } from '../src/db.js';
import { addTask, availableTasks } from '../src/tools/tasks.js';
import { Database } from 'better-sqlite3';

function benchmark() {
  const db = initDb(':memory:');
  const numTasks = 5000;
  const agentSkills = ['typescript', 'react', 'node'];

  console.log(`Seeding ${numTasks} tasks...`);
  for (let i = 0; i < numTasks; i++) {
    const skills = i % 2 === 0 ? ['typescript'] : ['rust'];
    addTask(db, {
      id: `T${i}`,
      priority: `P${(i % 5) + 1}`,
      skills,
      description: `Task ${i}`,
      parallel_safe: true
    });
  }

  console.log('Running benchmark for availableTasks...');
  const start = performance.now();
  for (let i = 0; i < 100; i++) {
    availableTasks(db, agentSkills);
  }
  const end = performance.now();

  console.log(`Execution time (100 iterations): ${(end - start).toFixed(2)}ms`);
  console.log(`Average time per call: ${((end - start) / 100).toFixed(4)}ms`);
}

benchmark();

import { initDb } from '../src/db.js';
import { addTask, availableTasks } from '../src/tools/tasks.js';

async function runBenchmark() {
  const db = initDb(':memory:');
  const taskCount = 10000;
  const agentSkills = ['typescript', 'auth'];

  console.log(`Inserting ${taskCount} tasks...`);
  for (let i = 0; i < taskCount; i++) {
    const skills = i % 2 === 0 ? ['typescript'] : ['python'];
    addTask(db, {
      id: `T${i}`,
      priority: 'P1',
      skills: skills,
      description: `Task ${i}`,
      parallel_safe: false
    });
  }

  console.log('Running availableTasks benchmark...');
  const start = performance.now();
  const tasks = availableTasks(db, agentSkills);
  const end = performance.now();

  console.log(`Found ${tasks.length} tasks.`);
  console.log(`Execution time: ${(end - start).toFixed(4)}ms`);
}

runBenchmark().catch(console.error);

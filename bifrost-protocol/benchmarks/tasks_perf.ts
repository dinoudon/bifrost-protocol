import Database from 'better-sqlite3';
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

function availableTasksOptimized(db, agentSkills) {
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
  `);
  return stmt.all(JSON.stringify(agentSkills));
}

const preparedStmt = db.prepare(`
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
  `);

function availableTasksOptimizedPrepared(db, agentSkills) {
  return preparedStmt.all(JSON.stringify(agentSkills));
}

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

console.log('Starting benchmark...');
benchmark('Original availableTasks', () => {
  availableTasks(db, agentSkills);
});

benchmark('Optimized availableTasks (SQL filtering, prepare inside)', () => {
  availableTasksOptimized(db, agentSkills);
});

benchmark('Optimized availableTasks (SQL filtering, prepared outside)', () => {
  availableTasksOptimizedPrepared(db, agentSkills);
});

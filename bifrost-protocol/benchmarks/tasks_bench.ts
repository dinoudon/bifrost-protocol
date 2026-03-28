
import Database from 'better-sqlite3';
import { addTask, availableTasks } from '../src/tools/tasks.js';
import { unlinkSync } from 'fs';

const DB_PATH = 'bench.db';

function setup(count: number) {
  try { unlinkSync(DB_PATH); } catch {}
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      priority TEXT NOT NULL DEFAULT 'P2',
      skills TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'unassigned',
      owner TEXT,
      parallel_safe INTEGER NOT NULL DEFAULT 0,
      group_id TEXT,
      description TEXT NOT NULL
    );
  `);

  const insert = db.prepare(`
    INSERT INTO tasks (id, priority, skills, status, parallel_safe, group_id, description)
    VALUES (?, ?, ?, 'unassigned', ?, ?, ?)
  `);

  const transaction = db.transaction((tasks) => {
    for (const t of tasks) {
      insert.run(t.id, t.priority, JSON.stringify(t.skills), t.parallel_safe ? 1 : 0, t.group_id ?? null, t.description);
    }
  });

  const tasks = [];
  for (let i = 0; i < count; i++) {
    tasks.push({
      id: `task-${i}`,
      priority: i % 3 === 0 ? 'P0' : (i % 3 === 1 ? 'P1' : 'P2'),
      skills: i % 5 === 0 ? ['typescript'] : (i % 5 === 1 ? ['rust'] : []),
      parallel_safe: true,
      description: `Task ${i}`
    });
  }
  transaction(tasks);
  return db;
}

async function runBench() {
  const count = 10000;
  const db = setup(count);
  const agentSkills = ['typescript', 'node'];

  console.log(`Benchmarking availableTasks with ${count} tasks...`);

  // Warmup
  availableTasks(db, agentSkills);

  const start = performance.now();
  const iterations = 100;
  for (let i = 0; i < iterations; i++) {
    availableTasks(db, agentSkills);
  }
  const end = performance.now();

  console.log(`Average execution time: ${((end - start) / iterations).toFixed(4)}ms`);

  db.close();
  try { unlinkSync(DB_PATH); } catch {}
}

runBench();

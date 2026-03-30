import { initDb } from '../src/db.js';
import { addTask, availableTasks } from '../src/tools/tasks.js';
import { performance } from 'perf_hooks';
import fs from 'fs';

const DB_PATH = 'bench.db';
if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);

const db = initDb(DB_PATH);

// Previous JS version for comparison
function availableTasksJs(db: any, agentSkills: string[]) {
  const all = db.prepare("SELECT * FROM tasks WHERE status='unassigned' ORDER BY priority ASC").all() as any[]
  return all.filter(t => {
    const required: string[] = JSON.parse(t.skills)
    return required.length === 0 || required.some(s => agentSkills.includes(s))
  })
}

console.log('Populating database with 5000 tasks...');
const startPopulate = performance.now();
db.transaction((tasks: any[]) => {
  for (const t of tasks) {
    addTask(db, t);
  }
})(Array.from({ length: 5000 }, (_, i) => ({
  id: `task-${i}`,
  priority: i % 3 === 0 ? 'P0' : (i % 3 === 1 ? 'P1' : 'P2'),
  skills: [`skill-${i % 100}`, `skill-${(i + 1) % 100}`],
  description: `Description ${i}`,
  parallel_safe: true
})));
console.log(`Population took ${performance.now() - startPopulate}ms`);

const agentSkills = ['skill-1', 'skill-5', 'skill-9', 'skill-20', 'skill-45', 'skill-88'];

console.log('Benchmarking availableTasks (JS filtering)...');
let totalJsTime = 0;
const iterations = 100;
for (let i = 0; i < iterations; i++) {
  const start = performance.now();
  availableTasksJs(db, agentSkills);
  totalJsTime += (performance.now() - start);
}
console.log(`Average JS time: ${totalJsTime / iterations}ms`);

console.log('Benchmarking availableTasks (SQL filtering - NEW)...');
let totalSqlTime = 0;
for (let i = 0; i < iterations; i++) {
  const start = performance.now();
  availableTasks(db, agentSkills);
  totalSqlTime += (performance.now() - start);
}
console.log(`Average SQL time: ${totalSqlTime / iterations}ms`);
console.log(`Improvement: ${((totalJsTime - totalSqlTime) / totalJsTime * 100).toFixed(2)}%`);

// Verify results are identical
const resJs = availableTasksJs(db, agentSkills);
const resSql = availableTasks(db, agentSkills);
console.log(`JS Count: ${resJs.length}, SQL Count: ${resSql.length}`);
if (resJs.length !== resSql.length) {
    console.error("ERROR: RESULT COUNTS DO NOT MATCH!");
}

db.close();
if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);

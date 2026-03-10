# Custom Multi-Agent Protocol Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a production-ready two-tier hybrid inter-agent communication protocol with SQLite state, a custom MCP server, and formal distributed systems patterns.

**Architecture:** Tier 1 compressed text pings for high-frequency status updates; Tier 2 JSON messages persisted to SQLite via MCP for lifecycle events. A custom Node.js MCP server acts as the central enforcer, router, and state manager.

**Tech Stack:** Node.js + TypeScript, SQLite (via `better-sqlite3`), MCP SDK (`@modelcontextprotocol/sdk`), Zod for validation, Vitest for tests.

---

## Task 1: Project Scaffold

**Files:**
- Create: `custom-protocol-mcp/package.json`
- Create: `custom-protocol-mcp/tsconfig.json`
- Create: `custom-protocol-mcp/src/index.ts`

**Step 1: Initialize the project**

```bash
cd /c/Work/ai/efficiency
mkdir -p custom-protocol-mcp/src
cd custom-protocol-mcp
npm init -y
```

**Step 2: Install dependencies**

```bash
npm install @modelcontextprotocol/sdk better-sqlite3 zod
npm install -D typescript @types/node @types/better-sqlite3 vitest tsx
```

**Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true
  },
  "include": ["src/**/*"]
}
```

**Step 4: Update `package.json` scripts**

```json
{
  "type": "module",
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "test": "vitest run"
  }
}
```

**Step 5: Create minimal `src/index.ts` to verify build**

```typescript
console.log("custom-protocol-mcp starting");
```

**Step 6: Verify build works**

Run: `npm run build`
Expected: No errors, `dist/` folder created.

**Step 7: Commit**

```bash
cd /c/Work/ai/efficiency
git init
git add custom-protocol-mcp/
git commit -m "feat: scaffold custom-protocol-mcp project"
```

---

## Task 2: SQLite Schema

**Files:**
- Create: `custom-protocol-mcp/src/db.ts`
- Create: `custom-protocol-mcp/src/db.test.ts`

**Step 1: Write the failing test**

```typescript
// src/db.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { initDb } from './db.js'

describe('initDb', () => {
  it('creates all required tables', () => {
    const db = initDb(':memory:')
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table'"
    ).all() as { name: string }[]
    const names = tables.map(t => t.name)
    expect(names).toContain('agents')
    expect(names).toContain('tasks')
    expect(names).toContain('locks')
    expect(names).toContain('checkpoints')
    expect(names).toContain('events')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `initDb` not found.

**Step 3: Implement `src/db.ts`**

```typescript
import Database from 'better-sqlite3'

export function initDb(path: string = 'TEAM_STATE.db') {
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      domain TEXT NOT NULL,
      skills TEXT NOT NULL,       -- JSON array stored as text
      capacity INTEGER NOT NULL DEFAULT 3,
      status TEXT NOT NULL DEFAULT 'active',
      last_heartbeat INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      priority TEXT NOT NULL DEFAULT 'P2',
      skills TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'unassigned',
      owner TEXT,
      parallel_safe INTEGER NOT NULL DEFAULT 0,
      group_id TEXT,
      description TEXT NOT NULL,
      FOREIGN KEY (owner) REFERENCES agents(id)
    );

    CREATE TABLE IF NOT EXISTS locks (
      file TEXT PRIMARY KEY,
      owner_agent TEXT NOT NULL,
      acquired_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (owner_agent) REFERENCES agents(id)
    );

    CREATE TABLE IF NOT EXISTS checkpoints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent TEXT NOT NULL,
      task TEXT NOT NULL,
      status TEXT NOT NULL,
      context TEXT NOT NULL,
      artifacts TEXT NOT NULL DEFAULT '[]',
      timestamp INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      agent TEXT NOT NULL,
      payload TEXT NOT NULL,
      timestamp INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `)

  return db
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add custom-protocol-mcp/src/db.ts custom-protocol-mcp/src/db.test.ts
git commit -m "feat: SQLite schema with all 5 tables"
```

---

## Task 3: Tier 1 Syntax Validator

**Files:**
- Create: `custom-protocol-mcp/src/tier1.ts`
- Create: `custom-protocol-mcp/src/tier1.test.ts`

**Step 1: Write failing tests**

```typescript
// src/tier1.test.ts
import { describe, it, expect } from 'vitest'
import { parseTier1, validateTier1 } from './tier1.js'

describe('validateTier1', () => {
  it('accepts valid status ping', () => {
    expect(validateTier1('alphaT3 AUTH +jwt-middleware')).toBe(true)
  })
  it('accepts urgent priority', () => {
    expect(validateTier1('!!epsilonP0 AUTH !bypass L140 @A2')).toBe(true)
  })
  it('accepts batch delta', () => {
    expect(validateTier1('..deltaT3,T4,T6 AUTH -lock')).toBe(true)
  })
  it('accepts heartbeat', () => {
    expect(validateTier1('..betaA3 alive T5:60%')).toBe(true)
  })
  it('rejects empty string', () => {
    expect(validateTier1('')).toBe(false)
  })
  it('rejects plain English', () => {
    expect(validateTier1("I've finished fixing the component")).toBe(false)
  })
})

describe('parseTier1', () => {
  it('extracts status code', () => {
    const result = parseTier1('alphaT3 AUTH +jwt-middleware')
    expect(result.status).toBe('alpha')
    expect(result.taskRef).toBe('T3')
    expect(result.priority).toBeNull()
  })
  it('extracts priority', () => {
    const result = parseTier1('!!epsilonP0 AUTH !bypass L140')
    expect(result.priority).toBe('!!')
    expect(result.status).toBe('epsilon')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `parseTier1` not found.

**Step 3: Implement `src/tier1.ts`**

```typescript
const STATUS_CODES = [
  'alpha','beta','gamma','delta','epsilon',
  'omega','theta','rho','sigma','phi','chi'
]

const TIER1_PATTERN = new RegExp(
  `^(!!|\\.\\.)?(${STATUS_CODES.join('|')})(P[0-3])?\\d*`
)

export interface Tier1Message {
  priority: '!!' | '..' | null
  status: string
  taskRef: string | null
  raw: string
}

export function validateTier1(msg: string): boolean {
  if (!msg.trim()) return false
  return TIER1_PATTERN.test(msg.trim())
}

export function parseTier1(msg: string): Tier1Message {
  const trimmed = msg.trim()
  let rest = trimmed
  let priority: '!!' | '..' | null = null

  if (rest.startsWith('!!')) { priority = '!!'; rest = rest.slice(2) }
  else if (rest.startsWith('..')) { priority = '..'; rest = rest.slice(2) }

  const statusMatch = rest.match(new RegExp(`^(${STATUS_CODES.join('|')})`))
  const status = statusMatch ? statusMatch[1] : ''
  rest = rest.slice(status.length)

  const taskMatch = rest.match(/^T(\d+)/)
  const taskRef = taskMatch ? `T${taskMatch[1]}` : null

  return { priority, status, taskRef, raw: trimmed }
}
```

**Step 4: Run tests**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add custom-protocol-mcp/src/tier1.ts custom-protocol-mcp/src/tier1.test.ts
git commit -m "feat: Tier 1 syntax validator and parser"
```

---

## Task 4: Core MCP Tools — Agent Lifecycle

**Files:**
- Create: `custom-protocol-mcp/src/tools/agent.ts`
- Create: `custom-protocol-mcp/src/tools/agent.test.ts`

**Step 1: Write failing tests**

```typescript
// src/tools/agent.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { initDb } from '../db.js'
import { registerAgent, heartbeat, getTeamState } from './agent.js'
import type { Database } from 'better-sqlite3'

let db: ReturnType<typeof initDb>

beforeEach(() => { db = initDb(':memory:') })

describe('registerAgent', () => {
  it('inserts agent row', () => {
    registerAgent(db, { id: 'A1', role: 'coder', domain: 'dev', skills: ['typescript'], capacity: 3 })
    const row = db.prepare('SELECT * FROM agents WHERE id=?').get('A1') as any
    expect(row.role).toBe('coder')
    expect(JSON.parse(row.skills)).toContain('typescript')
  })
  it('logs register event', () => {
    registerAgent(db, { id: 'A1', role: 'coder', domain: 'dev', skills: [], capacity: 2 })
    const event = db.prepare("SELECT * FROM events WHERE type='register'").get() as any
    expect(event).toBeTruthy()
  })
})

describe('heartbeat', () => {
  it('updates last_heartbeat', () => {
    registerAgent(db, { id: 'A1', role: 'coder', domain: 'dev', skills: [], capacity: 2 })
    const before = (db.prepare('SELECT last_heartbeat FROM agents WHERE id=?').get('A1') as any).last_heartbeat
    heartbeat(db, 'A1')
    const after = (db.prepare('SELECT last_heartbeat FROM agents WHERE id=?').get('A1') as any).last_heartbeat
    expect(after).toBeGreaterThanOrEqual(before)
  })
})

describe('getTeamState', () => {
  it('returns agents and tasks', () => {
    registerAgent(db, { id: 'A1', role: 'coder', domain: 'dev', skills: [], capacity: 2 })
    const state = getTeamState(db)
    expect(state.agents).toHaveLength(1)
    expect(state.tasks).toHaveLength(0)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL

**Step 3: Implement `src/tools/agent.ts`**

```typescript
import type { Database } from 'better-sqlite3'

interface RegisterPayload {
  id: string; role: string; domain: string; skills: string[]; capacity: number
}

export function registerAgent(db: Database, payload: RegisterPayload) {
  db.prepare(`
    INSERT OR REPLACE INTO agents (id, role, domain, skills, capacity, status, last_heartbeat)
    VALUES (?, ?, ?, ?, ?, 'active', unixepoch())
  `).run(payload.id, payload.role, payload.domain, JSON.stringify(payload.skills), payload.capacity)

  db.prepare(`INSERT INTO events (type, agent, payload) VALUES ('register', ?, ?)`)
    .run(payload.id, JSON.stringify(payload))
}

export function heartbeat(db: Database, agentId: string) {
  db.prepare(`UPDATE agents SET last_heartbeat=unixepoch() WHERE id=?`).run(agentId)
}

export function markDegraded(db: Database, agentId: string) {
  db.prepare(`UPDATE agents SET status='degraded' WHERE id=?`).run(agentId)
  db.prepare(`INSERT INTO events (type, agent, payload) VALUES ('degraded', ?, ?)`)
    .run(agentId, JSON.stringify({ reason: 'missed_heartbeats' }))
}

export function getTeamState(db: Database) {
  const agents = db.prepare('SELECT * FROM agents').all()
  const tasks = db.prepare('SELECT * FROM tasks').all()
  const locks = db.prepare('SELECT * FROM locks').all()
  return { agents, tasks, locks }
}
```

**Step 4: Run tests**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add custom-protocol-mcp/src/tools/
git commit -m "feat: agent lifecycle tools — register, heartbeat, team-state"
```

---

## Task 5: Core MCP Tools — Task Queue & Work Stealing

**Files:**
- Create: `custom-protocol-mcp/src/tools/tasks.ts`
- Create: `custom-protocol-mcp/src/tools/tasks.test.ts`

**Step 1: Write failing tests**

```typescript
// src/tools/tasks.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { initDb } from '../db.js'
import { registerAgent } from './agent.js'
import { addTask, claimTask, availableTasks } from './tasks.js'

let db: ReturnType<typeof initDb>

beforeEach(() => {
  db = initDb(':memory:')
  registerAgent(db, { id: 'A1', role: 'coder', domain: 'dev', skills: ['typescript','auth'], capacity: 3 })
})

describe('addTask', () => {
  it('inserts task with unassigned status', () => {
    addTask(db, { id: 'T1', priority: 'P0', skills: ['auth'], description: 'fix jwt', parallel_safe: false })
    const row = db.prepare('SELECT * FROM tasks WHERE id=?').get('T1') as any
    expect(row.status).toBe('unassigned')
  })
})

describe('availableTasks', () => {
  it('returns tasks matching agent skills', () => {
    addTask(db, { id: 'T1', priority: 'P1', skills: ['auth'], description: 'fix jwt', parallel_safe: false })
    addTask(db, { id: 'T2', priority: 'P1', skills: ['python'], description: 'other', parallel_safe: false })
    const tasks = availableTasks(db, ['typescript','auth'])
    expect(tasks.map((t: any) => t.id)).toContain('T1')
    expect(tasks.map((t: any) => t.id)).not.toContain('T2')
  })
})

describe('claimTask', () => {
  it('atomically assigns task to agent', () => {
    addTask(db, { id: 'T1', priority: 'P1', skills: ['auth'], description: 'fix jwt', parallel_safe: false })
    const result = claimTask(db, 'T1', 'A1')
    expect(result.success).toBe(true)
    const row = db.prepare('SELECT * FROM tasks WHERE id=?').get('T1') as any
    expect(row.owner).toBe('A1')
    expect(row.status).toBe('in_progress')
  })
  it('rejects double-claim', () => {
    registerAgent(db, { id: 'A2', role: 'coder', domain: 'dev', skills: ['auth'], capacity: 2 })
    addTask(db, { id: 'T1', priority: 'P1', skills: ['auth'], description: 'fix jwt', parallel_safe: false })
    claimTask(db, 'T1', 'A1')
    const result = claimTask(db, 'T1', 'A2')
    expect(result.success).toBe(false)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL

**Step 3: Implement `src/tools/tasks.ts`**

```typescript
import type { Database } from 'better-sqlite3'

interface TaskPayload {
  id: string; priority: string; skills: string[]
  description: string; parallel_safe: boolean; group_id?: string
}

export function addTask(db: Database, task: TaskPayload) {
  db.prepare(`
    INSERT INTO tasks (id, priority, skills, status, parallel_safe, group_id, description)
    VALUES (?, ?, ?, 'unassigned', ?, ?, ?)
  `).run(task.id, task.priority, JSON.stringify(task.skills),
         task.parallel_safe ? 1 : 0, task.group_id ?? null, task.description)
}

export function availableTasks(db: Database, agentSkills: string[]) {
  const all = db.prepare("SELECT * FROM tasks WHERE status='unassigned' ORDER BY priority ASC").all() as any[]
  return all.filter(t => {
    const required: string[] = JSON.parse(t.skills)
    return required.length === 0 || required.some(s => agentSkills.includes(s))
  })
}

export function claimTask(db: Database, taskId: string, agentId: string): { success: boolean } {
  const claim = db.transaction(() => {
    const task = db.prepare("SELECT * FROM tasks WHERE id=? AND status='unassigned'").get(taskId)
    if (!task) return { success: false }
    db.prepare("UPDATE tasks SET status='in_progress', owner=? WHERE id=?").run(agentId, taskId)
    db.prepare("INSERT INTO events (type, agent, payload) VALUES ('claim', ?, ?)")
      .run(agentId, JSON.stringify({ taskId }))
    return { success: true }
  })
  return claim()
}
```

**Step 4: Run tests**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add custom-protocol-mcp/src/tools/tasks.ts custom-protocol-mcp/src/tools/tasks.test.ts
git commit -m "feat: task queue with atomic work-stealing via claimTask"
```

---

## Task 6: Core MCP Tools — Locks, Checkpoints, Handoffs

**Files:**
- Create: `custom-protocol-mcp/src/tools/coordination.ts`
- Create: `custom-protocol-mcp/src/tools/coordination.test.ts`

**Step 1: Write failing tests**

```typescript
// src/tools/coordination.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { initDb } from '../db.js'
import { registerAgent } from './agent.js'
import { acquireLock, releaseLock, writeCheckpoint, writeHandoff, writeShutdown } from './coordination.js'

let db: ReturnType<typeof initDb>

beforeEach(() => {
  db = initDb(':memory:')
  registerAgent(db, { id: 'A1', role: 'coder', domain: 'dev', skills: [], capacity: 2 })
  registerAgent(db, { id: 'A2', role: 'coder', domain: 'dev', skills: [], capacity: 2 })
})

describe('acquireLock', () => {
  it('grants lock to first claimer', () => {
    expect(acquireLock(db, 'AUTH', 'A1').success).toBe(true)
  })
  it('denies lock to second claimer', () => {
    acquireLock(db, 'AUTH', 'A1')
    expect(acquireLock(db, 'AUTH', 'A2').success).toBe(false)
  })
})

describe('releaseLock', () => {
  it('releases owned lock', () => {
    acquireLock(db, 'AUTH', 'A1')
    expect(releaseLock(db, 'AUTH', 'A1').success).toBe(true)
    expect(acquireLock(db, 'AUTH', 'A2').success).toBe(true)
  })
  it('refuses to release lock owned by other', () => {
    acquireLock(db, 'AUTH', 'A1')
    expect(releaseLock(db, 'AUTH', 'A2').success).toBe(false)
  })
})

describe('writeCheckpoint', () => {
  it('inserts checkpoint row', () => {
    writeCheckpoint(db, { agent: 'A1', task: 'T1', status: 'gamma', context: 'half done', artifacts: ['src/auth.ts'] })
    const row = db.prepare('SELECT * FROM checkpoints WHERE agent=?').get('A1') as any
    expect(row.context).toBe('half done')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL

**Step 3: Implement `src/tools/coordination.ts`**

```typescript
import type { Database } from 'better-sqlite3'

export function acquireLock(db: Database, file: string, agentId: string): { success: boolean } {
  const acquire = db.transaction(() => {
    const existing = db.prepare('SELECT * FROM locks WHERE file=?').get(file)
    if (existing) return { success: false }
    db.prepare('INSERT INTO locks (file, owner_agent) VALUES (?, ?)').run(file, agentId)
    db.prepare("INSERT INTO events (type, agent, payload) VALUES ('lock_acquire', ?, ?)")
      .run(agentId, JSON.stringify({ file }))
    return { success: true }
  })
  return acquire()
}

export function releaseLock(db: Database, file: string, agentId: string): { success: boolean } {
  const release = db.transaction(() => {
    const lock = db.prepare('SELECT * FROM locks WHERE file=?').get(file) as any
    if (!lock || lock.owner_agent !== agentId) return { success: false }
    db.prepare('DELETE FROM locks WHERE file=?').run(file)
    db.prepare("INSERT INTO events (type, agent, payload) VALUES ('lock_release', ?, ?)")
      .run(agentId, JSON.stringify({ file }))
    return { success: true }
  })
  return release()
}

export function writeCheckpoint(db: Database, cp: {
  agent: string; task: string; status: string; context: string; artifacts: string[]
}) {
  db.prepare(`
    INSERT INTO checkpoints (agent, task, status, context, artifacts)
    VALUES (?, ?, ?, ?, ?)
  `).run(cp.agent, cp.task, cp.status, cp.context, JSON.stringify(cp.artifacts))
}

export function writeHandoff(db: Database, payload: {
  from: string; to: string; task: string; summary: string
}) {
  db.prepare("INSERT INTO events (type, agent, payload) VALUES ('handoff', ?, ?)")
    .run(payload.from, JSON.stringify(payload))
  db.prepare("UPDATE tasks SET owner=? WHERE id=?").run(payload.to, payload.task)
}

export function writeShutdown(db: Database, payload: {
  agent: string; completed: string[]; incomplete: string[]; theta: string[]
}) {
  db.prepare("UPDATE agents SET status='offline' WHERE id=?").run(payload.agent)
  db.prepare("INSERT INTO events (type, agent, payload) VALUES ('shutdown', ?, ?)")
    .run(payload.agent, JSON.stringify(payload))
}
```

**Step 4: Run tests**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add custom-protocol-mcp/src/tools/coordination.ts custom-protocol-mcp/src/tools/coordination.test.ts
git commit -m "feat: lock, checkpoint, handoff, shutdown coordination tools"
```

---

## Task 7: Circuit Breaker (Heartbeat Monitor)

**Files:**
- Create: `custom-protocol-mcp/src/circuit-breaker.ts`
- Create: `custom-protocol-mcp/src/circuit-breaker.test.ts`

**Step 1: Write failing tests**

```typescript
// src/circuit-breaker.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { initDb } from './db.js'
import { registerAgent } from './tools/agent.js'
import { addTask } from './tools/tasks.js'
import { checkHeartbeats } from './circuit-breaker.js'

let db: ReturnType<typeof initDb>

beforeEach(() => {
  db = initDb(':memory:')
  registerAgent(db, { id: 'A1', role: 'coder', domain: 'dev', skills: ['auth'], capacity: 2 })
  addTask(db, { id: 'T1', priority: 'P1', skills: ['auth'], description: 'fix jwt', parallel_safe: false })
  db.prepare("UPDATE tasks SET status='in_progress', owner='A1' WHERE id='T1'").run()
})

describe('checkHeartbeats', () => {
  it('marks agent degraded if heartbeat too old', () => {
    // Set heartbeat to 5 minutes ago
    db.prepare("UPDATE agents SET last_heartbeat=unixepoch()-300 WHERE id='A1'").run()
    const rerouted = checkHeartbeats(db, { thresholdSeconds: 180, maxMissed: 1 })
    const agent = db.prepare("SELECT status FROM agents WHERE id='A1'").get() as any
    expect(agent.status).toBe('degraded')
    expect(rerouted).toContain('T1')
  })
  it('leaves healthy agent alone', () => {
    checkHeartbeats(db, { thresholdSeconds: 180, maxMissed: 1 })
    const agent = db.prepare("SELECT status FROM agents WHERE id='A1'").get() as any
    expect(agent.status).toBe('active')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL

**Step 3: Implement `src/circuit-breaker.ts`**

```typescript
import type { Database } from 'better-sqlite3'
import { markDegraded } from './tools/agent.js'

interface CBOptions { thresholdSeconds: number; maxMissed: number }

export function checkHeartbeats(db: Database, opts: CBOptions): string[] {
  const cutoff = Math.floor(Date.now() / 1000) - opts.thresholdSeconds
  const stale = db.prepare(
    "SELECT id FROM agents WHERE status='active' AND last_heartbeat < ?"
  ).all(cutoff) as { id: string }[]

  const reroutedTasks: string[] = []

  for (const { id } of stale) {
    markDegraded(db, id)
    const orphaned = db.prepare(
      "UPDATE tasks SET status='unassigned', owner=NULL WHERE owner=? AND status='in_progress' RETURNING id"
    ).all(id) as { id: string }[]
    reroutedTasks.push(...orphaned.map(t => t.id))
    db.prepare("DELETE FROM locks WHERE owner_agent=?").run(id)
  }

  return reroutedTasks
}
```

**Step 4: Run tests**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add custom-protocol-mcp/src/circuit-breaker.ts custom-protocol-mcp/src/circuit-breaker.test.ts
git commit -m "feat: circuit breaker — marks degraded agents, reroutes orphaned tasks"
```

---

## Task 8: Wire MCP Server

**Files:**
- Modify: `custom-protocol-mcp/src/index.ts`

**Step 1: Replace `index.ts` with full MCP server**

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { initDb } from './db.js'
import { registerAgent, heartbeat, getTeamState } from './tools/agent.js'
import { addTask, availableTasks, claimTask } from './tools/tasks.js'
import { acquireLock, releaseLock, writeCheckpoint, writeHandoff, writeShutdown } from './tools/coordination.js'
import { checkHeartbeats } from './circuit-breaker.js'

const db = initDb()
const server = new McpServer({ name: 'custom-protocol-mcp', version: '1.0.0' })

// Heartbeat monitor — check every 60s
setInterval(() => checkHeartbeats(db, { thresholdSeconds: 180, maxMissed: 3 }), 60_000)

server.tool('get_team_state', {}, async () => ({
  content: [{ type: 'text', text: JSON.stringify(getTeamState(db), null, 2) }]
}))

server.tool('register_agent', {
  id: z.string(), role: z.string(), domain: z.string(),
  skills: z.array(z.string()), capacity: z.number().int().default(3)
}, async (args) => {
  registerAgent(db, args)
  return { content: [{ type: 'text', text: `Agent ${args.id} registered` }] }
})

server.tool('heartbeat', { agent_id: z.string() }, async ({ agent_id }) => {
  heartbeat(db, agent_id)
  return { content: [{ type: 'text', text: 'ok' }] }
})

server.tool('add_task', {
  id: z.string(), priority: z.string().default('P2'),
  skills: z.array(z.string()).default([]),
  description: z.string(),
  parallel_safe: z.boolean().default(false),
  group_id: z.string().optional()
}, async (args) => {
  addTask(db, args)
  return { content: [{ type: 'text', text: `Task ${args.id} added` }] }
})

server.tool('get_available_tasks', {
  skills: z.array(z.string()).default([])
}, async ({ skills }) => {
  const tasks = availableTasks(db, skills)
  return { content: [{ type: 'text', text: JSON.stringify(tasks, null, 2) }] }
})

server.tool('claim_task', {
  task_id: z.string(), agent_id: z.string()
}, async ({ task_id, agent_id }) => {
  const result = claimTask(db, task_id, agent_id)
  return { content: [{ type: 'text', text: JSON.stringify(result) }] }
})

server.tool('acquire_lock', {
  file: z.string(), agent_id: z.string()
}, async ({ file, agent_id }) => {
  const result = acquireLock(db, file, agent_id)
  return { content: [{ type: 'text', text: JSON.stringify(result) }] }
})

server.tool('release_lock', {
  file: z.string(), agent_id: z.string()
}, async ({ file, agent_id }) => {
  const result = releaseLock(db, file, agent_id)
  return { content: [{ type: 'text', text: JSON.stringify(result) }] }
})

server.tool('checkpoint', {
  agent: z.string(), task: z.string(), status: z.string(),
  context: z.string(), artifacts: z.array(z.string()).default([])
}, async (args) => {
  writeCheckpoint(db, args)
  return { content: [{ type: 'text', text: 'Checkpoint saved' }] }
})

server.tool('handoff', {
  from: z.string(), to: z.string(), task: z.string(), summary: z.string()
}, async (args) => {
  writeHandoff(db, args)
  return { content: [{ type: 'text', text: `Task ${args.task} handed off to ${args.to}` }] }
})

server.tool('shutdown', {
  agent: z.string(),
  completed: z.array(z.string()).default([]),
  incomplete: z.array(z.string()).default([]),
  theta: z.array(z.string()).default([])
}, async (args) => {
  writeShutdown(db, args)
  return { content: [{ type: 'text', text: `Agent ${args.agent} shut down` }] }
})

const transport = new StdioServerTransport()
await server.connect(transport)
```

**Step 2: Build**

Run: `npm run build`
Expected: No TypeScript errors.

**Step 3: Commit**

```bash
git add custom-protocol-mcp/src/index.ts
git commit -m "feat: wire all tools into MCP server with heartbeat monitor"
```

---

## Task 9: `AGENT_PROTOCOL.md` Spec File

**Files:**
- Create: `AGENT_PROTOCOL.md`

**Step 1: Write the spec**

Create `AGENT_PROTOCOL.md` at project root with full Tier 1/2 syntax, all status codes, actions, priority markers, shortcodes section, and bootstrap sequence. (Full content from design doc section "Tier 1" and "Tier 2".)

Reference: `docs/plans/2026-03-09-custom-agent-protocol-design.md`

**Step 2: Commit**

```bash
git add AGENT_PROTOCOL.md
git commit -m "docs: add AGENT_PROTOCOL.md full spec"
```

---

## Task 10: `CLAUDE.md` Bootstrap Instructions

**Files:**
- Create: `CLAUDE.md`

**Step 1: Write bootstrap instructions**

```markdown
# Agent Bootstrap Instructions

You are part of a multi-agent Claude Code team. Follow these steps on every spawn:

1. Read `AGENT_PROTOCOL.md` — internalize all syntax before sending any message
2. Call MCP tool `get_team_state` — discover active agents, tasks, and locks
3. Call MCP tool `register_agent` with your id, role, domain, skills, and capacity
4. Call MCP tool `get_available_tasks` with your skills — find work to claim
5. Call MCP tool `claim_task` for the highest-priority matching task
6. Begin work. Use Tier 1 pings in your messages. Use MCP tools for Tier 2 lifecycle events.
7. Call `heartbeat` every ~2 minutes while active
8. Call `shutdown` with completed/incomplete task lists when done

## MCP Server
Server name: `custom-protocol-mcp`
All state lives in `TEAM_STATE.db` — never read/write it directly. Always use MCP tools.

## Protocol Reference
See `AGENT_PROTOCOL.md` for full syntax.
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: CLAUDE.md bootstrap instructions for agent teams"
```

---

## Task 11: 3-Agent Pilot Test

**Goal:** Manually verify the full protocol works end-to-end with 3 agents: coder (A1), researcher (A2), reviewer (A3).

**Step 1: Start the MCP server**

```bash
cd custom-protocol-mcp && npm run build && node dist/index.js
```

**Step 2: Simulate agent registration**

Using MCP inspector or direct tool calls:
```json
register_agent: { "id": "A1", "role": "coder", "domain": "dev", "skills": ["typescript","auth"], "capacity": 3 }
register_agent: { "id": "A2", "role": "researcher", "domain": "research", "skills": ["sources","synthesis"], "capacity": 2 }
register_agent: { "id": "A3", "role": "reviewer", "domain": "dev", "skills": ["typescript","review"], "capacity": 4 }
```

**Step 3: Add tasks to queue**

```json
add_task: { "id": "T1", "priority": "P1", "skills": ["auth"], "description": "implement jwt refresh" }
add_task: { "id": "T2", "priority": "P2", "skills": ["sources"], "description": "research oauth best practices" }
add_task: { "id": "T3", "priority": "P2", "skills": ["review"], "description": "review auth implementation", "parallel_safe": false }
```

**Step 4: Verify work stealing**

Call `get_available_tasks` with `["typescript","auth"]` — should return T1 only.
Call `claim_task T1 A1` — should succeed.
Call `claim_task T1 A2` — should fail (already claimed).

**Step 5: Verify lock system**

Call `acquire_lock AUTH A1` — should succeed.
Call `acquire_lock AUTH A2` — should fail.
Call `release_lock AUTH A1` — should succeed.
Call `acquire_lock AUTH A3` — should now succeed.

**Step 6: Verify circuit breaker**

Manually set A1's heartbeat to old timestamp:
```sql
UPDATE agents SET last_heartbeat=unixepoch()-400 WHERE id='A1';
```
Call `checkHeartbeats` — A1 should become `degraded`, T1 back to `unassigned`.

**Step 7: Commit pilot test notes**

```bash
git add docs/
git commit -m "test: 3-agent pilot verification complete"
```

---

## Task 12: Global MCP Config (Any Project, Any Language)

**Files:**
- Modify: `~/.claude/settings.json` (global Claude Code config)
- Create: `examples/python-project/CLAUDE.md`
- Create: `examples/python-project/AGENT_PROTOCOL.md` (symlink or copy)

**Step 1: Build the MCP server for global use**

```bash
cd /c/Work/ai/efficiency/custom-protocol-mcp
npm run build
```

Note the absolute path to the built binary: `/c/Work/ai/efficiency/custom-protocol-mcp/dist/index.js`

**Step 2: Register MCP server globally in Claude Code**

Edit `~/.claude/settings.json` — add under `"mcpServers"`:

```json
{
  "mcpServers": {
    "custom-protocol-mcp": {
      "command": "node",
      "args": ["/c/Work/ai/efficiency/custom-protocol-mcp/dist/index.js"],
      "env": {
        "DB_PATH": "${workspaceFolder}/TEAM_STATE.db"
      }
    }
  }
}
```

> `${workspaceFolder}` ensures each project gets its own isolated `TEAM_STATE.db` — teams don't bleed across projects.

**Step 3: Update `src/index.ts` to read DB path from env**

Change the `initDb()` call in `index.ts`:

```typescript
const dbPath = process.env.DB_PATH ?? 'TEAM_STATE.db'
const db = initDb(dbPath)
```

Rebuild: `npm run build`

**Step 4: Create a Python project example**

```bash
mkdir -p /c/Work/ai/efficiency/examples/python-project
```

Create `examples/python-project/CLAUDE.md`:

```markdown
# Agent Bootstrap Instructions

You are part of a multi-agent Claude Code team working on a **Python** project.
The project language is Python — all source files are `.py`.

Follow these steps on every spawn:

1. Read `AGENT_PROTOCOL.md` — internalize all syntax before sending any message
2. Call MCP tool `get_team_state` — discover active agents, tasks, and locks
3. Call MCP tool `register_agent` with your id, role, domain, skills, and capacity
   - Valid skills for this project: `python`, `fastapi`, `sqlalchemy`, `pytest`, `docs`
4. Call MCP tool `get_available_tasks` with your skills — find work to claim
5. Call MCP tool `claim_task` for the highest-priority matching task
6. Begin work. Use Tier 1 pings in your messages. Use MCP tools for Tier 2 lifecycle events.
7. Call `heartbeat` every ~2 minutes while active
8. Call `shutdown` with completed/incomplete task lists when done

## MCP Server
Server name: `custom-protocol-mcp`
State lives in `TEAM_STATE.db` in this project root — never read/write it directly.

## Shortcodes (this project)
```
API  = src/api/
DB   = src/db/
AUTH = src/auth/
TEST = tests/
DOCS = docs/
```

## Protocol Reference
See `AGENT_PROTOCOL.md` for full syntax.
```

**Step 5: Copy spec file into example project**

```bash
cp /c/Work/ai/efficiency/AGENT_PROTOCOL.md /c/Work/ai/efficiency/examples/python-project/AGENT_PROTOCOL.md
```

**Step 6: Verify MCP server loads in a new project**

Open Claude Code in `examples/python-project/`.
Run `/mcp` — confirm `custom-protocol-mcp` appears with all 11 tools listed.

**Step 7: Verify DB isolation**

Spawn an agent in the Python project — confirm `TEAM_STATE.db` is created inside `examples/python-project/`, not in `custom-protocol-mcp/`.

**Step 8: Commit**

```bash
git add examples/ custom-protocol-mcp/src/index.ts
git commit -m "feat: global MCP config + Python project example demonstrating language-agnostic usage"
```

---

## Completion Checklist

- [ ] Project scaffolded and builds clean
- [ ] All 5 SQLite tables created correctly
- [ ] Tier 1 validator accepts valid pings and rejects plain English
- [ ] Agent register/heartbeat/team-state work
- [ ] Task queue with atomic work-stealing (no double-claims)
- [ ] Lock acquire/release with ownership enforcement
- [ ] Checkpoint, handoff, shutdown write correctly to DB
- [ ] Circuit breaker marks degraded agents and reroutes tasks
- [ ] MCP server exposes all 11 tools
- [ ] `AGENT_PROTOCOL.md` spec complete
- [ ] `CLAUDE.md` bootstrap instructions written
- [ ] 3-agent pilot test passes all 6 verification steps
- [ ] MCP server registered globally in `~/.claude/settings.json`
- [ ] DB path reads from `DB_PATH` env var (per-project isolation)
- [ ] Python project example has correct `CLAUDE.md` with Python-specific shortcodes
- [ ] `/mcp` in Python project shows all 11 tools
- [ ] `TEAM_STATE.db` created in Python project root (not MCP server dir)

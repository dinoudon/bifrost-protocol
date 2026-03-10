import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { initDb } from './db.js'
import { registerAgent, heartbeat, getTeamState } from './tools/agent.js'
import { addTask, availableTasks, claimTask } from './tools/tasks.js'
import { acquireLock, releaseLock, writeCheckpoint, writeHandoff, writeShutdown } from './tools/coordination.js'
import { checkHeartbeats } from './circuit-breaker.js'

const dbPath = process.env.DB_PATH ?? 'TEAM_STATE.db'
const db = initDb(dbPath)
const server = new McpServer({ name: 'bifrost-protocol', version: '1.0.0' })

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

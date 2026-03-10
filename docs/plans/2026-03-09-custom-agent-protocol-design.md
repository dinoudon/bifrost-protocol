# Custom Multi-Agent Protocol Design
**Date:** 2026-03-09
**Status:** Approved
**Inspired by:** [AgentSpeak v2](https://github.com/yuvalsuede/claude-teams-language-protocol)

---

## Problem Statement

Multi-agent Claude Code teams suffer from four compounding issues:
1. **Token cost** — verbose inter-agent messages burn context budget fast
2. **Coordination failures** — dynamic teams have no role registry or routing
3. **Context loss** — agents lose state between messages and across sessions
4. **No formal methodology** — no structured approach to task distribution or failure recovery

---

## Architecture Overview

A **Two-Tier Hybrid Protocol** backed by SQLite state, a custom MCP server, and formal distributed systems patterns.

```
AGENT_PROTOCOL.md       — full spec (read-only for agents)
TEAM_STATE.db           — SQLite state store (via mcp-server-sqlite)
CLAUDE.md               — references protocol + MCP setup
custom-protocol-mcp/    — MCP server enforcing protocol, routing, locks
```

### Bootstrap Sequence (every agent on spawn)
1. Read `CLAUDE.md` → find protocol + MCP references
2. Read `AGENT_PROTOCOL.md` → internalize syntax
3. Call `GET /team-state` on custom MCP → discover team, tasks, locks
4. Write `register` block → announce role, skills, capacity
5. Pull highest-priority matching task from queue
6. Begin work using Tier 1 pings

---

## Tier 1 — Compressed Status Pings

High-frequency, inline text messages. Zero JSON overhead.

### Message Structure
```
[priority?][status][taskRef?][file?][action][detail] [dependencies?]
```

### Status Codes

| Code | Meaning | Domain |
|------|---------|--------|
| `alpha` | Starting task | Both |
| `beta[%]` | In progress (optional % complete) | Both |
| `gamma` | Blocked | Both |
| `delta` | Done | Both |
| `epsilon[P0-P3]` | Bug/error with severity | Dev |
| `omega` | Shutting down | Both |
| `theta` | Protocol feedback proposal | Both |
| `rho` | Researching | Research |
| `sigma` | Synthesizing / writing | Research |
| `phi` | Draft ready for review | Research |
| `chi` | Review needed | Research |

### Actions

| Symbol | Meaning |
|--------|---------|
| `+` | Added |
| `-` | Removed |
| `~` | Changed |
| `!` | Broken |
| `?` | Requesting |
| `>>` | Unblocks |
| `<<` | Blocked by |
| `@A#` | Assign to agent |
| `+lock` | Claim file ownership |
| `-lock` | Release file ownership |

### Priorities
- `!!` — urgent
- `..` — low / FYI
- *(none)* — normal

### Examples
```
alphaT3 AUTH +jwt-middleware
beta75 T3 AUTH ~token-validation
!!epsilonP0 AUTH !bypass L140 @A2
deltaT3 AUTH -lock >>T5,T6
..deltaT3,T4,T6 AUTH -lock          # batch update
rhoT7 @sources [oauth,jwt-rfc]
phiT9 REPORT >>A1
..betaA3 alive T5:60%               # heartbeat
```

### File Shortcodes
Defined per-project in `AGENT_PROTOCOL.md` under `## Shortcodes`. Example:
```
AUTH = src/auth/
DB   = src/db/
UI   = src/components/
REPT = docs/reports/
SRC  = research/sources/
```

---

## Tier 2 — Structured State Messages

Low-frequency, JSON messages written via SQLite MCP. Used for lifecycle events only.

### Message Types

**Register** (on spawn):
```json
{
  "type": "register",
  "agent": "A3",
  "role": "coder",
  "domain": "dev",
  "skills": ["typescript", "auth", "db"],
  "capacity": 3,
  "owns": []
}
```

**Task Declaration** (orchestrator adds to queue):
```json
{
  "type": "task",
  "id": "T9",
  "priority": "P1",
  "skills": ["typescript"],
  "parallel_safe": true,
  "group": "PG1",
  "description": "add refresh token rotation"
}
```

**Checkpoint** (when blocked or handing off):
```json
{
  "type": "checkpoint",
  "agent": "A3",
  "task": "T5",
  "status": "gamma",
  "blocking": ["A1"],
  "context": "jwt middleware 80% done, failing on refresh token edge case",
  "artifacts": ["src/auth/jwt.ts"]
}
```

**Handoff** (transferring task ownership):
```json
{
  "type": "handoff",
  "agent": "A3",
  "to": "A5",
  "task": "T5",
  "summary": "jwt done, refresh broken at L140, fix then run auth.test.ts"
}
```

**Shutdown** (on omega):
```json
{
  "type": "shutdown",
  "agent": "A3",
  "completed": ["T3", "T4"],
  "incomplete": ["T5"],
  "theta": ["add shortcode for DB migrations"]
}
```

---

## SQLite State Store (`mcp-server-sqlite`)

Replaces flat `TEAM_STATE.md`. Enables atomic writes and queryable state.

### Tables

```sql
agents       (id, role, domain, skills, capacity, status, last_heartbeat)
tasks        (id, priority, skills, status, owner, parallel_safe, group_id, description)
locks        (file, owner_agent, acquired_at)
checkpoints  (agent, task, status, context, artifacts, timestamp)
events       (type, agent, payload, timestamp)   -- append-only event log (Event Sourcing)
```

### Key Queries Agents Use
```sql
-- Find unassigned tasks matching my skills
SELECT * FROM tasks WHERE status='unassigned' AND skills LIKE '%auth%' ORDER BY priority

-- Check if file is locked
SELECT * FROM locks WHERE file='AUTH'

-- Get current team state
SELECT * FROM agents WHERE status='active'
```

---

## Custom Protocol MCP Server

A dedicated MCP server all agents call instead of raw file reads/writes.

### Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /team-state` | Full team snapshot on spawn |
| `POST /register` | Agent registration |
| `POST /task/claim` | Atomic task claim (work stealing) |
| `POST /lock/acquire` | Atomic file lock |
| `POST /lock/release` | Release file lock |
| `POST /checkpoint` | Write checkpoint |
| `POST /handoff` | Transfer task ownership |
| `POST /heartbeat` | Liveness ping |
| `POST /shutdown` | Agent shutdown + theta collection |
| `GET /tasks/available` | Queue filtered by skills |

### Responsibilities
- Validates Tier 1 syntax before logging
- Enforces capability-based routing (`@A#` only if skill matches)
- Atomic lock acquisition (no race conditions)
- Circuit breaker: marks agent `degraded` after N missed heartbeats, triggers task reroute
- Collects `theta` feedback at shutdown for protocol refinement PRs

---

## Distributed Systems Patterns

### Actor Model
Each agent is an isolated actor. `TEAM_STATE.db` is the message bus. No direct agent-to-agent calls — all coordination through MCP endpoints.

### Event Sourcing
The `events` table is append-only. Full team state can be replayed from event history. Complete audit trail for debugging coordination failures.

### Blackboard Architecture
`TEAM_STATE.db` is the shared blackboard. Agents advertise partial results (checkpoints, artifacts) that other agents can build on without explicit assignment.

### Saga Pattern
For long multi-agent chains (especially research → synthesis → review), a saga coordinator agent tracks each step and triggers compensating actions if a step fails (e.g., reassign to next available agent with matching skills).

### Circuit Breaker
- Agent misses 3 heartbeats → status set to `degraded`
- MCP auto-reassigns active tasks to next capable agent
- Degraded agent excluded from routing until it re-registers

### Work Stealing
Idle agents call `GET /tasks/available` filtered by their skills. Claim highest-priority match via `POST /task/claim` (atomic — prevents double-claim). Zero orchestrator involvement.

### Consistent Hashing (for large teams)
For teams >10 agents, tasks are distributed via consistent hashing on `group_id` — ensures related tasks land on the same agent, reducing context-switching overhead.

---

## MCP Integrations

| MCP | Role |
|-----|------|
| `mcp-server-sqlite` | Replaces flat file state, atomic ops, queryable team state |
| `mcp-server-memory` | Persistent cross-session agent memory — context survives restarts |
| `mcp-server-filesystem` | Structured file ops for artifact management |
| `mcp-server-github` | Dev agents create PRs, check CI, comment on issues directly |
| `mcp-server-fetch` / `brave-search` | Research agents pull live sources inline |
| `custom-protocol-mcp` | Central enforcement, routing, liveness, theta collection |

---

## Parallel Task Execution

Tasks marked `parallel_safe: true` with a shared `group_id` can run concurrently. Lock system prevents file conflicts. Agents in the same group coordinate via `+lock`/`-lock` Tier 1 pings.

---

## Efficiency Summary

| Mechanism | Pain Point Addressed |
|-----------|---------------------|
| Tier 1 compressed pings | Token cost (~60-70% reduction) |
| Batch status updates | Token cost (N messages → 1) |
| Capability matrix routing | Coordination failures |
| Work stealing + task queue | Coordination failures |
| SQLite atomic ops | Coordination failures (no race conditions) |
| Circuit breaker + heartbeats | Coordination failures (stuck agents) |
| Tier 2 checkpoints + handoffs | Context loss |
| mcp-server-memory | Context loss (cross-session) |
| Event sourcing | Context loss (full replay) |
| Saga pattern | Context loss (long chains) |
| Custom protocol MCP | All three (enforcement + observability) |

---

## Next Steps
- Implement `AGENT_PROTOCOL.md` spec file
- Scaffold `custom-protocol-mcp` server
- Set up SQLite schema
- Write `CLAUDE.md` bootstrap instructions
- Test with a 3-agent pilot (coder + researcher + reviewer)

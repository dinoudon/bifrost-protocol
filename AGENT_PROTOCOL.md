# Agent Protocol Specification

> **Version:** 1.0
> **Status:** Active
> **Read-only for agents** — do not modify this file during execution.

This document defines the two-tier hybrid inter-agent communication protocol. All agents MUST read and internalize this spec before sending any message.

---

## Bootstrap Sequence

Every agent executes these steps on spawn:

1. Read `CLAUDE.md` — find protocol and MCP references
2. Read this file (`AGENT_PROTOCOL.md`) — internalize all syntax
3. Call `get_team_state` on the MCP server — discover team, tasks, locks
4. Call `register_agent` — announce your role, skills, and capacity
5. Call `get_available_tasks` with your skills — find the highest-priority match
6. Call `claim_task` — atomically claim the task
7. Begin work using **Tier 1 pings** for status updates
8. Call `heartbeat` every ~2 minutes while active
9. Call `shutdown` with completed/incomplete task lists when done

---

## Tier 1 — Compressed Status Pings

High-frequency, inline text messages embedded in agent output. Zero JSON overhead. Use these for all routine status communication.

### Message Structure

```
[priority?][status][taskRef?][file?][action][detail] [dependencies?]
```

Each component:

| Component | Required | Description |
|-----------|----------|-------------|
| `priority` | No | `!!` (urgent) or `..` (low/FYI). Omit for normal. |
| `status` | Yes | One of the status codes below. |
| `taskRef` | No | Task reference: `T1`, `T3,T4,T6` (batch). |
| `file` | No | File shortcode (see Shortcodes section). |
| `action` | Yes | Action symbol (see Actions table). |
| `detail` | Yes | Free-text description of what happened. |
| `dependencies` | No | Dependency markers: `>>T5` (unblocks), `<<T2` (blocked by), `@A2` (assign to agent). |

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

**Severity levels** (used with `epsilon`):
- `P0` — Critical, blocks everything
- `P1` — High, blocks current task
- `P2` — Medium, workaround exists
- `P3` — Low, cosmetic or minor

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
| `@A#` | Assign to agent (e.g., `@A2`) |
| `+lock` | Claim file ownership |
| `-lock` | Release file ownership |

### Priorities

| Marker | Meaning |
|--------|---------|
| `!!` | Urgent — requires immediate attention |
| `..` | Low priority / FYI only |
| *(none)* | Normal priority |

### Examples

```
alphaT3 AUTH +jwt-middleware
```
> Agent starting task T3, adding jwt-middleware in the AUTH area.

```
beta75 T3 AUTH ~token-validation
```
> Task T3 is 75% complete, changed token-validation in AUTH.

```
!!epsilonP0 AUTH !bypass L140 @A2
```
> URGENT: P0 bug found in AUTH — bypass broken at line 140, assigning to A2.

```
deltaT3 AUTH -lock >>T5,T6
```
> Task T3 done, releasing AUTH lock, unblocks T5 and T6.

```
..deltaT3,T4,T6 AUTH -lock
```
> FYI: batch completion of T3, T4, T6 — releasing AUTH lock.

```
rhoT7 @sources [oauth,jwt-rfc]
```
> Researching for T7, consulting oauth and jwt-rfc sources.

```
phiT9 REPORT >>A1
```
> Draft for T9 ready in REPORT area, unblocks A1 for review.

```
..betaA3 alive T5:60%
```
> Heartbeat from A3 — still alive, T5 at 60%.

### Batch Updates

Multiple tasks can be referenced in a single ping by comma-separating task refs:

```
..deltaT3,T4,T6 AUTH -lock
```

This replaces N separate messages with 1, reducing token cost.

---

## Tier 2 — Structured State Messages

Low-frequency JSON messages persisted to SQLite via the MCP server. Used for lifecycle events only. **Never write these manually** — always use the corresponding MCP tool.

### Register (on spawn)

MCP tool: `register_agent`

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

Fields:
- `agent` — unique agent ID (A1, A2, ...)
- `role` — one of: `coder`, `researcher`, `reviewer`, `orchestrator`
- `domain` — `dev` or `research`
- `skills` — array of capability tags for task matching
- `capacity` — max concurrent tasks this agent can handle
- `owns` — files currently locked by this agent (initially empty)

### Task Declaration (orchestrator adds to queue)

MCP tool: `add_task`

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

Fields:
- `id` — unique task ID (T1, T2, ...)
- `priority` — P0 (critical) through P3 (low)
- `skills` — required skills for matching
- `parallel_safe` — whether this task can run concurrently with others in its group
- `group` — parallel group ID (tasks in the same group coordinate via locks)
- `description` — human-readable task description

### Checkpoint (when blocked or handing off)

MCP tool: `checkpoint`

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

Fields:
- `status` — current Tier 1 status code
- `blocking` — agents this checkpoint blocks
- `context` — free-text summary of current state (essential for handoffs and recovery)
- `artifacts` — files produced or modified so far

### Handoff (transferring task ownership)

MCP tool: `handoff`

```json
{
  "type": "handoff",
  "agent": "A3",
  "to": "A5",
  "task": "T5",
  "summary": "jwt done, refresh broken at L140, fix then run auth.test.ts"
}
```

Fields:
- `to` — agent receiving the task
- `summary` — actionable instructions for the receiving agent

### Shutdown (on omega)

MCP tool: `shutdown`

```json
{
  "type": "shutdown",
  "agent": "A3",
  "completed": ["T3", "T4"],
  "incomplete": ["T5"],
  "theta": ["add shortcode for DB migrations"]
}
```

Fields:
- `completed` — tasks finished before shutdown
- `incomplete` — tasks still in progress (will be rerouted)
- `theta` — protocol improvement suggestions collected for future refinement

---

## Shortcodes

File shortcodes map abbreviated names to directory paths. Define project-specific shortcodes in `CLAUDE.md` or in the table below. Use these in Tier 1 pings instead of full paths.

```
AUTH = src/auth/
DB   = src/db/
UI   = src/components/
REPT = docs/reports/
SRC  = research/sources/
```

Rules:
- Shortcodes are uppercase, 2-4 characters
- Defined per-project (each project's `CLAUDE.md` may override these defaults)
- Use in Tier 1 pings: `alphaT3 AUTH +jwt-middleware` (not `alphaT3 src/auth/ +jwt-middleware`)

---

## MCP Server Tools Reference

All state lives in `TEAM_STATE.db`. **Never read or write the database directly.** Always use these MCP tools:

| Tool | Purpose |
|------|---------|
| `get_team_state` | Full team snapshot (agents, tasks, locks) on spawn |
| `register_agent` | Agent registration |
| `claim_task` | Atomic task claim (work stealing, prevents double-claim) |
| `acquire_lock` | Atomic file lock acquisition |
| `release_lock` | Release file lock |
| `checkpoint` | Write checkpoint (state snapshot for recovery) |
| `handoff` | Transfer task ownership to another agent |
| `heartbeat` | Liveness ping (call every ~2 minutes) |
| `shutdown` | Agent shutdown with completed/incomplete lists and theta feedback |
| `add_task` | Add task to queue (orchestrator only) |
| `get_available_tasks` | Queue filtered by agent skills |

---

## Coordination Rules

### File Locking

- Before modifying a file area, acquire a lock: `+lock` in Tier 1 + `acquire_lock` MCP call
- Release when done: `-lock` in Tier 1 + `release_lock` MCP call
- Locks are enforced atomically — no race conditions
- Only the lock owner can release their lock

### Work Stealing

- Idle agents call `get_available_tasks` filtered by their skills
- Claim the highest-priority match via `claim_task` (atomic, prevents double-claim)
- No orchestrator involvement needed — agents self-organize

### Circuit Breaker

- Agent misses 3 consecutive heartbeats (>180 seconds) → status set to `degraded`
- MCP server auto-reassigns active tasks to the queue (status → `unassigned`)
- Degraded agent's locks are released
- Degraded agent is excluded from routing until it re-registers

### Parallel Execution

- Tasks marked `parallel_safe: true` with a shared `group_id` can run concurrently
- Lock system prevents file conflicts between parallel agents
- Agents in the same group coordinate via `+lock`/`-lock` Tier 1 pings

---

## Protocol Feedback (Theta)

Agents can propose protocol improvements using the `theta` status code:

```
thetaT0 ?add-shortcode DB_MIGRATE
```

Theta suggestions are collected at shutdown and stored for protocol refinement. This enables the protocol to evolve based on real-world usage.

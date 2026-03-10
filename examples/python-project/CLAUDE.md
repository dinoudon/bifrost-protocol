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
Server name: `bifrost-protocol`
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

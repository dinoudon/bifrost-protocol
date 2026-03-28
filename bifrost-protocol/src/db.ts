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
      skills TEXT NOT NULL,
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

    CREATE INDEX IF NOT EXISTS idx_tasks_status_priority ON tasks(status, priority);
    CREATE INDEX IF NOT EXISTS idx_agents_status_heartbeat ON agents(status, last_heartbeat);
  `)

  return db
}

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
  // Use SQLite JSON functions to filter tasks by skills at the database level.
  // This is significantly faster than fetching all and filtering in JavaScript.
  return db.prepare(`
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
  `).all(JSON.stringify(agentSkills)) as any[]
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

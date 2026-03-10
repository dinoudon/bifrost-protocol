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

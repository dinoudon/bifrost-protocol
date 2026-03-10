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

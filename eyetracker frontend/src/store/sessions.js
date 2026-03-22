const STORAGE_KEY = 'eye_tracking_sessions'

export function getSessions() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

export function saveSession(session) {
  const sessions = getSessions()
  sessions.push(session)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
}

export function getSessionById(id) {
  return getSessions().find(s => s.session_id === id) || null
}

export function deleteSession(id) {
  const sessions = getSessions().filter(s => s.session_id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
}

export function generateSessionId() {
  const year = new Date().getFullYear()
  const existing = getSessions().filter(s => s.session_id.startsWith(`S_${year}_`))
  const next = String(existing.length + 1).padStart(3, '0')
  return `S_${year}_${next}`
}

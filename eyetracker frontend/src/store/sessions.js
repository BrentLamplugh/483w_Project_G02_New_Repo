const STORAGE_KEY = 'eye_tracking_sessions'

export function getSessions() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    // Ensure newer fields exist for older saved sessions
    return parsed.map(s => ({
      stimulus_loaded: false,
      stimuli_count: 0,
      ...s,
    }))
  } catch {
    return []
  }
}

export function saveSession(session) {
  const sessions = getSessions()
  sessions.push({
    stimulus_loaded: false,
    stimuli_count: 0,
    ...session,
  })
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
}

export function getSessionById(id) {
  return getSessions().find(s => s.session_id === id) || null
}

export function deleteSession(id) {
  const sessions = getSessions().filter(s => s.session_id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
}

export function updateSession(id, updates) {
  const sessions = getSessions()
  const idx = sessions.findIndex(s => s.session_id === id)
  if (idx === -1) return null
  const updated = { ...sessions[idx], ...updates }
  sessions[idx] = updated
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
  return updated
}

export function generateSessionId() {
  const year = new Date().getFullYear()
  const existing = getSessions().filter(s => s.session_id.startsWith(`S_${year}_`))
  const next = String(existing.length + 1).padStart(3, '0')
  return `S_${year}_${next}`
}

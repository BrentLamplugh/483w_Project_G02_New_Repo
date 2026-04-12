const STORAGE_KEY = 'eye_tracking_sessions'
const STIMULI_STORAGE_KEY = 'eye_tracking_stimuli'
const GAZ_STORAGE_KEY = 'eye_tracking_gaz_summaries'

export function getSessions() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    // Ensure newer fields exist for older saved sessions
    return parsed.map(s => ({
      stimulus_loaded: false,
      stimuli_count: 0,
      analysis_viewed: false,
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
    analysis_viewed: false,
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

  // Remove dependent records so stale data cannot leak into future sessions.
  try {
    const stimuli = JSON.parse(localStorage.getItem(STIMULI_STORAGE_KEY) || '[]')
    localStorage.setItem(
      STIMULI_STORAGE_KEY,
      JSON.stringify(stimuli.filter(s => s.session_id !== id))
    )
  } catch {
    // no-op: keep session delete resilient
  }

  try {
    const summaries = JSON.parse(localStorage.getItem(GAZ_STORAGE_KEY) || '[]')
    localStorage.setItem(
      GAZ_STORAGE_KEY,
      JSON.stringify(summaries.filter(s => s.session_id !== id))
    )
  } catch {
    // no-op: keep session delete resilient
  }
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
  const usedIds = new Set()

  getSessions().forEach(s => {
    if (s?.session_id) usedIds.add(s.session_id)
  })

  try {
    const stimuli = JSON.parse(localStorage.getItem(STIMULI_STORAGE_KEY) || '[]')
    stimuli.forEach(s => {
      if (s?.session_id) usedIds.add(s.session_id)
    })
  } catch {
    // no-op
  }

  try {
    const summaries = JSON.parse(localStorage.getItem(GAZ_STORAGE_KEY) || '[]')
    summaries.forEach(s => {
      if (s?.session_id) usedIds.add(s.session_id)
    })
  } catch {
    // no-op
  }

  let counter = 1
  let candidate = `S_${year}_${String(counter).padStart(3, '0')}`
  while (usedIds.has(candidate)) {
    counter += 1
    candidate = `S_${year}_${String(counter).padStart(3, '0')}`
  }
  return candidate
}

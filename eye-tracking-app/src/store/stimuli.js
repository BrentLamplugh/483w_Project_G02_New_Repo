const STORAGE_KEY = 'eye_tracking_stimuli'

function getAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function persist(all) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
}

export function getStimuliForSession(sessionId) {
  return getAll()
    .filter(s => s.session_id === sessionId)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
}

export function generateStimulusId(sessionId) {
  return `stim_${sessionId}_${Date.now()}`
}

export function saveStimulus(stimulus) {
  const all = getAll()
  all.push(stimulus)
  persist(all)
}

export function deleteStimulus(stimulusId) {
  const remaining = getAll().filter(s => s.stimulus_id !== stimulusId)
  persist(remaining)
}

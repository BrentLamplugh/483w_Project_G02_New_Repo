const TOAST_EVENT = 'eyetrack:toast'

export function showToast(message, options = {}) {
  if (typeof window === 'undefined') return
  if (!message || !String(message).trim()) return

  const detail = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    message: String(message),
    type: options.type || 'success',
    duration: options.duration ?? 2600,
  }

  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail }))
}

export function subscribeToToasts(handler) {
  if (typeof window === 'undefined') return () => {}
  const listener = (event) => handler(event.detail)
  window.addEventListener(TOAST_EVENT, listener)
  return () => window.removeEventListener(TOAST_EVENT, listener)
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { saveSession, generateSessionId } from '../store/sessions'
import { format } from 'date-fns'

const TASK_PRESETS = [
  'Code Review Task A',
  'Code Review Task B',
  'UI Usability Test',
  'Reading Comprehension',
  'Visual Search Task',
  'Custom Task',
]

export default function NewSession() {
  const navigate = useNavigate()
  const sessionId = generateSessionId()

  const [form, setForm] = useState({
    participant_id: '',
    participant_name: '',
    task_name: '',
    custom_task: '',
    stimulus_type: 'code',
    notes: '',
  })

  const [errors, setErrors] = useState({})

  const set = (field, value) => {
    setForm(f => ({ ...f, [field]: value }))
    setErrors(e => ({ ...e, [field]: '' }))
  }

  const validate = () => {
    const e = {}
    if (!form.participant_id.trim()) e.participant_id = 'Required'
    if (!form.participant_name.trim()) e.participant_name = 'Required'
    if (!form.task_name) e.task_name = 'Required'
    if (form.task_name === 'Custom Task' && !form.custom_task.trim())
      e.custom_task = 'Please enter a task name'
    return e
  }

  const handleSubmit = () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }

    const session = {
      session_id: sessionId,
      participant_id: form.participant_id.trim(),
      participant_name: form.participant_name.trim(),
      task_name: form.task_name === 'Custom Task' ? form.custom_task.trim() : form.task_name,
      stimulus_type: form.stimulus_type,
      notes: form.notes.trim(),
      date: new Date().toISOString(),
      csv_uploaded: false,
      stimulus_loaded: false,
      stimuli_count: 0,
    }

    saveSession(session)
    navigate(`/sessions/${sessionId}`)
  }

  return (
    <div className="layout">
      <header className="topbar">
        <div className="topbar-dot" />
        <span className="topbar-title">EyeTrack Research</span>
        <span className="topbar-subtitle">/ new session</span>
      </header>

      <main className="page">
        <button className="back-link" onClick={() => navigate('/')}>
          ← back to dashboard
        </button>

        <div className="page-header">
          <div>
            <div className="page-eyebrow">Phase 1 — Setup</div>
            <h1 className="page-title">New Session</h1>
            <p className="page-subtitle">Enter participant and task details to begin</p>
          </div>
        </div>

        <div className="form-card">
          {/* Session ID preview */}
          <div className="id-preview">
            <span className="id-preview-label">Session ID</span>
            <span className="id-preview-value">{sessionId}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
              auto-generated
            </span>
          </div>

          {/* Participant */}
          <div className="form-section-title">Participant Info</div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Participant ID *</label>
              <input
                className="form-input"
                placeholder="e.g. P12"
                value={form.participant_id}
                onChange={e => set('participant_id', e.target.value)}
              />
              {errors.participant_id && (
                <span style={{ color: 'var(--red)', fontSize: 11 }}>{errors.participant_id}</span>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Display Name *</label>
              <input
                className="form-input"
                placeholder="e.g. Participant 12"
                value={form.participant_name}
                onChange={e => set('participant_name', e.target.value)}
              />
              {errors.participant_name && (
                <span style={{ color: 'var(--red)', fontSize: 11 }}>{errors.participant_name}</span>
              )}
            </div>
          </div>

          {/* Task */}
          <div className="form-section-title" style={{ marginTop: 8 }}>Task & Stimulus</div>

          <div className="form-group">
            <label className="form-label">Task *</label>
            <select
              className="form-select"
              value={form.task_name}
              onChange={e => set('task_name', e.target.value)}
              style={{ backgroundImage: 'none' }}
            >
              <option value="">Select a task...</option>
              {TASK_PRESETS.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            {errors.task_name && (
              <span style={{ color: 'var(--red)', fontSize: 11 }}>{errors.task_name}</span>
            )}
          </div>

          {form.task_name === 'Custom Task' && (
            <div className="form-group">
              <label className="form-label">Custom Task Name *</label>
              <input
                className="form-input"
                placeholder="Describe the task..."
                value={form.custom_task}
                onChange={e => set('custom_task', e.target.value)}
              />
              {errors.custom_task && (
                <span style={{ color: 'var(--red)', fontSize: 11 }}>{errors.custom_task}</span>
              )}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Stimulus Type</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['code', 'image', 'video'].map(type => (
                <button
                  key={type}
                  className={`btn ${form.stimulus_type === type ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ flex: 1, justifyContent: 'center', padding: '8px 0' }}
                  onClick={() => set('stimulus_type', type)}
                >
                  {type === 'code' ? '{ }' : type === 'image' ? '⊡' : '▷'} {type}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="form-section-title" style={{ marginTop: 8 }}>Additional Info</div>

          <div className="form-group">
            <label className="form-label">Session Notes</label>
            <textarea
              className="form-input"
              placeholder="Any notes about this session (optional)..."
              rows={3}
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
            Date: {format(new Date(), 'MMMM d, yyyy')}
          </div>

          <div className="form-actions">
            <button className="btn btn-ghost" onClick={() => navigate('/')}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSubmit}>
              Create Session →
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getSessionById, deleteSession } from '../store/sessions'
import { getStimuliForSession } from '../store/stimuli'
import { format } from 'date-fns'

const PHASES = [
  { num: 1, label: 'Session created' },
  { num: 2, label: 'Stimulus loaded' },
  { num: 3, label: 'CSV uploaded' },
  { num: 4, label: 'Data processed' },
  { num: 5, label: 'Results ready' },
]

export default function SessionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [stimuliCount, setStimuliCount] = useState(0)

  useEffect(() => {
    const s = getSessionById(id)
    if (s) {
      setSession(s)
      setStimuliCount(getStimuliForSession(id).length)
    } else setNotFound(true)
  }, [id])

  const handleDelete = () => {
    if (confirm(`Delete session ${id}? This cannot be undone.`)) {
      deleteSession(id)
      navigate('/')
    }
  }

  // Determine current phase
  const hasStimuli = stimuliCount > 0 || session?.stimulus_loaded
  const currentPhase = session?.csv_uploaded ? 3 : hasStimuli ? 2 : 1

  if (notFound) {
    return (
      <div className="layout">
        <header className="topbar">
          <div className="topbar-dot" />
          <span className="topbar-title">EyeTrack Research</span>
        </header>
        <main className="page">
          <div className="empty-state">
            <div className="empty-icon">⚠</div>
            <div className="empty-title">Session not found</div>
            <div className="empty-desc">The session ID "{id}" does not exist.</div>
            <button className="btn btn-primary" onClick={() => navigate('/')}>
              Back to Dashboard
            </button>
          </div>
        </main>
      </div>
    )
  }

  if (!session) return null

  return (
    <div className="layout">
      <header className="topbar">
        <div className="topbar-dot" />
        <span className="topbar-title">EyeTrack Research</span>
        <span className="topbar-subtitle">/ {session.session_id}</span>
      </header>

      <main className="page">
        <button className="back-link" onClick={() => navigate('/')}>
          ← back to dashboard
        </button>

        <div className="page-header">
          <div>
            <div className="page-eyebrow">Session Details</div>
            <h1 className="page-title">{session.task_name}</h1>
            <p className="page-subtitle">
              {session.participant_name}
              <span style={{ color: 'var(--text-muted)', margin: '0 8px' }}>·</span>
              {format(new Date(session.date), 'MMMM d, yyyy')}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-danger" onClick={handleDelete}>
              Delete
            </button>
          </div>
        </div>

        <div className="detail-grid">
          {/* Left column — info cards */}
          <div>
            {/* Participant info */}
            <div className="card detail-section" style={{ marginBottom: 16 }}>
              <div className="detail-section-title">Participant</div>
              <div className="detail-field">
                <span className="detail-field-label">ID</span>
                <span className="detail-field-value mono">{session.participant_id}</span>
              </div>
              <div className="detail-field">
                <span className="detail-field-label">Name</span>
                <span className="detail-field-value">{session.participant_name}</span>
              </div>
            </div>

            {/* Session info */}
            <div className="card detail-section" style={{ marginBottom: 16 }}>
              <div className="detail-section-title">Session</div>
              <div className="detail-field">
                <span className="detail-field-label">Session ID</span>
                <span className="detail-field-value mono">{session.session_id}</span>
              </div>
              <div className="detail-field">
                <span className="detail-field-label">Task</span>
                <span className="detail-field-value">{session.task_name}</span>
              </div>
              <div className="detail-field">
                <span className="detail-field-label">Stimulus Type</span>
                <span className={`type-badge ${session.stimulus_type}`}>
                  {session.stimulus_type}
                </span>
              </div>
              <div className="detail-field">
                <span className="detail-field-label">Stimuli Loaded</span>
                <span className="detail-field-value">
                  {stimuliCount > 0 ? `${stimuliCount} added` : 'None yet'}
                </span>
              </div>
              <div className="detail-field">
                <span className="detail-field-label">Date</span>
                <span className="detail-field-value">
                  {format(new Date(session.date), 'MMM d, yyyy · h:mm a')}
                </span>
              </div>
              {session.notes && (
                <div className="detail-field" style={{ flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                  <span className="detail-field-label">Notes</span>
                  <span style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                    {session.notes}
                  </span>
                </div>
              )}
            </div>

            {/* CSV status */}
            <div className="card">
              <div className="detail-section-title">Data Status</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>GP3HD Export</span>
                <span className={`pill ${session.csv_uploaded ? 'pill-complete' : 'pill-pending'}`}>
                  <span style={{
                    width: 5, height: 5, borderRadius: '50%',
                    background: session.csv_uploaded ? 'var(--accent)' : 'var(--amber)',
                    display: 'inline-block'
                  }} />
                  {session.csv_uploaded ? 'Uploaded' : 'Pending'}
                </span>
              </div>
              <button
                className="btn btn-ghost"
                style={{ width: '100%', justifyContent: 'center' }}
                disabled={session.csv_uploaded}
                title="CSV upload coming in Phase 3"
              >
                {session.csv_uploaded ? '✓ CSV Uploaded' : '↑ Upload CSV'}
              </button>
              {!session.csv_uploaded && (
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
                  Export CSV from GP3HD software, then upload here
                </p>
              )}
            </div>
          </div>

          {/* Right column — phases + actions */}
          <div>
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="detail-section-title">Experiment Progress</div>
              <div className="phases">
                {PHASES.map(p => {
                  const isDone = p.num < currentPhase
                  const isActive = p.num === currentPhase
                  return (
                    <div key={p.num} className="phase-item">
                      <div className={`phase-num ${isDone ? 'done' : isActive ? 'active' : ''}`}>
                        {isDone ? '✓' : p.num}
                      </div>
                      <span className={`phase-label ${isActive ? 'active' : ''}`}>
                        {p.label}
                      </span>
                      {isActive && (
                        <span style={{
                          marginLeft: 'auto', fontSize: 10,
                          color: 'var(--accent)', fontFamily: 'var(--mono)',
                          textTransform: 'uppercase', letterSpacing: '0.06em'
                        }}>
                          current
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Next steps card */}
            <div className="card" style={{ background: 'var(--accent-glow)', borderColor: 'var(--accent-dim)' }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--accent)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                Next Step
              </div>
              {currentPhase === 1 && (
                <>
                  <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 12 }}>
                    Load your stimulus in the viewer, then run the recording in GP3HD software.
                  </p>
                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => navigate(`/sessions/${id}/stimuli`)}
                  >
                    Open Stimulus Viewer →
                  </button>
                </>
              )}
              {currentPhase === 2 && (
                <>
                  <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 12 }}>
                    Stimulus is loaded. Proceed with GP3HD recording and export the CSV when done.
                  </p>
                  <button
                    className="btn btn-ghost"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => navigate(`/sessions/${id}/stimuli`)}
                  >
                    Review Stimuli →
                  </button>
                </>
              )}
              {currentPhase === 3 && (
                <>
                  <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 12 }}>
                    CSV is uploaded. Run analysis to generate heatmaps and fixation data.
                  </p>
                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', justifyContent: 'center' }}
                    title="Analysis coming in Phase 4"
                  >
                    Run Analysis →
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getSessionById, deleteSession, updateSession } from '../store/sessions'
import { getStimuliForSession, deleteStimuliForSession } from '../store/stimuli'
import { getGazSummary, deleteGazSummary } from '../store/gazdata'
import { showToast } from '../store/toast'
import { format } from 'date-fns'

const PHASES = [
  { num: 1, label: 'Session created' },
  { num: 2, label: 'Stimulus loaded' },
  { num: 3, label: 'CSV uploaded' },
  { num: 4, label: 'Data processed' },
  { num: 5, label: 'Visualizations ready' },
]

function StatTile({ label, value, unit, accent }) {
  return (
    <div style={{
      background: 'var(--surface2)',
      border: `1px solid ${accent ? 'var(--accent-dim)' : 'var(--border)'}`,
      borderRadius: 8,
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 5,
    }}>
      <span style={{
        fontSize: 10,
        fontFamily: 'var(--mono)',
        color: accent ? 'var(--accent)' : 'var(--text-muted)',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
      }}>{label}</span>
      <span style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--mono)', lineHeight: 1 }}>
        {value ?? '-'}
        {unit && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4, fontWeight: 400 }}>{unit}</span>}
      </span>
    </div>
  )
}

export default function SessionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [session, setSession] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [stimuliCount, setStimuliCount] = useState(0)
  const [gazSummary, setGazSummary] = useState(null)
  const [stimuli, setStimuli] = useState([])

  useEffect(() => {
    const s = getSessionById(id)
    if (s) {
      setSession(s)
      const stims = getStimuliForSession(id)
      setStimuli(stims)
      setStimuliCount(stims.length)
      setGazSummary(getGazSummary(id))
    } else {
      setNotFound(true)
    }
  }, [id])

  const hasStimuli = stimuliCount > 0 || session?.stimulus_loaded
  const csvUploaded = session?.csv_uploaded || false
  const dataProcessed = csvUploaded && gazSummary !== null
  const visualizationsReady = dataProcessed && !!session?.analysis_viewed
  const currentPhase = !hasStimuli ? 1 : !csvUploaded ? 2 : !dataProcessed ? 3 : !visualizationsReady ? 4 : 5
  const getPhaseRoute = (phaseNum) => {
    if (phaseNum === 1) return `/sessions/${id}`
    if (phaseNum === 2) return `/sessions/${id}/stimuli`
    if (phaseNum === 3) return `/sessions/${id}/upload`
    return `/sessions/${id}/analysis`
  }

  const handleDelete = () => {
    if (confirm(`Delete session ${id}? This cannot be undone.`)) {
      deleteSession(id)
      navigate('/')
    }
  }

  const handleResetSessionData = () => {
    if (!confirm('Reset session data for this session? This will remove uploaded stimuli and CSV analysis results.')) {
      return
    }

    deleteStimuliForSession(id)
    deleteGazSummary(id)
    const updated = updateSession(id, {
      stimulus_loaded: false,
      stimuli_count: 0,
      csv_uploaded: false,
      csv_filename: null,
      analysis_viewed: false,
      analysis_viewed_at: null,
    })

    if (updated) {
      setSession(updated)
      setStimuli([])
      setStimuliCount(0)
      setGazSummary(null)
      showToast('Session data reset')
    }
  }

  if (notFound) {
    return (
      <div className="layout">
        <header className="topbar">
          <div className="topbar-dot" />
          <span className="topbar-title">EyeTrack Research</span>
        </header>
        <main className="page">
          <div className="empty-state">
            <div className="empty-icon">!</div>
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
          Back to dashboard
        </button>

        <div className="page-header">
          <div>
            <div className="page-eyebrow">Session Details</div>
            <h1 className="page-title">{session.task_name}</h1>
            <p className="page-subtitle">
              {session.participant_name}
              <span style={{ color: 'var(--text-muted)', margin: '0 8px' }}>|</span>
              {format(new Date(session.date), 'MMMM d, yyyy')}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost" onClick={handleResetSessionData}>
              Reset Data
            </button>
            <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
          </div>
        </div>

        <div className="detail-grid">
          <div>
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
                <span className={`type-badge ${session.stimulus_type}`}>{session.stimulus_type}</span>
              </div>
              <div className="detail-field">
                <span className="detail-field-label">Stimuli Loaded</span>
                <span className="detail-field-value">
                  {stimuliCount > 0 ? `${stimuliCount} added` : 'None yet'}
                </span>
              </div>
              <div className="detail-field">
                <span className="detail-field-label">CSV</span>
                <span className="detail-field-value">{csvUploaded ? 'Uploaded' : 'Not uploaded'}</span>
              </div>
              <div className="detail-field">
                <span className="detail-field-label">Date</span>
                <span className="detail-field-value">
                  {format(new Date(session.date), 'MMM d, yyyy | h:mm a')}
                </span>
              </div>
              {session.notes && (
                <div className="detail-field" style={{ flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                  <span className="detail-field-label">Notes</span>
                  <span style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>{session.notes}</span>
                </div>
              )}
            </div>

            {stimuli.length > 0 && (
              <div className="card detail-section" style={{ marginBottom: 16 }}>
                <div className="detail-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Stimulus Preview</span>
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: 12, padding: '6px 10px' }}
                    onClick={() => navigate(`/sessions/${id}/stimuli`)}
                  >
                    Open Viewer
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div>
                    <div className={`type-badge ${stimuli[0].type}`} style={{ marginBottom: 8 }}>
                      {stimuli[0].type}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>
                      {stimuli[0].name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      {format(new Date(stimuli[0].created_at), 'MMM d | h:mm a')}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {gazSummary && (
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="detail-section-title">Gaze Statistics</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <StatTile label="Fixations" value={gazSummary.fixation_count || '-'} accent />
                  <StatTile label="Avg Fixation" value={gazSummary.avg_fixation_duration_sec != null ? gazSummary.avg_fixation_duration_sec : '-'} unit="s" />
                  <StatTile label="Blinks" value={gazSummary.blink_count || '-'} />
                  <StatTile label="Avg Blink" value={gazSummary.avg_blink_duration_sec != null ? gazSummary.avg_blink_duration_sec : '-'} unit="s" />
                </div>
              </div>
            )}

          </div>

          <div>
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="detail-section-title">Experiment Progress</div>
              <div className="phases">
                {PHASES.map(p => {
                  const isDone = p.num < currentPhase
                  const isActive = p.num === currentPhase
                  return (
                    <div
                      key={p.num}
                      className="phase-item"
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(getPhaseRoute(p.num))}
                      title={`Open ${p.label}`}
                    >
                      <div className={`phase-num ${isDone ? 'done' : isActive ? 'active' : ''}`}>
                        {isDone ? 'OK' : p.num}
                      </div>
                      <span className={`phase-label ${isActive ? 'active' : ''}`}>{p.label}</span>
                      {isActive && (
                        <span style={{
                          marginLeft: 'auto',
                          fontSize: 10,
                          color: 'var(--accent)',
                          fontFamily: 'var(--mono)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                        }}>
                          current
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="card" style={{ background: 'var(--accent-glow)', borderColor: 'var(--accent-dim)' }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--accent)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                Next Step
              </div>

              {currentPhase === 1 && (
                <>
                  <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 12 }}>
                    Start by loading a stimulus for the session.
                  </p>
                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => navigate(`/sessions/${id}/stimuli`)}
                  >
                    Open Stimulus Viewer
                  </button>
                </>
              )}

              {currentPhase === 2 && (
                <>
                  <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 12 }}>
                    Stimulus is loaded. Upload the exported GP3HD CSV next.
                  </p>
                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => navigate(`/sessions/${id}/upload`)}
                  >
                    Upload CSV
                  </button>
                </>
              )}

              {(currentPhase === 3 || currentPhase === 4) && (
                <>
                  <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 12 }}>
                    Data is ready. Open analysis to generate and review visualizations.
                  </p>
                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => navigate(`/sessions/${id}/analysis`)}
                  >
                    Open Analysis
                  </button>
                </>
              )}

              {currentPhase === 5 && (
                <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>
                  All phases completed. Click any phase in the progress panel to jump back to it.
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

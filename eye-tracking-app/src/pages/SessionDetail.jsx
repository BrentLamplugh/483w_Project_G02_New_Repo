import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getSessionById, deleteSession, updateSession } from '../store/sessions'
import { getStimuliForSession } from '../store/stimuli'
import { getGazSummary, saveGazSummary, deleteGazSummary } from '../store/gazdata'
import { format } from 'date-fns'

const PHASES = [
  { num: 1, label: 'Session created' },
  { num: 2, label: 'Stimulus loaded' },
  { num: 3, label: 'CSV uploaded' },
  { num: 4, label: 'Data processed' },
  { num: 5, label: 'Results ready' },
]

// ─── Small reusable components ────────────────────────────────────────────────

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
        {value ?? '—'}
        {unit && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4, fontWeight: 400 }}>{unit}</span>}
      </span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SessionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [session, setSession] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [stimuliCount, setStimuliCount] = useState(0)
  const [gazSummary, setGazSummary] = useState(null)

  // CSV upload state
  const [csvUploading, setCsvUploading] = useState(false)
  const [csvError, setCsvError] = useState('')
  const [csvFilename, setCsvFilename] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Load session + existing gaze data
  useEffect(() => {
    const s = getSessionById(id)
    if (s) {
      setSession(s)
      setStimuliCount(getStimuliForSession(id).length)
      const gaz = getGazSummary(id)
      if (gaz) setGazSummary(gaz)
    } else {
      setNotFound(true)
    }
  }, [id])

  // ── Derived phase ────────────────────────────────────────────────────────

  const hasStimuli = stimuliCount > 0 || session?.stimulus_loaded
  const csvUploaded = session?.csv_uploaded || false
  const currentPhase = csvUploaded ? 3 : hasStimuli ? 2 : 1

  // ── CSV handler — sends file to Flask backend ────────────────────────────

  const handleCsvUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv' && file.type !== 'text/plain') {
      setCsvError('Please select a .csv file exported from GP3HD or compatible eye-tracker software.')
      e.target.value = ''
      return
    }

    setCsvError('')
    setCsvUploading(true)
    setCsvFilename(file.name)

    const formData = new FormData()
    formData.append('file', file) // 'file' must match request.files['file'] in Flask

    try {
      const response = await fetch('http://localhost:5000/upload', {
        method: 'POST',
        body: formData,
        // Do NOT set Content-Type header — browser sets it automatically with boundary
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || `Server returned ${response.status}`)
      }

      const data = await response.json()
      // data contains: heatmap, scanpath, fixation_map (and whatever else Flask returns)

      // Build a summary object to save locally so the UI can display stats
      const summary = {
        session_id: id,
        uploaded_at: new Date().toISOString(),
        row_count: data.row_count ?? null,
        duration_sec: data.duration_sec ?? null,
        sample_rate_hz: data.sample_rate_hz ?? null,
        fixation_count: data.fixation_count ?? null,
        avg_fixation_duration_sec: data.avg_fixation_duration_sec ?? null,
        blink_count: data.blink_count ?? null,
        avg_blink_duration_sec: data.avg_blink_duration_sec ?? null,
        avg_pupil_left_mm: data.avg_pupil_left_mm ?? null,
        avg_pupil_right_mm: data.avg_pupil_right_mm ?? null,
        gaze_points: data.gaze_points ?? [],       // array of [x, y] for scatter plot
        headers: data.headers ?? [],               // column names for preview table
        preview_rows: data.preview_rows ?? [],     // first 8 rows for preview table
        detected_cols: data.detected_cols ?? {},   // detected column mapping
        // Full parsed data from Flask
        heatmap: data.heatmap ?? [],
        scanpath: data.scanpath ?? [],
        fixation_map: data.fixation_map ?? [],
      }

      saveGazSummary(summary)
      setGazSummary(summary)

      const updated = updateSession(id, { csv_uploaded: true, csv_filename: file.name })
      setSession(updated)
    } catch (err) {
      setCsvError(err.message || 'Failed to upload. Make sure the Flask server is running on port 5000.')
    } finally {
      setCsvUploading(false)
      e.target.value = ''
    }
  }

  const handleRemoveCsv = () => {
    deleteGazSummary(id)
    setGazSummary(null)
    const updated = updateSession(id, { csv_uploaded: false, csv_filename: null })
    setSession(updated)
    setCsvFilename('')
    setConfirmDelete(false)
    setShowPreview(false)
  }

  // ── Session delete ───────────────────────────────────────────────────────

  const handleDelete = () => {
    if (confirm(`Delete session ${id}? This cannot be undone.`)) {
      deleteSession(id)
      navigate('/')
    }
  }

  // ── Not found / loading ──────────────────────────────────────────────────

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

  // ── Render ───────────────────────────────────────────────────────────────

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
            <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
          </div>
        </div>

        <div className="detail-grid">
          {/* ── Left column ── */}
          <div>
            {/* Participant */}
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
                <span className={`type-badge ${session.stimulus_type}`}>{session.stimulus_type}</span>
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
                  <span style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>{session.notes}</span>
                </div>
              )}
            </div>

            {/* ── CSV Upload card ── */}
            <div className="card" style={csvUploaded ? { borderColor: 'var(--accent-dim)' } : {}}>
              <div className="detail-section-title">Phase 3 — GP3HD Data Import</div>

              {!csvUploaded ? (
                /* ── Upload state ── */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <p style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.7 }}>
                    Export the CSV from GP3HD software (File → Export Data), then upload it here.
                    The file will be sent to the analysis server for processing.
                  </p>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv,text/plain"
                    onChange={handleCsvUpload}
                    style={{ display: 'none' }}
                  />

                  <button
                    className={`btn ${csvUploading ? 'btn-ghost' : 'btn-primary'}`}
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => !csvUploading && fileInputRef.current?.click()}
                    disabled={csvUploading}
                  >
                    {csvUploading ? (
                      <>
                        <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>↻</span>
                        Uploading & Parsing…
                      </>
                    ) : (
                      <>↑ Upload GP3HD CSV</>
                    )}
                  </button>

                  {csvError && (
                    <div style={{
                      background: 'rgba(248,113,113,0.08)',
                      border: '1px solid rgba(248,113,113,0.25)',
                      borderRadius: 6,
                      padding: '10px 12px',
                      fontSize: 12,
                      color: 'var(--red)',
                      lineHeight: 1.6,
                    }}>
                      ⚠ {csvError}
                    </div>
                  )}

                  <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
                    Supports GP3HD format · parsed by Flask backend
                  </p>
                </div>
              ) : (
                /* ── Uploaded state ── */
                <div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 0',
                    marginBottom: 10,
                    borderBottom: '1px solid var(--border)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="pill pill-complete">
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
                        Uploaded
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>
                        {session.csv_filename || 'data.csv'}
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {gazSummary ? format(new Date(gazSummary.uploaded_at), 'MMM d · h:mm a') : ''}
                    </span>
                  </div>

                  {gazSummary && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, color: 'var(--text-dim)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Samples</span>
                        <span style={{ fontFamily: 'var(--mono)', color: 'var(--text)' }}>
                          {gazSummary.row_count != null ? gazSummary.row_count.toLocaleString() : '—'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Duration</span>
                        <span style={{ fontFamily: 'var(--mono)', color: 'var(--text)' }}>
                          {gazSummary.duration_sec != null ? `${gazSummary.duration_sec}s` : '—'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Sample rate</span>
                        <span style={{ fontFamily: 'var(--mono)', color: 'var(--text)' }}>
                          {gazSummary.sample_rate_hz != null ? `~${gazSummary.sample_rate_hz} Hz` : '—'}
                        </span>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                    <button
                      className="btn btn-ghost"
                      style={{ flex: 1, justifyContent: 'center', fontSize: 12 }}
                      onClick={() => setShowPreview(v => !v)}
                    >
                      {showPreview ? 'Hide Preview' : 'Preview Rows'}
                    </button>

                    {!confirmDelete ? (
                      <button
                        className="btn btn-danger"
                        style={{ fontSize: 12, padding: '8px 14px' }}
                        onClick={() => setConfirmDelete(true)}
                      >
                        Remove
                      </button>
                    ) : (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-danger" style={{ fontSize: 12 }} onClick={handleRemoveCsv}>
                          Confirm
                        </button>
                        <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setConfirmDelete(false)}>
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Row preview table */}
                  {showPreview && gazSummary?.preview_rows?.length > 0 && (
                    <div style={{ marginTop: 14, overflowX: 'auto' }}>
                      <table style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontFamily: 'var(--mono)',
                        fontSize: 10,
                        color: 'var(--text-dim)',
                      }}>
                        <thead>
                          <tr>
                            {gazSummary.headers.slice(0, 10).map(h => (
                              <th key={h} style={{
                                padding: '5px 8px',
                                textAlign: 'left',
                                background: 'var(--surface2)',
                                borderBottom: '1px solid var(--border)',
                                color: 'var(--text-muted)',
                                whiteSpace: 'nowrap',
                              }}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {gazSummary.preview_rows.map((row, ri) => (
                            <tr key={ri} style={{ borderBottom: '1px solid var(--border)' }}>
                              {gazSummary.headers.slice(0, 10).map(h => (
                                <td key={h} style={{ padding: '4px 8px', whiteSpace: 'nowrap', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {row[h] ?? ''}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6, textAlign: 'right', fontFamily: 'var(--mono)' }}>
                        showing first 8 rows · {gazSummary.headers.length} columns total{gazSummary.headers.length > 10 ? ` (displaying 10)` : ''}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Right column ── */}
          <div>
            {/* Phase tracker */}
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
                      <span className={`phase-label ${isActive ? 'active' : ''}`}>{p.label}</span>
                      {isActive && (
                        <span style={{
                          marginLeft: 'auto', fontSize: 10,
                          color: 'var(--accent)', fontFamily: 'var(--mono)',
                          textTransform: 'uppercase', letterSpacing: '0.06em',
                        }}>
                          current
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── Gaze statistics (shown only after upload) ── */}
            {gazSummary && (
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="detail-section-title">Gaze Statistics</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                  <StatTile label="Fixations"       value={gazSummary.fixation_count || '—'}       accent />
                  <StatTile label="Avg Fixation"    value={gazSummary.avg_fixation_duration_sec != null ? gazSummary.avg_fixation_duration_sec : '—'} unit="s" />
                  <StatTile label="Blinks"          value={gazSummary.blink_count || '—'} />
                  <StatTile label="Avg Blink"       value={gazSummary.avg_blink_duration_sec != null ? gazSummary.avg_blink_duration_sec : '—'} unit="s" />
                  {gazSummary.avg_pupil_left_mm && (
                    <StatTile label="Left Pupil Ø"  value={gazSummary.avg_pupil_left_mm} unit="mm" />
                  )}
                  {gazSummary.avg_pupil_right_mm && (
                    <StatTile label="Right Pupil Ø" value={gazSummary.avg_pupil_right_mm} unit="mm" />
                  )}
                </div>

                {/* Detected columns info */}
                {gazSummary.detected_cols && Object.keys(gazSummary.detected_cols).length > 0 && (
                  <div style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: '10px 12px',
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--mono)',
                    lineHeight: 1.8,
                  }}>
                    <span style={{ color: 'var(--text-dim)' }}>Detected columns: </span>
                    {Object.entries(gazSummary.detected_cols)
                      .filter(([, v]) => v !== null)
                      .map(([k, v]) => (
                        <span key={k} style={{
                          display: 'inline-block',
                          background: 'var(--surface2)',
                          border: '1px solid var(--border2)',
                          borderRadius: 3,
                          padding: '1px 6px',
                          marginRight: 4,
                          marginBottom: 2,
                          color: 'var(--accent)',
                          fontSize: 10,
                        }}>
                          {v}
                        </span>
                      ))
                    }
                  </div>
                )}
              </div>
            )}

            {/* ── Gaze scatter plot ── */}
            {gazSummary?.gaze_points?.length > 0 && (
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="detail-section-title">Fixation Scatter</div>
                <div style={{ position: 'relative', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                  <svg
                    viewBox="0 0 1 0.75"
                    width="100%"
                    preserveAspectRatio="xMidYMid meet"
                    style={{ display: 'block' }}
                  >
                    <rect x="0" y="0" width="1" height="0.75" fill="#0b0e14" />
                    <rect x="0" y="0" width="1" height="0.75" fill="none" stroke="var(--border2)" strokeWidth="0.005" />
                    {gazSummary.gaze_points.map(([x, y], i) => (
                      <circle
                        key={i}
                        cx={x}
                        cy={y * 0.75}
                        r="0.006"
                        fill="#39d98a"
                        opacity="0.3"
                      />
                    ))}
                  </svg>
                  <div style={{
                    position: 'absolute',
                    bottom: 8,
                    right: 10,
                    fontSize: 10,
                    fontFamily: 'var(--mono)',
                    color: 'var(--text-muted)',
                    background: 'rgba(8,10,15,0.7)',
                    padding: '2px 6px',
                    borderRadius: 4,
                  }}>
                    {gazSummary.gaze_points.length.toLocaleString()} fixation points
                  </div>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                  Scatter shows fixation POG coordinates (normalised 0–1). X = horizontal, Y = vertical.
                </p>
              </div>
            )}

            {/* Next step card */}
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
                    Stimulus is loaded. Finish your GP3HD recording, then upload the exported CSV below.
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
                    CSV is uploaded and parsed. Run analysis to generate heatmaps and fixation reports.
                  </p>
                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', justifyContent: 'center' }}
                    title="Analysis coming in Phase 4"
                    disabled
                  >
                    Run Analysis → (Phase 4)
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

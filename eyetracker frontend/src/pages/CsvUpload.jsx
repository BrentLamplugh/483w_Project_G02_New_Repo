import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { format } from 'date-fns'
import { getSessionById, updateSession } from '../store/sessions'
import { getStimuliForSession } from '../store/stimuli'
import { getGazSummary, saveGazSummary, deleteGazSummary } from '../store/gazdata'
import { showToast } from '../store/toast'

export default function CsvUpload() {
  const { id } = useParams()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [session, setSession] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [stimuliCount, setStimuliCount] = useState(0)
  const [gazSummary, setGazSummary] = useState(null)
  const [csvUploading, setCsvUploading] = useState(false)
  const [csvError, setCsvError] = useState('')
  const [csvFilename, setCsvFilename] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    const s = getSessionById(id)
    if (!s) {
      setNotFound(true)
      return
    }
    setSession(s)
    const stims = getStimuliForSession(id)
    setStimuliCount(stims.length)
    const gaz = getGazSummary(id)
    if (gaz) setGazSummary(gaz)
  }, [id])

  const canAccessStep = stimuliCount > 0 || session?.stimulus_loaded
  const csvUploaded = session?.csv_uploaded || false

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
    formData.append('file', file)

    try {
      const response = await fetch('http://localhost:5000/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || `Server returned ${response.status}`)
      }

      const data = await response.json()
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
        gaze_points: data.gaze_points ?? [],
        headers: data.headers ?? [],
        preview_rows: data.preview_rows ?? [],
        detected_cols: data.detected_cols ?? {},
        heatmap: data.heatmap ?? [],
        scanpath: data.scanpath ?? [],
        fixation_map: data.fixation_map ?? [],
        summary: data.summary ?? [],
      }

      saveGazSummary(summary)
      setGazSummary(summary)

      const updated = updateSession(id, { csv_uploaded: true, csv_filename: file.name })
      setSession(updated)
      showToast('CSV uploaded and parsed')
    } catch (err) {
      setCsvError(err.message || 'Failed to upload. Make sure the Flask server is running on port 5000.')
      showToast('CSV upload failed', { type: 'error' })
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
    showToast('CSV removed', { type: 'info' })
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
        <span className="topbar-subtitle">/ step 2 / csv upload</span>
      </header>

      <main className="page">
        <button className="back-link" onClick={() => navigate(`/sessions/${id}`)}>
          Back to session summary
        </button>

        <div className="page-header">
          <div>
            <div className="page-eyebrow">Step 2 of 3</div>
            <h1 className="page-title">Upload GP3HD CSV</h1>
            <p className="page-subtitle">
              Import eye-tracking data for session {session.session_id}.
            </p>
          </div>
        </div>

        {!canAccessStep && (
          <div style={{
            background: 'rgba(251,191,36,0.08)',
            border: '1px solid rgba(251,191,36,0.25)',
            borderRadius: 8,
            padding: '14px 16px',
            fontSize: 13,
            color: 'var(--amber)',
            marginBottom: 20,
          }}>
            Complete Step 1 first by adding at least one stimulus.
          </div>
        )}

        <div className="card" style={csvUploaded ? { borderColor: 'var(--accent-dim)' } : {}}>
          <div className="detail-section-title">CSV Import</div>

          {!csvUploaded ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.7 }}>
                Export the CSV from GP3HD software, then upload it here.
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv,text/plain"
                onChange={handleCsvUpload}
                style={{ display: 'none' }}
                disabled={!canAccessStep}
              />

              <button
                className={`btn ${csvUploading ? 'btn-ghost' : 'btn-primary'}`}
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => !csvUploading && canAccessStep && fileInputRef.current?.click()}
                disabled={csvUploading || !canAccessStep}
              >
                {csvUploading ? 'Uploading and parsing...' : 'Upload GP3HD CSV'}
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
                  {csvError}
                </div>
              )}
            </div>
          ) : (
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
                    {session.csv_filename || csvFilename || 'data.csv'}
                  </span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {gazSummary ? format(new Date(gazSummary.uploaded_at), 'MMM d | h:mm a') : ''}
                </span>
              </div>

              {gazSummary && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, color: 'var(--text-dim)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Samples</span>
                    <span style={{ fontFamily: 'var(--mono)', color: 'var(--text)' }}>
                      {gazSummary.row_count != null ? gazSummary.row_count.toLocaleString() : '-'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Duration</span>
                    <span style={{ fontFamily: 'var(--mono)', color: 'var(--text)' }}>
                      {gazSummary.duration_sec != null ? `${gazSummary.duration_sec}s` : '-'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Sample rate</span>
                    <span style={{ fontFamily: 'var(--mono)', color: 'var(--text)' }}>
                      {gazSummary.sample_rate_hz != null ? `~${gazSummary.sample_rate_hz} Hz` : '-'}
                    </span>
                  </div>
                </div>
              )}

              {gazSummary?.gaze_points?.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--accent)', marginBottom: 8 }}>
                    Fixation Scatter
                  </div>
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
                    Scatter shows fixation POG coordinates (normalized 0-1). X = horizontal, Y = vertical.
                  </p>
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
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 20 }}>
          <button className="btn btn-ghost" onClick={() => navigate(`/sessions/${id}/stimuli`)}>
            Back
          </button>
          <button
            className="btn btn-primary"
            onClick={() => navigate(`/sessions/${id}/analysis`)}
            disabled={!csvUploaded}
          >
            Next
          </button>
        </div>
      </main>
    </div>
  )
}

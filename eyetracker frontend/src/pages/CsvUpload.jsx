import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { format } from 'date-fns'
import { getSessionById, updateSession } from '../store/sessions'
import { getStimuliForSession } from '../store/stimuli'
import { getGazSummary, saveGazSummary, deleteGazSummary } from '../store/gazdata'
import { showToast } from '../store/toast'

// ─── helpers ─────────────────────────────────────────────────────────────────

function stripExt(name) {
  return name.replace(/\.[^.]+$/, '').toLowerCase()
}

function autoMatch(mediaNames, stimuli) {
  const mapping = {}
  mediaNames.forEach(mediaName => {
    const exact = stimuli.find(s => s.name.toLowerCase() === mediaName.toLowerCase())
    const noExt = !exact && stimuli.find(s => stripExt(s.name) === stripExt(mediaName))
    mapping[mediaName] = (exact || noExt)?.stimulus_id ?? ''
  })
  return mapping
}

function buildPerStimulus(perStimulusData, mapping) {
  const result = {}
  Object.entries(mapping).forEach(([mediaName, stimulusId]) => {
    if (stimulusId && perStimulusData[mediaName]) {
      result[stimulusId] = perStimulusData[mediaName]
    }
  })
  return result
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CsvUpload() {
  const { id } = useParams()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [session,       setSession]       = useState(null)
  const [notFound,      setNotFound]      = useState(false)
  const [stimuli,       setStimuli]       = useState([])
  const [gazSummary,    setGazSummary]    = useState(null)
  const [csvUploading,  setCsvUploading]  = useState(false)
  const [csvError,      setCsvError]      = useState('')
  const [csvFilename,   setCsvFilename]   = useState('')
  const [showPreview,   setShowPreview]   = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Mapping state — shown when CSV has a MEDIA_NAME/MEDIA_ID column
  const [pendingData,   setPendingData]   = useState(null)   // raw response from backend
  const [mapping,       setMapping]       = useState({})     // { mediaName: stimulus_id }

  useEffect(() => {
    async function load() {
      const s = await getSessionById(id)
      if (!s) { setNotFound(true); return }
      setSession(s)
      setStimuli(await getStimuliForSession(id))
      const gaz = await getGazSummary(id)
      if (gaz) setGazSummary(gaz)
    }
    load()
  }, [id])

  const canAccessStep = stimuli.length > 0 || session?.stimulus_loaded
  const csvUploaded   = session?.csv_uploaded || false

  // ── Save the final summary (called either directly or after mapping) ────────
  async function saveSummary(data, resolvedMapping) {
    const summary = {
      session_id:               id,
      uploaded_at:              new Date().toISOString(),
      row_count:                data.row_count             ?? null,
      duration_sec:             data.duration_sec          ?? null,
      sample_rate_hz:           data.sample_rate_hz        ?? null,
      fixation_count:           data.fixation_count        ?? null,
      avg_fixation_duration_sec:data.avg_fixation_duration_sec ?? null,
      blink_count:              data.blink_count           ?? null,
      avg_blink_duration_sec:   data.avg_blink_duration_sec ?? null,
      avg_pupil_left_mm:        data.avg_pupil_left_mm     ?? null,
      avg_pupil_right_mm:       data.avg_pupil_right_mm    ?? null,
      gaze_points:              data.gaze_points           ?? [],
      headers:                  data.headers               ?? [],
      preview_rows:             data.preview_rows          ?? [],
      detected_cols:            data.detected_cols         ?? {},
      heatmap:                  data.heatmap               ?? [],
      scanpath:                 data.scanpath              ?? [],
      fixation_map:             data.fixation_map          ?? [],
      summary:                  data.summary               ?? [],
      media_names:              data.media_names           ?? [],
      // per-stimulus keyed by stimulus_id (null when CSV has no media column)
      per_stimulus: resolvedMapping
        ? buildPerStimulus(data.per_stimulus_data, resolvedMapping)
        : null,
    }
    await saveGazSummary(summary)
    setGazSummary(summary)

    const updated = await updateSession(id, { csv_uploaded: true, csv_filename: csvFilename })
    setSession(updated)
    setPendingData(null)
    showToast('CSV uploaded and parsed')
  }

  // ── Upload handler ─────────────────────────────────────────────────────────
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
      const response = await fetch(`${import.meta.env.VITE_API_URL}/upload`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || `Server returned ${response.status}`)
      }

      const data = await response.json()

      if (data.media_names?.length > 0) {
        // CSV contains a media column — show mapping UI
        const autoMap = autoMatch(data.media_names, stimuli)
        setMapping(autoMap)
        setPendingData(data)
      } else {
        // No media column — save directly (single-stimulus behaviour)
        saveSummary(data, null)
      }
    } catch (err) {
      setCsvError(err.message || 'Failed to upload. Make sure the Flask server is running.')
      showToast('CSV upload failed', { type: 'error' })
    } finally {
      setCsvUploading(false)
      e.target.value = ''
    }
  }

  const handleApplyMapping = async () => {
    if (!pendingData) return
    await saveSummary(pendingData, mapping)
  }

  const handleRemoveCsv = async () => {
    await deleteGazSummary(id)
    setGazSummary(null)
    const updated = await updateSession(id, { csv_uploaded: false, csv_filename: null })
    setSession(updated)
    setCsvFilename('')
    setConfirmDelete(false)
    setShowPreview(false)
    setPendingData(null)
    showToast('CSV removed', { type: 'info' })
  }

  // ── Not found / loading ────────────────────────────────────────────────────
  if (notFound) return (
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
          <button className="btn btn-primary" onClick={() => navigate('/')}>Back to Dashboard</button>
        </div>
      </main>
    </div>
  )

  if (!session) return null

  const mappedCount   = Object.values(mapping).filter(Boolean).length
  const unmappedCount = pendingData ? pendingData.media_names.length - mappedCount : 0

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
            <p className="page-subtitle">Import eye-tracking data for session {session.session_id}.</p>
          </div>
        </div>

        {!canAccessStep && (
          <div style={{
            background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)',
            borderRadius: 8, padding: '14px 16px', fontSize: 13, color: 'var(--amber)', marginBottom: 20,
          }}>
            Complete Step 1 first by adding at least one stimulus.
          </div>
        )}

        {/* ── Mapping UI (shown after upload when CSV has media column) ── */}
        {pendingData && (
          <div className="card" style={{ marginBottom: 16, borderColor: 'var(--accent-dim)', background: 'var(--accent-glow)' }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--accent)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
              Match CSV stimuli to your uploaded images
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 16, lineHeight: 1.6 }}>
              {pendingData.media_names.length} stimulus/stimuli were found in the CSV.
              Match each one to the corresponding image you uploaded.
              {unmappedCount > 0 && (
                <span style={{ color: 'var(--amber)', marginLeft: 6 }}>
                  ({unmappedCount} unmatched — their data will be skipped)
                </span>
              )}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {pendingData.media_names.map(mediaName => {
                const stats = pendingData.per_stimulus_data[mediaName]
                return (
                  <div key={mediaName} style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr auto',
                    alignItems: 'center',
                    gap: 12,
                    background: 'var(--surface2)',
                    border: `1px solid ${mapping[mediaName] ? 'var(--accent-dim)' : 'var(--border)'}`,
                    borderRadius: 8,
                    padding: '12px 14px',
                  }}>
                    {/* CSV media name */}
                    <div>
                      <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        CSV media
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, fontFamily: 'var(--mono)' }}>
                        {mediaName}
                      </div>
                      {stats && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                          {stats.row_count?.toLocaleString()} rows
                          {stats.fixation_count != null && ` · ${stats.fixation_count} fixations`}
                          {stats.duration_sec != null && ` · ${stats.duration_sec}s`}
                        </div>
                      )}
                    </div>

                    {/* Stimulus selector */}
                    <div>
                      <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Uploaded stimulus
                      </div>
                      <select
                        className="form-input"
                        style={{ width: '100%', padding: '6px 10px', fontSize: 12 }}
                        value={mapping[mediaName] ?? ''}
                        onChange={e => setMapping(prev => ({ ...prev, [mediaName]: e.target.value }))}
                      >
                        <option value="">— skip this stimulus —</option>
                        {stimuli.map(s => (
                          <option key={s.stimulus_id} value={s.stimulus_id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Match indicator */}
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: mapping[mediaName] ? 'var(--accent)' : 'var(--surface)',
                      border: `1px solid ${mapping[mediaName] ? 'var(--accent)' : 'var(--border)'}`,
                      fontSize: 14, color: mapping[mediaName] ? '#080a0f' : 'var(--text-muted)',
                      flexShrink: 0,
                    }}>
                      {mapping[mediaName] ? '✓' : '—'}
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 12 }}
                onClick={() => setPendingData(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleApplyMapping}
                disabled={mappedCount === 0}
              >
                Apply Mapping ({mappedCount}/{pendingData.media_names.length} matched)
              </button>
            </div>
          </div>
        )}

        {/* ── CSV import card ───────────────────────────────────────────── */}
        <div className="card" style={csvUploaded ? { borderColor: 'var(--accent-dim)' } : {}}>
          <div className="detail-section-title">CSV Import</div>

          {!csvUploaded ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.7 }}>
                Export the CSV from GP3HD software, then upload it here.
                If the recording covered multiple stimuli, you will be prompted to match
                each one to your uploaded images.
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
                  background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)',
                  borderRadius: 6, padding: '10px 12px', fontSize: 12, color: 'var(--red)', lineHeight: 1.6,
                }}>
                  {csvError}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 0', marginBottom: 10, borderBottom: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="pill pill-complete">
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
                    Uploaded
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>
                    {session.csv_filename || csvFilename || 'data.csv'}
                  </span>
                  {gazSummary?.media_names?.length > 0 && (
                    <span style={{
                      fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--accent)',
                      background: 'var(--accent-glow)', border: '1px solid var(--accent-dim)',
                      borderRadius: 4, padding: '2px 7px',
                    }}>
                      {gazSummary.media_names.length} stimuli
                    </span>
                  )}
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

              {/* Per-stimulus summary when mapping was applied */}
              {gazSummary?.per_stimulus && Object.keys(gazSummary.per_stimulus).length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--accent)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Per-Stimulus Breakdown
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {gazSummary.media_names.map(mediaName => {
                      const matchedStimulusId = Object.keys(gazSummary.per_stimulus).find(sid => {
                        const stim = stimuli.find(s => s.stimulus_id === sid)
                        return stim && (
                          stim.name.toLowerCase() === mediaName.toLowerCase() ||
                          stripExt(stim.name) === stripExt(mediaName)
                        )
                      })
                      const stimData = matchedStimulusId ? gazSummary.per_stimulus[matchedStimulusId] : null
                      const stim = stimuli.find(s => s.stimulus_id === matchedStimulusId)

                      return (
                        <div key={mediaName} style={{
                          display: 'grid', gridTemplateColumns: '1fr auto auto auto',
                          alignItems: 'center', gap: 12,
                          background: 'var(--surface2)', border: '1px solid var(--border)',
                          borderRadius: 6, padding: '8px 12px', fontSize: 12,
                        }}>
                          <div>
                            <span style={{ color: 'var(--text)', fontFamily: 'var(--mono)', fontWeight: 600 }}>
                              {stim?.name ?? mediaName}
                            </span>
                          </div>
                          <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>
                            {stimData?.row_count?.toLocaleString() ?? '—'} rows
                          </span>
                          <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>
                            {stimData?.fixation_count ?? '—'} fix
                          </span>
                          <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>
                            {stimData?.duration_sec != null ? `${stimData.duration_sec}s` : '—'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {gazSummary?.gaze_points?.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--accent)', marginBottom: 8 }}>
                    Fixation Scatter (all stimuli combined)
                  </div>
                  <div style={{ position: 'relative', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                    <svg viewBox="0 0 1 0.75" width="100%" preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}>
                      <rect x="0" y="0" width="1" height="0.75" fill="#0b0e14" />
                      <rect x="0" y="0" width="1" height="0.75" fill="none" stroke="var(--border2)" strokeWidth="0.005" />
                      {gazSummary.gaze_points.map(([x, y], i) => (
                        <circle key={i} cx={x} cy={y * 0.75} r="0.006" fill="#39d98a" opacity="0.3" />
                      ))}
                    </svg>
                    <div style={{
                      position: 'absolute', bottom: 8, right: 10, fontSize: 10,
                      fontFamily: 'var(--mono)', color: 'var(--text-muted)',
                      background: 'rgba(8,10,15,0.7)', padding: '2px 6px', borderRadius: 4,
                    }}>
                      {gazSummary.gaze_points.length.toLocaleString()} fixation points
                    </div>
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
                  <button className="btn btn-danger" style={{ fontSize: 12, padding: '8px 14px' }} onClick={() => setConfirmDelete(true)}>
                    Remove
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-danger" style={{ fontSize: 12 }} onClick={handleRemoveCsv}>Confirm</button>
                    <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setConfirmDelete(false)}>Cancel</button>
                  </div>
                )}
              </div>

              {showPreview && gazSummary?.preview_rows?.length > 0 && (
                <div style={{ marginTop: 14, overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-dim)' }}>
                    <thead>
                      <tr>
                        {gazSummary.headers.slice(0, 10).map(h => (
                          <th key={h} style={{ padding: '5px 8px', textAlign: 'left', background: 'var(--surface2)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {gazSummary.preview_rows.map((row, ri) => (
                        <tr key={ri} style={{ borderBottom: '1px solid var(--border)' }}>
                          {gazSummary.headers.slice(0, 10).map(h => (
                            <td key={h} style={{ padding: '4px 8px', whiteSpace: 'nowrap', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis' }}>{row[h] ?? ''}</td>
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
          <button className="btn btn-ghost" onClick={() => navigate(`/sessions/${id}/stimuli`)}>Back</button>
          <button className="btn btn-primary" onClick={() => navigate(`/sessions/${id}/analysis`)} disabled={!csvUploaded}>Next</button>
        </div>
      </main>
    </div>
  )
}

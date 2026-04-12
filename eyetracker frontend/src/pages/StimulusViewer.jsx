/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { format } from 'date-fns'
import { getSessionById, updateSession } from '../store/sessions'
import { showToast } from '../store/toast'
import {
  getStimuliForSession,
  generateStimulusId,
  saveStimulus,
  deleteStimulus,
} from '../store/stimuli'

function guessLanguage(filename = '') {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (!ext) return 'text'
  if (['js', 'jsx', 'ts', 'tsx'].includes(ext)) return 'javascript'
  if (['py'].includes(ext)) return 'python'
  if (['java'].includes(ext)) return 'java'
  if (['c', 'cpp', 'h', 'hpp'].includes(ext)) return 'c/c++'
  if (['go'].includes(ext)) return 'go'
  if (['rb'].includes(ext)) return 'ruby'
  if (['rs'].includes(ext)) return 'rust'
  if (['html', 'htm'].includes(ext)) return 'html'
  if (['css', 'scss'].includes(ext)) return 'css'
  if (['json'].includes(ext)) return 'json'
  return 'text'
}

export default function StimulusViewer() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [stimuli, setStimuli] = useState([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [snippetName, setSnippetName] = useState('Code Snippet')
  const [snippetText, setSnippetText] = useState('')
  const [statusMsg, setStatusMsg] = useState('')

  useEffect(() => {
    const s = getSessionById(id)
    if (s) {
      setSession(s)
      setStimuli(getStimuliForSession(id))
    } else {
      setNotFound(true)
    }
  }, [id])

  useEffect(() => {
    if (stimuli.length > 0) {
      setActiveIndex(stimuli.length - 1)
      updateSession(id, { stimulus_loaded: true, stimuli_count: stimuli.length })
    }
  }, [stimuli, id])

  const activeStimulus = useMemo(
    () => (stimuli.length ? stimuli[Math.min(activeIndex, stimuli.length - 1)] : null),
    [stimuli, activeIndex]
  )
  const canContinue = stimuli.length > 0

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type || !file.type.startsWith('image/')) {
      setStatusMsg('Please upload an image file (PNG, JPG, JPEG, GIF, WEBP).')
      e.target.value = ''
      return
    }

    setIsProcessing(true)
    setStatusMsg('Reading image...')

    const reader = new FileReader()
    reader.onload = () => {
      const src = reader.result
      const img = new Image()

      img.onload = () => {
        const stimulus = {
          stimulus_id: generateStimulusId(id),
          session_id: id,
          type: 'image',
          name: file.name,
          src,
          width: img.naturalWidth,
          height: img.naturalHeight,
          size_kb: Math.round(file.size / 1024),
          created_at: new Date().toISOString(),
        }

        saveStimulus(stimulus)
        const list = getStimuliForSession(id)
        setStimuli(list)
      setActiveIndex(list.length - 1)
      setStatusMsg('Image added to session')
      showToast('Stimulus added')
      setIsProcessing(false)
      e.target.value = ''
      }

      img.onerror = () => {
        setStatusMsg('Could not load this image file.')
        setIsProcessing(false)
        e.target.value = ''
      }

      img.src = src
    }

    reader.onerror = () => {
      setStatusMsg('Failed to read file.')
      setIsProcessing(false)
      e.target.value = ''
    }

    reader.readAsDataURL(file)
  }

  const handleCodeFile = e => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsProcessing(true)
    setStatusMsg('Reading code file...')
    const reader = new FileReader()
    reader.onload = () => {
      addCodeStimulus(file.name, reader.result)
      e.target.value = ''
      setIsProcessing(false)
    }
    reader.readAsText(file)
  }

  const addCodeStimulus = (name, text) => {
    if (!text.trim()) return
    const lines = text.split(/\r?\n/)
    const stimulus = {
      stimulus_id: generateStimulusId(id),
      session_id: id,
      type: 'code',
      name: name || 'Code Snippet',
      language: guessLanguage(name),
      content: text,
      line_count: lines.length,
      created_at: new Date().toISOString(),
    }
    saveStimulus(stimulus)
    const list = getStimuliForSession(id)
    setStimuli(list)
    setSnippetText('')
    setStatusMsg('Code snippet added')
    showToast('Stimulus added')
  }

  const handleDelete = stimulusId => {
    deleteStimulus(stimulusId)
    const list = getStimuliForSession(id)
    setStimuli(list)
    setActiveIndex(0)
    setStatusMsg('Stimulus removed')
    showToast('Stimulus removed', { type: 'info' })
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
        <span className="topbar-subtitle">/ step 1 / stimuli</span>
      </header>

      <main className="page">
        <button className="back-link" onClick={() => navigate(`/sessions/${id}`)}>
          Back to session summary
        </button>

        <div className="page-header">
          <div>
            <div className="page-eyebrow">Step 1 of 3</div>
            <h1 className="page-title">Stimuli for {session.session_id}</h1>
            <p className="page-subtitle">
              Load images or code snippets, preview them, and log stimulus metadata.
            </p>
          </div>
        </div>

        <div className="detail-grid" style={{ gridTemplateColumns: '360px 1fr' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card">
              <div className="detail-section-title">Add Stimulus</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label className="form-label">Image file</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={isProcessing}
                  className="form-input"
                  style={{ padding: 10 }}
                />
                <div className="form-hint">PNG / JPG. Stored locally for this session.</div>

                <label className="form-label" style={{ marginTop: 10 }}>Code file</label>
                <input
                  type="file"
                  accept=".txt,.js,.jsx,.ts,.tsx,.py,.java,.c,.cpp,.go,.rb,.rs,.html,.css"
                  onChange={handleCodeFile}
                  disabled={isProcessing}
                  className="form-input"
                  style={{ padding: 10 }}
                />
                <div className="form-hint">Language is detected from file extension.</div>

                <label className="form-label" style={{ marginTop: 10 }}>Or paste code</label>
                <input
                  className="form-input"
                  placeholder="Snippet name"
                  value={snippetName}
                  onChange={e => setSnippetName(e.target.value)}
                  style={{ marginBottom: 8 }}
                />
                <textarea
                  className="form-input"
                  rows={4}
                  placeholder="Paste code snippet..."
                  value={snippetText}
                  onChange={e => setSnippetText(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
                  <button
                    className="btn btn-ghost"
                    onClick={() => {
                      setSnippetText('')
                      setSnippetName('Code Snippet')
                    }}
                    disabled={!snippetText}
                  >
                    Clear
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => addCodeStimulus(snippetName, snippetText)}
                    disabled={!snippetText.trim()}
                  >
                    Save Snippet
                  </button>
                </div>
                {statusMsg && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    {statusMsg}
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="detail-section-title">Stimuli in this session</div>
              {stimuli.length === 0 ? (
                <div className="empty-state" style={{ padding: 32, borderStyle: 'dashed' }}>
                  <div className="empty-title">No stimuli yet</div>
                  <div className="empty-desc">Upload an image or code snippet to begin.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {stimuli.map((s, idx) => {
                    const isActive = idx === activeIndex
                    return (
                      <div
                        key={s.stimulus_id}
                        className="card clickable"
                        style={{
                          padding: 12,
                          borderColor: isActive ? 'var(--accent-dim)' : 'var(--border)',
                          background: isActive ? 'var(--accent-glow)' : 'var(--surface)',
                        }}
                        onClick={() => setActiveIndex(idx)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span className={`type-badge ${s.type}`}>
                            {s.type === 'code' ? '{ }' : '[]'} {s.type}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: '#fff',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}>
                              {s.name}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {format(new Date(s.created_at), 'MMM d | h:mm a')}
                            </div>
                          </div>
                          <button
                            className="btn btn-ghost"
                            style={{ padding: '4px 10px', fontSize: 11 }}
                            onClick={e => { e.stopPropagation(); handleDelete(s.stimulus_id) }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card" style={{ minHeight: 420 }}>
              <div className="detail-section-title">Preview for participant</div>

              {activeStimulus ? (
                <>
                  <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className={`type-badge ${activeStimulus.type}`}>
                      {activeStimulus.type}
                    </span>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{activeStimulus.name}</div>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                      <button
                        className="btn btn-ghost"
                        onClick={() => setActiveIndex(Math.max(0, activeIndex - 1))}
                        disabled={activeIndex === 0}
                      >
                        Prev
                      </button>
                      <button
                        className="btn btn-ghost"
                        onClick={() => setActiveIndex(Math.min(stimuli.length - 1, activeIndex + 1))}
                        disabled={activeIndex >= stimuli.length - 1}
                      >
                        Next
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      background: 'var(--surface2)',
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      padding: 16,
                      minHeight: 320,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {activeStimulus.type === 'image' ? (
                      <img
                        src={activeStimulus.src}
                        alt={activeStimulus.name}
                        style={{
                          maxWidth: '100%',
                          maxHeight: 360,
                          borderRadius: 8,
                          objectFit: 'contain',
                          boxShadow: '0 10px 40px rgba(0,0,0,0.45)',
                        }}
                      />
                    ) : (
                      <pre
                        style={{
                          width: '100%',
                          maxHeight: 360,
                          overflow: 'auto',
                          background: '#0b0e14',
                          borderRadius: 8,
                          padding: 14,
                          fontFamily: 'var(--mono)',
                          fontSize: 12,
                          lineHeight: 1.5,
                          border: '1px solid var(--border2)',
                          color: '#e2e8f5',
                        }}
                      >
                        {activeStimulus.content}
                      </pre>
                    )}
                  </div>
                </>
              ) : (
                <div className="empty-state" style={{ padding: 40, borderStyle: 'dashed' }}>
                  <div className="empty-title">Nothing selected</div>
                  <div className="empty-desc">
                    Add a stimulus on the left, then select it to preview.
                  </div>
                </div>
              )}
            </div>

            <div className="card">
              <div className="detail-section-title">Logged Stimulus Metadata</div>
              {activeStimulus ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  <Meta label="Type" value={activeStimulus.type} />
                  <Meta label="Name" value={activeStimulus.name} />
                  <Meta label="Created" value={format(new Date(activeStimulus.created_at), 'MMM d, yyyy h:mm a')} />
                  {activeStimulus.type === 'image' && (
                    <>
                      <Meta label="Dimensions" value={`${activeStimulus.width} x ${activeStimulus.height}`} />
                      <Meta label="Size (KB)" value={activeStimulus.size_kb} />
                    </>
                  )}
                  {activeStimulus.type === 'code' && (
                    <>
                      <Meta label="Language" value={activeStimulus.language} />
                      <Meta label="Lines" value={activeStimulus.line_count} />
                    </>
                  )}
                  <Meta label="Stimuli total" value={stimuli.length} />
                  <Meta label="Session ID" value={session.session_id} />
                </div>
              ) : (
                <div className="empty-state" style={{ padding: 28, borderStyle: 'dashed' }}>
                  <div className="empty-title">No metadata yet</div>
                  <div className="empty-desc">Select a stimulus to see its details.</div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 20 }}>
          <button className="btn btn-ghost" onClick={() => navigate(`/sessions/${id}`)}>
            Back
          </button>
          <button
            className="btn btn-primary"
            onClick={() => navigate(`/sessions/${id}/upload`)}
            disabled={!canContinue}
          >
            Next
          </button>
        </div>
      </main>
    </div>
  )
}

function Meta({ label, value }) {
  return (
    <div style={{
      background: 'var(--surface2)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      minHeight: 64,
    }}>
      <span style={{
        fontSize: 11,
        fontFamily: 'var(--mono)',
        color: 'var(--text-muted)',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}>
        {label}
      </span>
      <span style={{ fontSize: 13, color: 'var(--text)' }}>{value ?? '-'}</span>
    </div>
  )
}

/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSessions } from '../store/sessions'
import SessionCard from '../components/SessionCard'

export default function Dashboard() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState([])
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    getSessions().then(setSessions)
  }, [])

  const filtered = filter === 'all'
    ? sessions
    : filter === 'ready'
    ? sessions.filter(s => s.csv_uploaded)
    : sessions.filter(s => !s.csv_uploaded)

  const total = sessions.length
  const ready = sessions.filter(s => s.csv_uploaded).length
  const pending = total - ready

  return (
    <div className="layout">
      <header className="topbar">
        <div className="topbar-dot" />
        <span className="topbar-title">GazeScope</span>
        <span className="topbar-subtitle">/ session manager</span>
      </header>

      <main className="page">
        <div className="page-header">
          <div>
            <div className="page-eyebrow">Research Dashboard</div>
            <h1 className="page-title">Sessions</h1>
            <p className="page-subtitle">Manage participant sessions and eye-tracking data</p>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/sessions/new')}>
            <span>+</span> New Session
          </button>
        </div>

        {/* Stats */}
        {total > 0 && (
          <div className="stats-bar">
            <div className="stat-item">
              <span className="stat-value">{total}</span>
              <span className="stat-label">Total Sessions</span>
            </div>
            <div className="stat-item">
              <span className="stat-value" style={{ color: 'var(--accent)' }}>{ready}</span>
              <span className="stat-label">Data Ready</span>
            </div>
            <div className="stat-item">
              <span className="stat-value" style={{ color: 'var(--amber)' }}>{pending}</span>
              <span className="stat-label">Awaiting CSV</span>
            </div>
          </div>
        )}

        {/* Filter */}
        {total > 0 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {['all', 'ready', 'pending'].map(f => (
              <button
                key={f}
                className={`btn ${filter === f ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '6px 14px', fontSize: 12 }}
                onClick={() => setFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        )}

        {/* Sessions grid */}
        {filtered.length > 0 ? (
          <div className="sessions-grid">
            {filtered.map(s => (
              <SessionCard key={s.session_id} session={s} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">◎</div>
            <div className="empty-title">
              {total === 0 ? 'No sessions yet' : 'No sessions match this filter'}
            </div>
            <div className="empty-desc">
              {total === 0
                ? 'Create your first session to get started with data collection'
                : 'Try switching to a different filter above'}
            </div>
            {total === 0 && (
              <button className="btn btn-primary" onClick={() => navigate('/sessions/new')}>
                + Create First Session
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'

export default function SessionCard({ session }) {
  const navigate = useNavigate()
  const description = session.notes?.trim() || session.description?.trim() || ''

  const typeColors = {
    image: 'image',
    code: 'code',
    video: 'video',
  }

  return (
    <div
      className="card clickable"
      onClick={() => navigate(`/sessions/${session.session_id}`)}
    >
      <div className="session-card-header">
        <span className="session-id">{session.session_id}</span>
        <span className={`type-badge ${typeColors[session.stimulus_type] || 'code'}`}>
          {session.stimulus_type}
        </span>
      </div>

      <div className="session-task">{session.task_name}</div>
      <div className="session-participant">
        {session.participant_name}
        {session.participant_id && (
          <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>
            | {session.participant_id}
          </span>
        )}
      </div>

      {description && <div className="session-description">{description}</div>}

      <div className="session-meta">
        <div className="meta-item">
          <span className="meta-label">Date</span>
          <span className="meta-value">
            {format(new Date(session.date), 'MMM d, yyyy')}
          </span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Status</span>
          <span className="meta-value" style={{ color: session.csv_uploaded ? 'var(--accent)' : 'var(--amber)' }}>
            {session.csv_uploaded ? 'Data Ready' : 'Awaiting CSV'}
          </span>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { apiRequest } from '../api'

function toLocalDateTime(value) {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

function InterviewPanel({ applicationId, token, userId, role, onInterviewChange }) {
  const [interviews, setInterviews] = useState([])
  const [scheduledAt, setScheduledAt] = useState(() => toLocalDateTime(new Date(Date.now() + 3600000)))
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    apiRequest(`/api/applications/${applicationId}/interviews`, { token })
      .then((data) => {
        if (active) setInterviews(data)
      })
      .catch((requestError) => {
        if (active) setError(requestError.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [applicationId, token])

  async function schedule(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const interview = await apiRequest(`/api/applications/${applicationId}/interviews`, {
        method: 'POST',
        token,
        body: JSON.stringify({ scheduled_at: new Date(scheduledAt).toISOString(), note }),
      })
      setInterviews((current) => [interview, ...current])
      onInterviewChange?.()
      setNote('')
      setMessage('Interview invitation sent.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  async function respond(interviewId, status) {
    setError('')
    setMessage('')
    try {
      const updated = await apiRequest(`/api/interviews/${interviewId}/response`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ status }),
      })
      setInterviews((current) => current.map((item) => item.id === updated.id ? updated : item))
      onInterviewChange?.()
      setMessage(`Interview invitation ${status}.`)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  return (
    <div className="application-tool">
      {role === 'employer' && (
        <form className="interview-form" onSubmit={schedule}>
          <h4>Invite to interview</h4>
          <label htmlFor={`interview-time-${applicationId}`}>Date and time</label>
          <input
            id={`interview-time-${applicationId}`}
            type="datetime-local"
            min={toLocalDateTime(new Date())}
            value={scheduledAt}
            onChange={(event) => setScheduledAt(event.target.value)}
            required
          />
          <label htmlFor={`interview-note-${applicationId}`}>Details (optional)</label>
          <textarea
            id={`interview-note-${applicationId}`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Meeting link or additional details"
            maxLength={2000}
            rows={2}
          />
          <button className="button button-secondary" type="submit" disabled={saving}>
            {saving ? 'Sending…' : 'Send invitation'}
          </button>
        </form>
      )}
      <section className="interview-list" aria-label="Interview invitations">
        <h4>Interview invitations</h4>
        {error && <p className="state-message error-message" role="alert">{error}</p>}
        {message && <p className="state-message" role="status">{message}</p>}
        {loading ? <p className="state-message">Loading interviews…</p> : interviews.length === 0 ? (
          <p className="conversation-empty">No interview invitations yet.</p>
        ) : interviews.map((interview) => (
          <article className="interview-item" key={interview.id}>
            <div>
              <strong>{new Date(interview.scheduled_at).toLocaleString()}</strong>
              {interview.note && <p>{interview.note}</p>}
              <span className={`status-badge status-${interview.status}`}>{interview.status}</span>
            </div>
            {role === 'job_seeker' && interview.created_by !== userId && interview.status === 'proposed' && (
              <div className="interview-actions">
                <button className="button button-primary" type="button" onClick={() => respond(interview.id, 'accepted')}>Accept</button>
                <button className="button button-secondary" type="button" onClick={() => respond(interview.id, 'declined')}>Decline</button>
              </div>
            )}
          </article>
        ))}
      </section>
    </div>
  )
}

export default InterviewPanel

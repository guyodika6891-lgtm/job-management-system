import { useEffect, useState } from 'react'
import { apiRequest } from '../api'

function ApplicationConversation({ applicationId, token, userId }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    let active = true
    setLoading(true)
    apiRequest(`/api/applications/${applicationId}/messages`, { token })
      .then((data) => {
        if (active) setMessages(data)
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
  }, [applicationId, open, token])

  async function sendMessage(event) {
    event.preventDefault()
    setSending(true)
    setError('')
    try {
      const message = await apiRequest(`/api/applications/${applicationId}/messages`, {
        method: 'POST',
        token,
        body: JSON.stringify({ body }),
      })
      setMessages((current) => [...current, message])
      setBody('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="application-tool">
      <button className="button button-secondary" type="button" onClick={() => setOpen((value) => !value)}>
        {open ? 'Hide messages' : 'Messages'}
      </button>
      {open && (
        <section className="conversation-panel" aria-label="Application messages">
          <div className="conversation-heading">
            <h4>Conversation</h4>
            <span>Messages are shared with the applicant and employer.</span>
          </div>
          {error && <p className="state-message error-message" role="alert">{error}</p>}
          {loading ? <p className="state-message">Loading messages…</p> : (
            <div className="conversation-messages" aria-live="polite">
              {messages.length === 0 ? (
                <p className="conversation-empty">Start a conversation about this application.</p>
              ) : messages.map((message) => (
                <article className={`conversation-message${message.sender_id === userId ? ' conversation-message-own' : ''}`} key={message.id}>
                  <strong>{message.sender_id === userId ? 'You' : 'Hiring team / applicant'}</strong>
                  <p>{message.body}</p>
                  <time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString()}</time>
                </article>
              ))}
            </div>
          )}
          <form className="conversation-compose" onSubmit={sendMessage}>
            <label className="sr-only" htmlFor={`message-${applicationId}`}>Write a message</label>
            <textarea
              id={`message-${applicationId}`}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Write a message…"
              maxLength={5000}
              required
              rows={2}
            />
            <button className="button button-primary" type="submit" disabled={sending || !body.trim()}>
              {sending ? 'Sending…' : 'Send'}
            </button>
          </form>
        </section>
      )}
    </div>
  )
}

export default ApplicationConversation

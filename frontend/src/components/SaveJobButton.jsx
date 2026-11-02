import { useState } from 'react'
import { apiRequest } from '../api'

function SaveJobButton({ jobId, isSaved, token, onSavedChange }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function toggleSaved() {
    setSaving(true)
    setError('')
    try {
      await apiRequest(`/api/saved-jobs/${jobId}`, {
        method: isSaved ? 'DELETE' : 'POST',
        token,
      })
      onSavedChange(jobId, !isSaved)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <span className="save-job-control">
      <button
        className={`button ${isSaved ? 'button-saved' : 'button-secondary'}`}
        type="button"
        onClick={toggleSaved}
        disabled={saving}
        aria-pressed={isSaved}
      >
        {saving ? 'Saving…' : isSaved ? '♥ Saved' : '♡ Save job'}
      </button>
      {error && <span className="save-job-error" role="alert">{error}</span>}
    </span>
  )
}

export default SaveJobButton

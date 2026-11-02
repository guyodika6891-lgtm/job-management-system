import { useCallback, useEffect, useState } from 'react'
import { apiRequest } from '../api'

function SavedSearchAlerts({ token }) {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadAlerts = useCallback(async () => {
    setError('')
    try {
      const data = await apiRequest('/api/search-alerts/', { token })
      setAlerts(data)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    loadAlerts()
  }, [loadAlerts])

  useEffect(() => {
    function handleAlertCreated() {
      loadAlerts()
    }
    window.addEventListener('jobconnect:search-alert-created', handleAlertCreated)
    return () => window.removeEventListener('jobconnect:search-alert-created', handleAlertCreated)
  }, [loadAlerts])

  async function removeAlert(alertId) {
    setError('')
    try {
      await apiRequest(`/api/search-alerts/${alertId}`, { method: 'DELETE', token })
      setAlerts((current) => current.filter((alert) => alert.id !== alertId))
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  return (
    <section className="dashboard-panel saved-alerts-panel" aria-labelledby="saved-alerts-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">PERSONALIZED DISCOVERY</p>
          <h2 id="saved-alerts-heading">Job alerts<span className="heading-period">.</span></h2>
          <p>We’ll add an in-app notification when a new listing matches.</p>
        </div>
      </div>
      {error && <p className="state-message error-message" role="alert">{error}</p>}
      {loading ? <p className="state-message">Loading job alerts…</p> : alerts.length === 0 ? (
        <p className="state-message">No saved searches yet. Search for roles and create an alert from the job listings page.</p>
      ) : (
        <div className="saved-alert-list">
          {alerts.map((alert) => (
            <article className="saved-alert-item" key={alert.id}>
              <div>
                <strong>{alert.name}</strong>
                <p>{[
                  alert.q && `Keywords: ${alert.q}`,
                  alert.location && `Location: ${alert.location}`,
                  alert.company && `Company: ${alert.company}`,
                  alert.salary && `Salary: ${alert.salary}`,
                ].filter(Boolean).join(' · ')}</p>
              </div>
              <button className="button button-secondary" type="button" onClick={() => removeAlert(alert.id)}>Remove alert</button>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default SavedSearchAlerts

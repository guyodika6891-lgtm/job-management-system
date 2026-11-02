import { useCallback, useEffect, useState } from 'react'
import { apiRequest } from '../api'

function NotificationCenter({ token }) {
  const [notifications, setNotifications] = useState([])
  const [error, setError] = useState('')

  const loadNotifications = useCallback(async () => {
    try {
      const data = await apiRequest('/api/notifications/me', { token })
      setNotifications(data)
    } catch (requestError) {
      setError(requestError.message)
    }
  }, [token])

  useEffect(() => {
    let active = true
    apiRequest('/api/notifications/me', { token })
      .then((data) => {
        if (active) setNotifications(data)
      })
      .catch((requestError) => {
        if (active) setError(requestError.message)
      })
    return () => {
      active = false
    }
  }, [token])

  async function markRead(notificationId) {
    setError('')
    try {
      await apiRequest(`/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
        token,
      })
      await loadNotifications()
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const unreadCount = notifications.filter((notification) => !notification.read_at).length

  return (
    <section className="content-section notifications-section" aria-labelledby="notifications-heading">
      <div className="section-heading">
        <div>
          <h2 id="notifications-heading">Notifications</h2>
          <p>{unreadCount ? `${unreadCount} unread update${unreadCount === 1 ? '' : 's'}` : 'You’re all caught up.'}</p>
        </div>
      </div>
      {error && <p className="state-message error-message" role="alert">{error}</p>}
      {notifications.length === 0 ? (
        <p className="state-message">Updates about applications will appear here.</p>
      ) : (
        <div className="application-list">
          {notifications.map((notification) => (
            <article className={`notification-card${notification.read_at ? '' : ' notification-unread'}`} key={notification.id}>
              <div>
                <p>{notification.message}</p>
                <small>{new Date(notification.created_at).toLocaleString()}</small>
              </div>
              <div className="notification-actions">
                {!notification.read_at && (
                  <button className="button button-secondary" type="button" onClick={() => markRead(notification.id)}>
                    Mark as read
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default NotificationCenter

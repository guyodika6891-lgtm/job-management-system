import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { apiRequest } from '../api'

function PasswordReset() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setMessage('')
    setError('')
    setLoading(true)
    try {
      const response = token
        ? await apiRequest('/api/auth/password-reset/confirm', {
          method: 'POST',
          body: JSON.stringify({ token, new_password: password }),
        })
        : await apiRequest('/api/auth/password-reset/request', {
          method: 'POST',
          body: JSON.stringify({ email }),
        })
      setMessage(response.message)
      setPassword('')
      setConfirmation('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app auth-page">
      <main className="auth-container login-container auth-screen">
        <div className="login-layout auth-layout">
          <section className="auth-promo" aria-label="JobConnect password recovery">
            <div className="auth-promo-header">
              <span className="auth-brand-mark" aria-hidden="true">J</span>
              <span>JobConnect</span>
            </div>
            <div className="auth-promo-copy">
              <p>YOUR CAREER SPACE</p>
              <h1>A fresh start<br />is one step away.</h1>
              <div className="auth-illustration" aria-hidden="true">
                <span className="illustration-float illustration-crown">♛</span>
                <span className="illustration-float illustration-cloud">☁</span>
                <span className="illustration-float illustration-monitor">▣</span>
                <span className="illustration-float illustration-shield">⬟</span>
                <div className="illustration-photo">
                  <span>🔐</span>
                  <strong>Your account,<br />securely yours.</strong>
                </div>
                <span className="illustration-float illustration-spark">✦</span>
                <span className="illustration-float illustration-folder">▰</span>
              </div>
              <p className="auth-promo-caption">We’ll help you get back to your applications and opportunities.</p>
            </div>
          </section>

          <section className="auth-panel">
            <div className="auth-panel-content">
              <p className="auth-panel-kicker">ACCOUNT RECOVERY</p>
              <h2>{token ? 'Create a new password' : 'Forgot password?'}</h2>
              <p className="login-form-copy">
                {token
                  ? 'Choose a new password for your JobConnect account.'
                  : 'Enter your email and we’ll send you a secure password reset link.'}
              </p>
              <form className="auth-form login-form auth-credentials-form" onSubmit={submit}>
                {token ? (
                  <>
                    <label htmlFor="reset-password">New password</label>
                    <input
                      id="reset-password"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={128}
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                    <label htmlFor="reset-password-confirm">Confirm new password</label>
                    <input
                      id="reset-password-confirm"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={128}
                      required
                      value={confirmation}
                      onChange={(event) => setConfirmation(event.target.value)}
                    />
                  </>
                ) : (
                  <>
                    <label htmlFor="reset-email">Email address</label>
                    <input
                      id="reset-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                    />
                  </>
                )}
                <button
                  className="button button-primary"
                  type="submit"
                  disabled={loading || (Boolean(token) && password !== confirmation)}
                >
                  {loading
                    ? 'Please wait…'
                    : token
                      ? 'Update password'
                      : 'Send reset link'}
                  <span aria-hidden="true">→</span>
                </button>
                {token && password && confirmation && password !== confirmation && (
                  <p className="auth-message" role="alert">Passwords do not match.</p>
                )}
                {message && <p className="auth-message" role="status">{message}</p>}
                {error && <p className="auth-message" role="alert">{error}</p>}
              </form>
              <p className="login-register-prompt"><Link to="/login">Back to login</Link></p>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

export default PasswordReset

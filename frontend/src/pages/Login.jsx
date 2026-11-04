import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import GoogleSignInButton from '../components/GoogleSignInButton'
import { useAuth } from '../context/useAuth'

function destinationFor(role) {
  if (role === 'admin') return '/admin'
  return role === 'employer' ? '/employer' : '/job-seeker'
}

function Login() {
  const { login, loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [message, setMessage] = useState(
    location.state?.registered ? 'Registration successful. You can now log in.' : '',
  )
  const [loading, setLoading] = useState(false)

  async function completeLogin(authenticate) {
    setMessage('')
    setLoading(true)
    try {
      const loggedInUser = await authenticate()
      navigate(destinationFor(loggedInUser.role), { replace: true })
    } catch (error) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    return completeLogin(() => login(email, password, rememberMe))
  }

  function handleGoogleCredential(credential) {
    return completeLogin(() => loginWithGoogle(credential, rememberMe))
  }

  return (
    <div className="app auth-page">
      <main className="auth-container login-container auth-screen">
        <div className="login-layout auth-layout">
          <section className="auth-promo" aria-label="Find your next opportunity">
            <div className="auth-promo-header">
              <span className="auth-brand-mark" aria-hidden="true">J</span>
              <span>JobConnect</span>
            </div>
            <div className="auth-promo-copy">
              <p>Find Your Dream Job</p>
              <h1>Join quality teams<br />and get hired</h1>
              <div className="auth-illustration" aria-hidden="true">
                <span className="illustration-float illustration-crown">♛</span>
                <span className="illustration-float illustration-cloud">☁</span>
                <span className="illustration-float illustration-monitor">▣</span>
                <span className="illustration-float illustration-shield">⬟</span>
                <div className="illustration-photo">
                  <span>🤝</span>
                  <strong>People. Potential.<br />Possibilities.</strong>
                </div>
                <span className="illustration-float illustration-spark">✦</span>
                <span className="illustration-float illustration-folder">▰</span>
              </div>
              <p className="auth-promo-caption">
                Discover roles that fit your ambitions, meet great people, and keep your next move on track.
              </p>
            </div>
          </section>

          <section className="auth-panel">
            <div className="auth-panel-content">
              <p className="auth-panel-kicker">WELCOME BACK</p>
              <h2>Login</h2>
              <p className="login-form-copy">Log in to your account and start searching for your dream job.</p>

              <GoogleSignInButton
                onCredential={handleGoogleCredential}
                onError={setMessage}
                disabled={loading}
              />
              <div className="auth-divider"><span>or continue with email</span></div>

              <form className="auth-form login-form auth-credentials-form" onSubmit={handleSubmit}>
                <label htmlFor="login-email">Email address</label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                />

                <label htmlFor="login-password">Password</label>
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  required
                />

                <div className="auth-form-options">
                  <label className="remember-option">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(event) => setRememberMe(event.target.checked)}
                    />
                    <span>Remember me</span>
                  </label>
                  <Link to="/forgot-password">Forgot password?</Link>
                </div>

                <button className="button button-primary" type="submit" disabled={loading}>
                  {loading ? 'Signing in…' : 'Login'} <span aria-hidden="true">→</span>
                </button>
                {message && <p className="auth-message" role="alert">{message}</p>}
              </form>

              <p className="login-register-prompt">
                Don’t have an account? <Link to="/register">Sign up</Link>
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

export default Login

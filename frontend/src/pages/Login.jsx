
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader'
import { useAuth } from '../context/useAuth'

function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState(
    location.state?.registered ? 'Registration successful. You can now log in.' : '',
  )
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setMessage('')
    setLoading(true)

    try {
      const loggedInUser = await login(email, password)

      navigate(loggedInUser.role === 'employer' ? '/employer' : '/job-seeker', { replace: true })
    } catch (error) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      <SiteHeader />
      <main className="auth-container login-container">
       <div className="login-layout">
        <aside className="login-welcome">
          <div className="login-welcome-content">
            <span className="login-mark" aria-hidden="true">J</span>
            <p className="login-kicker">WELCOME TO JOBCONNECT</p>
            <h1>Your next chapter<br />starts here.</h1>
            <p className="login-welcome-copy">A calmer, clearer way to find the work you want—or the people you need.</p>
            <div className="login-benefits">
              <span><i aria-hidden="true">✓</i> Opportunities worth your time</span>
              <span><i aria-hidden="true">✓</i> Every application in one place</span>
              <span><i aria-hidden="true">✓</i> A direct connection to employers</span>
            </div>
          </div>
          <span className="login-decoration login-decoration-one" aria-hidden="true" />
          <span className="login-decoration login-decoration-two" aria-hidden="true" />
          <p className="login-aside-footer">Make your next move count.</p>
        </aside>

        <form className="auth-form login-form" onSubmit={handleSubmit}>
          <p className="eyebrow">YOUR CAREER SPACE</p>
          <h2>Welcome back</h2>
          <p className="login-form-copy">Sign in to pick up where you left off.</p>

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

          <button className="button button-primary" type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'} <span aria-hidden="true">→</span>
          </button>

          {message && <p className="auth-message" role="status">{message}</p>}

          <p className="login-register-prompt">
            New to JobConnect? <Link to="/register">Create an account</Link>
          </p>
        </form>
       </div>
      </main>
    </div>
  )
}

export default Login

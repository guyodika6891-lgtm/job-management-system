import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import GoogleSignInButton from '../components/GoogleSignInButton'
import { apiRequest } from '../api'
import { useAuth } from '../context/useAuth'

function Register() {
  const navigate = useNavigate()
  const { loginWithGoogle } = useAuth()
  const [registrationStatus, setRegistrationStatus] = useState(null)
  const [statusError, setStatusError] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'job_seeker',
    company_name: '',
    admin_registration_code: '',
  })
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true
    apiRequest('/api/auth/registration-status')
      .then((data) => {
        if (active) setRegistrationStatus(data)
      })
      .catch((error) => {
        if (active) setStatusError(error.message)
      })
    return () => {
      active = false
    }
  }, [retryCount])

  function handleChange(event) {
    setFormData((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setMessage('')
    setLoading(true)
    try {
      await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          company_name: formData.role === 'employer' ? formData.company_name.trim() : null,
          admin_registration_code: formData.role === 'admin'
            ? formData.admin_registration_code
            : null,
        }),
      })
      navigate('/login', { state: { registered: true } })
    } catch (error) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleCredential(credential) {
    setMessage('')
    setLoading(true)
    try {
      const loggedInUser = await loginWithGoogle(credential)
      const destination = loggedInUser.role === 'admin'
        ? '/admin'
        : loggedInUser.role === 'employer'
          ? '/employer'
          : '/job-seeker'
      navigate(destination, { replace: true })
    } catch (error) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  const setupAvailable = registrationStatus?.admin_setup_available
  const adminExists = registrationStatus?.admin_exists

  return (
    <div className="app auth-page">
      <main className="auth-container login-container auth-screen">
        <div className="login-layout auth-layout">
          <section className="auth-promo" aria-label="Create your JobConnect account">
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
                Create a free account to discover opportunities, connect with employers, and manage your applications.
              </p>
            </div>
          </section>

          <section className="auth-panel register-auth-panel">
            <div className="auth-panel-content">
              <p className="auth-panel-kicker">GET STARTED FOR FREE</p>
              <h2>Sign up</h2>
              <p className="login-form-copy">Create an account to find opportunities or build your team.</p>
              <GoogleSignInButton
                onCredential={handleGoogleCredential}
                onError={setMessage}
                disabled={loading}
              />
              <div className="auth-divider"><span>or sign up with email</span></div>

              <form className="auth-form login-form register-form auth-credentials-form" onSubmit={handleSubmit}>
                <label htmlFor="full_name">Full name</label>
                <input
                  id="full_name"
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  placeholder="Enter your full name"
                  required
                  minLength={2}
                  maxLength={150}
                  autoComplete="name"
                />

                <label htmlFor="email">Email address</label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Enter your email"
                  required
                  autoComplete="email"
                />

                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Create a password"
                  required
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                />

                <label htmlFor="role">I’m here to</label>
                <select id="role" name="role" value={formData.role} onChange={handleChange}>
                  <option value="job_seeker">Job seeker</option>
                  <option value="employer">Employer</option>
                  {setupAvailable && <option value="admin">System administrator</option>}
                </select>

                {formData.role === 'employer' && (
                  <>
                    <label htmlFor="company_name">Company name</label>
                    <input
                      id="company_name"
                      type="text"
                      name="company_name"
                      value={formData.company_name}
                      onChange={handleChange}
                      minLength={2}
                      maxLength={150}
                      placeholder="Your organization"
                      required
                    />
                  </>
                )}

                {formData.role === 'admin' && (
                  <>
                    <p className="registration-managed-notice">
                      This is the one-time registration for the system’s only administrator.
                    </p>
                    <label htmlFor="admin_registration_code">Admin registration code</label>
                    <input
                      id="admin_registration_code"
                      type="password"
                      name="admin_registration_code"
                      value={formData.admin_registration_code}
                      onChange={handleChange}
                      autoComplete="off"
                      required
                    />
                  </>
                )}

                {statusError && (
                  <p className="auth-message" role="status">
                    Admin setup status is unavailable; job seeker and employer registration is still available.
                    <button
                      className="text-action"
                      type="button"
                      onClick={() => {
                        setRegistrationStatus(null)
                        setStatusError('')
                        setRetryCount((current) => current + 1)
                      }}
                    >
                      Retry admin setup check
                    </button>
                  </p>
                )}

                <button className="button button-primary" type="submit" disabled={loading}>
                  {loading ? 'Creating account…' : 'Create account'} <span aria-hidden="true">→</span>
                </button>
                {message && <p className="auth-message" role="alert">{message}</p>}
                {adminExists && (
                  <p className="registration-managed-notice">
                    Your account will be managed by the system administrator after registration.
                  </p>
                )}
                {registrationStatus && !adminExists && !setupAvailable && formData.role !== 'admin' && (
                  <p className="registration-managed-notice">
                    Job seeker and employer accounts can register now. Admin setup is not currently configured.
                  </p>
                )}
              </form>

              <p className="login-register-prompt">
                Already have an account? <Link to="/login">Login</Link>
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

export default Register

import { useEffect, useState } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import ProtectedRoute from './components/ProtectedRoute'
import RoleProtectedRoute from './components/RoleProtectedRoute'
import SiteHeader from './components/SiteHeader'
import SiteFooter from './components/SiteFooter'
import JobCard from './components/JobCard'
import SaveJobButton from './components/SaveJobButton'
import { apiRequest } from './api'
import { useAuth } from './context/useAuth'
import CreateJob from './pages/CreateJob'
import Dashboard from './pages/Dashboard'
import EmployerDashboard from './pages/EmployerDashboard'
import AdminDashboard from './pages/AdminDashboard'
import JobDetail from './pages/JobDetail'
import Login from './pages/Login'
import Register from './pages/Register'

function HomePage() {
  const { user, token } = useAuth()
  const [jobs, setJobs] = useState([])
  const [savedJobIds, setSavedJobIds] = useState(() => new Set())
  const [filters, setFilters] = useState({ q: '', location: '', company: '', salary: '' })
  const [draftFilters, setDraftFilters] = useState(filters)
  const [loadedFilters, setLoadedFilters] = useState(null)
  const [error, setError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const loading = loadedFilters === null || JSON.stringify(loadedFilters) !== JSON.stringify(filters)

  useEffect(() => {
    let active = true
    if (user?.role !== 'job_seeker' || !token) {
      setSavedJobIds(new Set())
      return () => {
        active = false
      }
    }

    apiRequest('/api/saved-jobs/', { token })
      .then((savedJobs) => {
        if (active) setSavedJobIds(new Set(savedJobs.map((job) => job.id)))
      })
      .catch((requestError) => {
        if (active) setActionError(requestError.message)
      })
    return () => {
      active = false
    }
  }, [token, user?.role])

  useEffect(() => {
    let active = true
    const params = new URLSearchParams({ limit: '100' })
    Object.entries(filters).forEach(([key, value]) => {
      if (value.trim()) params.set(key, value.trim())
    })
    apiRequest(`/api/jobs/?${params}`)
      .then((data) => {
        if (active) {
          setError('')
          setJobs(data)
          setLoadedFilters(filters)
        }
      })
      .catch((requestError) => {
        if (active) {
          setError(requestError.message)
          setLoadedFilters(filters)
        }
      })
    return () => {
      active = false
    }
  }, [filters])

  function updateSavedJob(jobId, isSaved) {
    setSavedJobIds((current) => {
      const updated = new Set(current)
      if (isSaved) updated.add(jobId)
      else updated.delete(jobId)
      return updated
    })
  }

  async function createSearchAlert() {
    if (user?.role !== 'job_seeker') return
    setActionMessage('')
    setActionError('')
    const activeFilters = Object.fromEntries(
      Object.entries(filters).map(([key, value]) => [key, value.trim() || null]),
    )
    const parts = [
      activeFilters.q && `“${activeFilters.q}”`,
      activeFilters.location && `in ${activeFilters.location}`,
      activeFilters.company && `at ${activeFilters.company}`,
      activeFilters.salary && `salary ${activeFilters.salary}`,
    ].filter(Boolean)

    try {
      await apiRequest('/api/search-alerts/', {
        method: 'POST',
        token,
        body: JSON.stringify({
          name: (parts.join(' ') || 'My job search').slice(0, 100),
          ...activeFilters,
        }),
      })
      setActionMessage('Job alert created. We’ll notify you in the app when a new matching role is posted.')
      window.dispatchEvent(new Event('jobconnect:search-alert-created'))
    } catch (requestError) {
      setActionError(requestError.message)
    }
  }

  return (
    <div className="app">
      <SiteHeader />
      <main>
        <section id="home" className="hero">
          <div className="hero-inner">
            <div className="hero-copy">
              <p className="hero-kicker"><span className="kicker-sparkle" aria-hidden="true">✦</span> A better way to find your next role</p>
              <h1>Work that moves<br /><span>you forward.</span></h1>
              <p className="description">
                Find opportunities that fit your ambitions. Connect with employers
                and keep every application in one clear place.
              </p>
              <div className="hero-actions">
                <a className="button button-primary" href="#jobs">
                  Explore open roles <span aria-hidden="true">→</span>
                </a>
                {!user && <Link className="button button-secondary hero-secondary" to="/register">Create a free account</Link>}
              </div>
              <div className="hero-note">
                <span className="hero-note-icon" aria-hidden="true">✓</span>
                <span>Thoughtful search. Clear next steps. No guesswork.</span>
              </div>
            </div>
            <div className="hero-art" aria-hidden="true">
              <div className="hero-orbit orbit-one" />
              <div className="hero-orbit orbit-two" />
              <div className="hero-preview">
                <div className="preview-topline">
                  <span className="preview-brand-mark">J</span>
                  <span className="preview-top-label">YOUR CAREER SPACE</span>
                  <span className="preview-menu-dots">•••</span>
                </div>
                <div className="preview-greeting">
                  <span className="preview-greeting-label">MONDAY, NEW POSSIBILITIES</span>
                  <strong>Make your next move.</strong>
                </div>
                <div className="preview-search">
                  <span className="preview-search-icon">⌕</span>
                  <span>What kind of role are you looking for?</span>
                  <span className="preview-search-button">→</span>
                </div>
                <div className="preview-card">
                  <div className="preview-company-icon">N</div>
                  <div className="preview-job-copy">
                    <strong>Your next opportunity</strong>
                    <span>Discover roles matched to your goals</span>
                  </div>
                  <span className="preview-arrow">↗</span>
                </div>
                <div className="preview-bottom">
                  <div className="preview-avatars">
                    <span className="avatar avatar-blue">J</span>
                    <span className="avatar avatar-gold">M</span>
                    <span className="avatar avatar-green">A</span>
                  </div>
                  <span>People and opportunities, connected.</span>
                </div>
              </div>
              <div className="floating-note note-top">
                <span className="floating-note-icon">✦</span>
                <span><strong>Find your fit</strong><small>Explore open roles</small></span>
              </div>
              <div className="floating-note note-bottom">
                <span className="floating-check">✓</span>
                <span><strong>Application sent</strong><small>Your next step starts here</small></span>
              </div>
            </div>
          </div>
          <a className="hero-scroll" href="#jobs"><span /> Scroll to explore</a>
        </section>

        <section id="jobs" className="jobs-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">THE RIGHT OPPORTUNITY IS OUT THERE</p>
              <h2>Explore open roles<span className="heading-period">.</span></h2>
              <p>Search with intention. Find work that feels like a fit.</p>
            </div>
            {user?.role === 'employer' && (
              <Link className="button button-primary" to="/employer/create-job">Post a job</Link>
            )}
          </div>
          <form
            className="job-filter-form"
            onSubmit={(event) => {
              event.preventDefault()
              setFilters(draftFilters)
            }}
          >
            <label>
              <span>Keywords</span>
              <input value={draftFilters.q} onChange={(event) => setDraftFilters({ ...draftFilters, q: event.target.value })} placeholder="Title or description" />
            </label>
            <label>
              <span>Location</span>
              <input value={draftFilters.location} onChange={(event) => setDraftFilters({ ...draftFilters, location: event.target.value })} placeholder="Any location" />
            </label>
            <label>
              <span>Company</span>
              <input value={draftFilters.company} onChange={(event) => setDraftFilters({ ...draftFilters, company: event.target.value })} placeholder="Any company" />
            </label>
            <label>
              <span>Salary</span>
              <input value={draftFilters.salary} onChange={(event) => setDraftFilters({ ...draftFilters, salary: event.target.value })} placeholder="e.g. $70,000" />
            </label>
            <button className="button button-primary" type="submit">Search jobs</button>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => {
                const emptyFilters = { q: '', location: '', company: '', salary: '' }
                setDraftFilters(emptyFilters)
                setFilters(emptyFilters)
              }}
            >Clear</button>
            {user?.role === 'job_seeker' && (
              <button
                className="button button-secondary"
                type="button"
                onClick={createSearchAlert}
                disabled={!Object.values(filters).some((value) => value.trim())}
              >
                Create job alert
              </button>
            )}
          </form>

          {actionMessage && <p className="state-message" role="status">{actionMessage}</p>}
          {actionError && <p className="state-message error-message" role="alert">{actionError}</p>}
          {loading && <p className="state-message">Loading open jobs…</p>}
          {error && <p className="state-message error-message">{error}</p>}
          {!loading && !error && jobs.length === 0 && (
            <p className="state-message">
              {Object.values(filters).some(Boolean) ? 'No jobs match those filters.' : 'No jobs available yet. Check back soon.'}
            </p>
          )}
          {!loading && !error && jobs.length > 0 && (
            <div className="jobs-grid">
              {jobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  action={user?.role === 'job_seeker' ? (
                    <SaveJobButton
                      jobId={job.id}
                      isSaved={savedJobIds.has(job.id)}
                      token={token}
                      onSavedChange={updateSavedJob}
                    />
                  ) : !user ? <Link className="button button-secondary" to="/login">Sign in to save</Link> : null}
                />
              ))}
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}

function DashboardRedirect() {
  const { user } = useAuth()
  const destination = user?.role === 'admin'
    ? '/admin'
    : user?.role === 'employer'
      ? '/employer'
      : '/job-seeker'
  return <Navigate to={destination} replace />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/jobs/:jobId" element={<JobDetail />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/employer"
          element={
            <RoleProtectedRoute allowedRoles={['employer']}>
              <EmployerDashboard />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <RoleProtectedRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/job-seeker"
          element={
            <RoleProtectedRoute allowedRoles={['job_seeker']}>
              <Dashboard />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardRedirect />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employer/create-job"
          element={
            <RoleProtectedRoute allowedRoles={['employer']}>
              <CreateJob />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/employer/jobs/:jobId/edit"
          element={
            <RoleProtectedRoute allowedRoles={['employer']}>
              <CreateJob />
            </RoleProtectedRoute>
          }
        />
        <Route path="*" element={<main className="page-shell"><h1>Page not found</h1><Link to="/">Return home</Link></main>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader'
import SiteFooter from '../components/SiteFooter'
import SaveJobButton from '../components/SaveJobButton'
import { apiRequest } from '../api'
import { useAuth } from '../context/useAuth'

function JobDetail() {
  const { jobId } = useParams()
  const { user, token } = useAuth()
  const navigate = useNavigate()
  const [job, setJob] = useState(null)
  const [application, setApplication] = useState(null)
  const [isSaved, setIsSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [resume, setResume] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    async function loadJob() {
      try {
        const jobData = await apiRequest(`/api/jobs/${jobId}`)
        if (!active) return
        setJob(jobData)
        if (user?.role === 'job_seeker' && token) {
          const [applications, savedJobs] = await Promise.all([
            apiRequest('/api/applications/me', { token }),
            apiRequest('/api/saved-jobs/', { token }),
          ])
          if (active) {
            setApplication(applications.find((item) => item.job_id === jobData.id) || null)
            setIsSaved(savedJobs.some((savedJob) => savedJob.id === jobData.id))
          }
        }
      } catch (requestError) {
        if (active) setError(requestError.message)
      } finally {
        if (active) setLoading(false)
      }
    }
    loadJob()
    return () => {
      active = false
    }
  }, [jobId, token, user?.role])

  async function apply() {
    if (!user) {
      navigate('/login')
      return
    }
    if (user.role !== 'job_seeker') {
      setMessage('Employer accounts cannot apply to job listings.')
      return
    }

    setSubmitting(true)
    setMessage('')
    try {
      const body = new FormData()
      if (resume) body.append('resume', resume)
      const created = await apiRequest(`/api/applications/jobs/${job.id}`, {
        method: 'POST',
        token,
        body,
      })
      setApplication(created)
      setMessage('Your application has been submitted.')
    } catch (requestError) {
      setMessage(requestError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="app">
      <SiteHeader />
      <main className="page-shell">
        <Link to="/" className="back-link">← Back to jobs</Link>
        {loading && <p className="state-message">Loading job…</p>}
        {error && <p className="state-message error-message">{error}</p>}
        {job && (
          <article className="detail-card">
            <p className="eyebrow">OPEN POSITION</p>
            <h1>{job.title}</h1>
            <p className="detail-company">{job.company}</p>
            <p className="job-meta">{job.location}{job.salary ? ` · ${job.salary}` : ''}</p>
            {user?.role === 'job_seeker' && token && (
              <SaveJobButton
                jobId={job.id}
                isSaved={isSaved}
                token={token}
                onSavedChange={(_jobId, nextSaved) => setIsSaved(nextSaved)}
              />
            )}
            <hr />
            <h2>About the role</h2>
            <p className="detail-description">{job.description}</p>
            {user?.role === 'job_seeker' ? (
              application ? (
                <p className="success-message">
                  You applied for this role. Current status: <strong>{application.status}</strong>.
                </p>
              ) : (
                <div className="apply-panel">
                  <label htmlFor="resume">Attach resume (optional, PDF or DOCX, max 5 MB)</label>
                  <input
                    id="resume"
                    type="file"
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(event) => setResume(event.target.files?.[0] || null)}
                  />
                  <button className="button button-primary" type="button" onClick={apply} disabled={submitting}>
                    {submitting ? 'Submitting…' : 'Apply for this job'}
                  </button>
                </div>
              )
            ) : !user ? (
              <Link className="button button-primary" to="/login">Log in to apply</Link>
            ) : (
              <p className="state-message">You’re signed in as an employer. Job seekers can apply to this role.</p>
            )}
            {message && <p className="auth-message" role="status">{message}</p>}
          </article>
        )}
      </main>
      <SiteFooter />
    </div>
  )
}

export default JobDetail

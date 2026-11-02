import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader'
import SiteFooter from '../components/SiteFooter'
import { apiRequest } from '../api'
import { useAuth } from '../context/useAuth'

const EMPTY_JOB = {
  title: '',
  company: '',
  location: '',
  description: '',
  salary: '',
}

function CreateJob() {
  const { token, user } = useAuth()
  const { jobId } = useParams()
  const navigate = useNavigate()
  const [formData, setFormData] = useState(() => ({
    ...EMPTY_JOB,
    company: user?.company_name || '',
  }))
  const [loading, setLoading] = useState(Boolean(jobId))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!jobId) return
    let active = true
    apiRequest(`/api/jobs/mine/${jobId}`, { token })
      .then((job) => {
        if (active) {
          setFormData({
            title: job.title,
            company: job.company,
            location: job.location,
            description: job.description,
            salary: job.salary || '',
          })
        }
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
  }, [jobId, token])

  function handleChange(event) {
    setFormData((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      await apiRequest(jobId ? `/api/jobs/${jobId}` : '/api/jobs/', {
        method: jobId ? 'PATCH' : 'POST',
        token,
        body: JSON.stringify({
          ...formData,
          salary: formData.salary.trim() || null,
        }),
      })
      navigate('/employer', { replace: true })
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="app">
      <SiteHeader />
      <main className="page-shell narrow-shell">
        <Link to="/employer" className="back-link">← Employer dashboard</Link>
        <p className="eyebrow">{jobId ? 'EDIT LISTING' : 'NEW OPPORTUNITY'}</p>
        <h1>{jobId ? 'Update your job listing' : 'Create a job listing'}</h1>
        <p className="page-intro">Share clear details so candidates know what to expect.</p>
        {loading ? <p className="state-message">Loading job details…</p> : (
          <form onSubmit={handleSubmit} className="auth-form form-card">
            <label htmlFor="title">Job title</label>
            <input id="title" name="title" value={formData.title} onChange={handleChange} minLength={2} maxLength={200} required />
            <label htmlFor="company">Company</label>
            <input id="company" name="company" value={formData.company} onChange={handleChange} minLength={2} maxLength={150} required />
            <label htmlFor="location">Location</label>
            <input id="location" name="location" value={formData.location} onChange={handleChange} minLength={2} maxLength={150} required />
            <label htmlFor="description">Description</label>
            <textarea id="description" name="description" value={formData.description} onChange={handleChange} minLength={10} rows={7} required />
            <label htmlFor="salary">Salary (optional)</label>
            <input id="salary" name="salary" value={formData.salary} onChange={handleChange} maxLength={100} placeholder="e.g. $70,000–$90,000 per year" />
            {error && <p className="error-message" role="alert">{error}</p>}
            <button className="button button-primary" type="submit" disabled={saving || loading}>
              {saving ? 'Saving…' : jobId ? 'Save changes' : 'Publish job'}
            </button>
          </form>
        )}
      </main>
      <SiteFooter />
    </div>
  )
}

export default CreateJob

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../api'
import { useAuth } from '../context/useAuth'

const PAGE_SIZE = 100

const SECTIONS = [
  ['overview', 'Overview', '⌂'],
  ['users', 'Users', '♙'],
  ['jobs', 'Job listings', '▤'],
  ['applications', 'Applications', '⇢'],
  ['settings', 'System status', '⚙'],
]

function AdminDashboard() {
  const { user, token, logout } = useAuth()
  const [section, setSection] = useState('overview')
  const [overview, setOverview] = useState(null)
  const [system, setSystem] = useState(null)
  const [users, setUsers] = useState([])
  const [jobs, setJobs] = useState([])
  const [applications, setApplications] = useState([])
  const [totals, setTotals] = useState({ users: 0, jobs: 0, applications: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [userEdits, setUserEdits] = useState({})
  const [currentYear] = useState(() => new Date().getFullYear())
  const [newUser, setNewUser] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'job_seeker',
    company_name: '',
  })

  useEffect(() => {
    let active = true
    async function loadAdminWorkspace() {
      setLoading(true)
      setError('')
      try {
        const [overviewData, systemData, userPage, jobPage, applicationPage] = await Promise.all([
          apiRequest('/api/admin/overview', { token }),
          apiRequest('/api/admin/system', { token }),
          apiRequest(`/api/admin/users?limit=${PAGE_SIZE}`, { token }),
          apiRequest(`/api/admin/jobs?limit=${PAGE_SIZE}`, { token }),
          apiRequest(`/api/admin/applications?limit=${PAGE_SIZE}`, { token }),
        ])
        if (active) {
          setOverview(overviewData)
          setSystem(systemData)
          setUsers(userPage.items)
          setJobs(jobPage.items)
          setApplications(applicationPage.items)
          setTotals({
            users: userPage.total,
            jobs: jobPage.total,
            applications: applicationPage.total,
          })
        }
      } catch (requestError) {
        if (active) setError(requestError.message)
      } finally {
        if (active) setLoading(false)
      }
    }

    loadAdminWorkspace()
    return () => {
      active = false
    }
  }, [token])

  const normalizedQuery = query.trim().toLowerCase()
  const visibleUsers = useMemo(() => users.filter((item) => [
    item.full_name,
    item.email,
    item.company_name,
    item.role,
    item.is_active ? 'active' : 'disabled',
  ].some((value) => value?.toLowerCase().includes(normalizedQuery))), [users, normalizedQuery])
  const visibleJobs = useMemo(() => jobs.filter((item) => [
    item.title,
    item.company,
    item.location,
    item.employer_name,
    item.status,
  ].some((value) => value?.toLowerCase().includes(normalizedQuery))), [jobs, normalizedQuery])
  const visibleApplications = useMemo(() => applications.filter((item) => [
    item.applicant_name,
    item.applicant_email,
    item.job_title,
    item.company,
    item.employer_name,
    item.status,
  ].some((value) => value?.toLowerCase().includes(normalizedQuery))), [applications, normalizedQuery])

  function showResult(text) {
    setError('')
    setMessage(text)
  }

  async function refreshOverview() {
    const data = await apiRequest('/api/admin/overview', { token })
    setOverview(data)
  }

  async function refreshWorkspaceLists() {
    const [overviewData, userPage, jobPage, applicationPage] = await Promise.all([
      apiRequest('/api/admin/overview', { token }),
      apiRequest(`/api/admin/users?limit=${PAGE_SIZE}`, { token }),
      apiRequest(`/api/admin/jobs?limit=${PAGE_SIZE}`, { token }),
      apiRequest(`/api/admin/applications?limit=${PAGE_SIZE}`, { token }),
    ])
    setOverview(overviewData)
    setUsers(userPage.items)
    setJobs(jobPage.items)
    setApplications(applicationPage.items)
    setTotals({
      users: userPage.total,
      jobs: jobPage.total,
      applications: applicationPage.total,
    })
  }

  async function loadMore(kind) {
    setError('')
    try {
      const currentItems = kind === 'users' ? users : kind === 'jobs' ? jobs : applications
      const data = await apiRequest(`/api/admin/${kind}?limit=${PAGE_SIZE}&offset=${currentItems.length}`, { token })
      if (kind === 'users') setUsers((current) => [...current, ...data.items])
      if (kind === 'jobs') setJobs((current) => [...current, ...data.items])
      if (kind === 'applications') setApplications((current) => [...current, ...data.items])
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function createUser(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const created = await apiRequest('/api/admin/users', {
        method: 'POST',
        token,
        body: JSON.stringify({
          ...newUser,
          company_name: newUser.role === 'employer' ? newUser.company_name.trim() : null,
        }),
      })
      setUsers((current) => [created, ...current])
      setTotals((current) => ({ ...current, users: current.users + 1 }))
      await refreshOverview()
      setNewUser({ full_name: '', email: '', password: '', role: 'job_seeker', company_name: '' })
      setShowCreateUser(false)
      showResult(`${created.full_name} was added as a ${created.role.replace('_', ' ')}.`)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  async function updateUser(userId, changes, successMessage) {
    setBusyId(userId)
    setError('')
    try {
      const updated = await apiRequest(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify(changes),
      })
      setUsers((current) => current.map((item) => item.id === updated.id ? updated : item))
      setUserEdits((current) => {
        const next = { ...current }
        delete next[userId]
        return next
      })
      await refreshOverview()
      showResult(successMessage)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusyId(null)
    }
  }

  async function deleteUser(target) {
    const confirmed = window.confirm(
      `Permanently delete ${target.full_name}? Their job listings, applications, messages, and interview history will also be deleted. This cannot be undone.`,
    )
    if (!confirmed) return
    setBusyId(target.id)
    setError('')
    try {
      await apiRequest(`/api/admin/users/${target.id}`, { method: 'DELETE', token })
      await refreshWorkspaceLists()
      showResult(`${target.full_name} and associated records were permanently deleted.`)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusyId(null)
    }
  }

  async function updateJob(job, nextStatus) {
    setBusyId(job.id)
    setError('')
    try {
      const updated = await apiRequest(`/api/admin/jobs/${job.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ status: nextStatus }),
      })
      setJobs((current) => current.map((item) => item.id === updated.id ? updated : item))
      await refreshOverview()
      showResult(`“${updated.title}” is now ${updated.status}.`)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusyId(null)
    }
  }

  async function deleteJob(job) {
    const confirmed = window.confirm(
      `Permanently delete “${job.title}” and its ${job.applications_count} application(s)? This cannot be undone.`,
    )
    if (!confirmed) return
    setBusyId(job.id)
    setError('')
    try {
      await apiRequest(`/api/admin/jobs/${job.id}`, { method: 'DELETE', token })
      setJobs((current) => current.filter((item) => item.id !== job.id))
      setApplications((current) => current.filter((item) => item.job_id !== job.id))
      setTotals((current) => ({
        ...current,
        jobs: Math.max(0, current.jobs - 1),
        applications: Math.max(0, current.applications - job.applications_count),
      }))
      await refreshOverview()
      showResult(`“${job.title}” and its applications were deleted.`)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusyId(null)
    }
  }

  const activeSection = SECTIONS.find(([id]) => id === section)

  return (
    <div className="employer-app-shell admin-app-shell">
      <aside className="employer-sidebar" aria-label="System administration">
        <Link className="employer-brand" to="/" aria-label="JobConnect home">
          <span className="employer-brand-mark" aria-hidden="true">J</span>
          <span>JobConnect<span className="employer-brand-dot">.</span></span>
        </Link>
        <div className="employer-company-switcher">
          <span className="company-avatar admin-avatar" aria-hidden="true">A</span>
          <span><strong>System administration</strong><small>Platform controls</small></span>
          <span className="switcher-chevron" aria-hidden="true">⌄</span>
        </div>
        <nav className="employer-navigation" aria-label="Admin sections">
          <p>ADMINISTRATION</p>
          {SECTIONS.map(([id, label, icon]) => (
            <button
              type="button"
              key={id}
              className={`employer-nav-link${section === id ? ' active' : ''}`}
              onClick={() => { setSection(id); setQuery(''); setMessage(''); setError('') }}
            >
              <span aria-hidden="true">{icon}</span>{label}
              {id === 'users' && <span className="nav-count">{totals.users}</span>}
              {id === 'jobs' && <span className="nav-count">{totals.jobs}</span>}
              {id === 'applications' && <span className="nav-count">{totals.applications}</span>}
            </button>
          ))}
          <p className="navigation-spacer">WORKSPACE</p>
          <Link className="employer-nav-link" to="/"><span aria-hidden="true">⌕</span>Browse site</Link>
        </nav>
        <div className="sidebar-account">
          <span className="account-avatar admin-avatar" aria-hidden="true">{user?.full_name?.charAt(0)?.toUpperCase() || 'A'}</span>
          <span><strong>{user?.full_name}</strong><small>Administrator</small></span>
          <button className="account-logout" type="button" onClick={logout}><span aria-hidden="true">↗</span>Log out</button>
        </div>
      </aside>

      <div className="employer-workspace">
        <header className="employer-topbar">
          <div className="topbar-page-title"><span>Administration</span><span aria-hidden="true">/</span><strong>{activeSection?.[1]}</strong></div>
          <label className="dashboard-search">
            <span aria-hidden="true">⌕</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${section === 'overview' || section === 'settings' ? 'workspace' : section}...`} aria-label={`Search ${section}`} />
          </label>
          <div className="topbar-account">
            <span className="topbar-avatar admin-avatar" aria-hidden="true">{user?.full_name?.charAt(0)?.toUpperCase() || 'A'}</span>
            <span className="topbar-user">{user?.full_name?.split(' ')[0]}</span>
            <button type="button" className="topbar-menu-button" onClick={logout}><span aria-hidden="true">↗</span> Log out</button>
          </div>
        </header>

        <main className="employer-main admin-main">
          <div className="dashboard-heading">
            <div>
              <p className="dashboard-date">PLATFORM CONTROL CENTER</p>
              <h1>{activeSection?.[1]}</h1>
              <p className="dashboard-subtitle">Manage the JobConnect platform and its users.</p>
            </div>
            {section === 'users' && (
              <button className="button button-primary" type="button" onClick={() => setShowCreateUser((current) => !current)}>
                <span aria-hidden="true">{showCreateUser ? '−' : '＋'}</span> {showCreateUser ? 'Cancel' : 'Add user'}
              </button>
            )}
          </div>

          {error && <p className="state-message error-message dashboard-error" role="alert">{error}</p>}
          {message && <p className="admin-success-message" role="status">{message}</p>}
          {loading && <p className="state-message">Loading administration data…</p>}

          {!loading && section === 'overview' && overview && (
            <>
              <section className="recruiter-stats-grid admin-stats-grid" aria-label="Platform overview">
                <article className="recruiter-stat-card"><span className="recruiter-stat-icon violet" aria-hidden="true">♙</span><span className="recruiter-stat-label">Total users</span><strong>{overview.total_users}</strong><small>{overview.active_users} active accounts</small></article>
                <article className="recruiter-stat-card"><span className="recruiter-stat-icon blue" aria-hidden="true">▤</span><span className="recruiter-stat-label">Job listings</span><strong>{overview.total_jobs}</strong><small>{overview.open_jobs} currently open</small></article>
                <article className="recruiter-stat-card"><span className="recruiter-stat-icon green" aria-hidden="true">⇢</span><span className="recruiter-stat-label">Applications</span><strong>{overview.total_applications}</strong><small>{overview.pending_applications} awaiting review</small></article>
                <article className="recruiter-stat-card"><span className="recruiter-stat-icon amber" aria-hidden="true">⚙</span><span className="recruiter-stat-label">API status</span><strong className="admin-health-value">{system?.api_status || 'unknown'}</strong><small>Database {system?.database_status || 'unknown'}</small></article>
              </section>
              <div className="recruiter-overview-grid admin-overview-grid">
                <section className="recruiter-panel">
                  <div className="recruiter-panel-heading"><div><span className="panel-icon" aria-hidden="true">♙</span><div><h2>Accounts</h2><p>Accounts by role</p></div></div><button className="text-action" type="button" onClick={() => setSection('users')}>Manage users →</button></div>
                  <div className="admin-role-breakdown">
                    <div><span>Job seekers</span><strong>{overview.job_seekers}</strong></div>
                    <div><span>Employers</span><strong>{overview.employers}</strong></div>
                    <div><span>Administrators</span><strong>{overview.admins}</strong></div>
                  </div>
                </section>
                <section className="recruiter-panel">
                  <div className="recruiter-panel-heading"><div><span className="panel-icon blue-panel-icon" aria-hidden="true">▤</span><div><h2>Platform controls</h2><p>Review listings and application activity</p></div></div></div>
                  <div className="admin-quick-links">
                    <button type="button" onClick={() => setSection('jobs')}>Review job listings <span>{overview.total_jobs} →</span></button>
                    <button type="button" onClick={() => setSection('applications')}>Review applications <span>{overview.total_applications} →</span></button>
                    <button type="button" onClick={() => setSection('settings')}>System status <span>{system?.database_status || 'View'} →</span></button>
                  </div>
                </section>
              </div>
            </>
          )}

          {!loading && section === 'users' && (
            <section className="recruiter-panel admin-data-panel">
              <div className="recruiter-panel-heading">
                <div><span className="panel-icon" aria-hidden="true">♙</span><div><h2>User accounts</h2><p>Create accounts, change roles, disable access, or remove users</p></div></div>
                <span className="panel-total">{totals.users} total</span>
              </div>
              {showCreateUser && (
                <form className="admin-create-user" onSubmit={createUser}>
                  <div className="admin-form-heading"><div><strong>Create an account</strong><span>Accounts created here cannot receive administrator access.</span></div></div>
                  <div className="admin-form-grid">
                    <label>Full name<input value={newUser.full_name} onChange={(event) => setNewUser({ ...newUser, full_name: event.target.value })} minLength={2} maxLength={150} required /></label>
                    <label>Email<input type="email" value={newUser.email} onChange={(event) => setNewUser({ ...newUser, email: event.target.value })} required /></label>
                    <label>Initial password<input type="password" value={newUser.password} onChange={(event) => setNewUser({ ...newUser, password: event.target.value })} minLength={8} maxLength={128} autoComplete="new-password" required /></label>
                    <label>Account type<select value={newUser.role} onChange={(event) => setNewUser({ ...newUser, role: event.target.value, company_name: '' })}><option value="job_seeker">Job seeker</option><option value="employer">Employer</option></select></label>
                    {newUser.role === 'employer' && <label>Company name<input value={newUser.company_name} onChange={(event) => setNewUser({ ...newUser, company_name: event.target.value })} minLength={2} maxLength={150} required /></label>}
                  </div>
                  <div className="admin-form-actions"><p>Share the initial password with the user through a secure channel.</p><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create account'}</button></div>
                </form>
              )}
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>User</th><th>Role</th><th>Company</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
                  <tbody>
                    {visibleUsers.map((item) => {
                      const draft = userEdits[item.id] || { role: item.role, company_name: item.company_name || '' }
                      const isSelf = item.id === user?.id
                      const isEditing = !isSelf && item.role !== 'admin' && (
                        draft.role !== item.role || (draft.role === 'employer' && draft.company_name !== (item.company_name || ''))
                      )
                      return (
                        <tr key={item.id}>
                          <td><strong>{item.full_name}</strong><small>{item.email}</small></td>
                          <td>
                            {item.role === 'admin' ? <span className="admin-role-label">Admin</span> : (
                              <select
                                aria-label={`Role for ${item.full_name}`}
                                value={draft.role}
                                disabled={isSelf || busyId === item.id}
                                onChange={(event) => setUserEdits((current) => ({ ...current, [item.id]: { ...draft, role: event.target.value } }))}
                              >
                                <option value="job_seeker">Job seeker</option><option value="employer">Employer</option>
                              </select>
                            )}
                          </td>
                          <td>
                            {draft.role === 'employer' && item.role !== 'admin' ? (
                              <input
                                className="admin-company-input"
                                aria-label={`Company for ${item.full_name}`}
                                value={draft.company_name}
                                disabled={isSelf || busyId === item.id}
                                placeholder="Company name"
                                onChange={(event) => setUserEdits((current) => ({ ...current, [item.id]: { ...draft, company_name: event.target.value } }))}
                              />
                            ) : item.company_name || '—'}
                          </td>
                          <td><span className={`admin-account-status${item.is_active ? ' is-active' : ''}`}>{item.is_active ? 'Active' : 'Disabled'}</span></td>
                          <td>{new Date(item.created_at).toLocaleDateString()}</td>
                          <td>
                            <div className="admin-row-actions">
                              {isEditing && <button className="admin-inline-action" type="button" disabled={busyId === item.id} onClick={() => updateUser(item.id, { role: draft.role, ...(draft.role === 'employer' ? { company_name: draft.company_name.trim() } : {}) }, `${item.full_name} account updated.`)}>Save role</button>}
                              {!isSelf && <button className="admin-inline-action" type="button" disabled={busyId === item.id} onClick={() => updateUser(item.id, { is_active: !item.is_active }, `${item.full_name} account ${item.is_active ? 'disabled' : 'enabled'}.`)}>{item.is_active ? 'Disable' : 'Enable'}</button>}
                              {!isSelf && <button className="admin-inline-action danger" type="button" disabled={busyId === item.id} onClick={() => deleteUser(item)}>Delete</button>}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {!visibleUsers.length && <p className="admin-empty">No users match your search.</p>}
              </div>
              {users.length < totals.users && <button className="button button-secondary admin-load-more" type="button" onClick={() => loadMore('users')}>Load more users</button>}
            </section>
          )}

          {!loading && section === 'jobs' && (
            <section className="recruiter-panel admin-data-panel">
              <div className="recruiter-panel-heading"><div><span className="panel-icon blue-panel-icon" aria-hidden="true">▤</span><div><h2>Job listings</h2><p>Review or moderate listings across the platform</p></div></div><span className="panel-total">{totals.jobs} total</span></div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>Listing</th><th>Employer</th><th>Applications</th><th>Status</th><th>Posted</th><th>Actions</th></tr></thead>
                  <tbody>
                    {visibleJobs.map((job) => (
                      <tr key={job.id}>
                        <td><strong>{job.title}</strong><small>{job.company} · {job.location}</small></td>
                        <td>{job.employer_name}</td>
                        <td>{job.applications_count}</td>
                        <td><span className={`status-badge status-${job.status}`}>{job.status}</span></td>
                        <td>{new Date(job.created_at).toLocaleDateString()}</td>
                        <td><div className="admin-row-actions">
                          <button className="admin-inline-action" type="button" disabled={busyId === job.id} onClick={() => updateJob(job, job.status === 'open' ? 'closed' : 'open')}>{job.status === 'open' ? 'Close' : 'Reopen'}</button>
                          <button className="admin-inline-action danger" type="button" disabled={busyId === job.id} onClick={() => deleteJob(job)}>Delete</button>
                        </div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!visibleJobs.length && <p className="admin-empty">No job listings match your search.</p>}
              </div>
              {jobs.length < totals.jobs && <button className="button button-secondary admin-load-more" type="button" onClick={() => loadMore('jobs')}>Load more jobs</button>}
            </section>
          )}

          {!loading && section === 'applications' && (
            <section className="recruiter-panel admin-data-panel">
              <div className="recruiter-panel-heading"><div><span className="panel-icon green-panel-icon" aria-hidden="true">⇢</span><div><h2>Applications</h2><p>Read-only view of application activity across the platform</p></div></div><span className="panel-total">{totals.applications} total</span></div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>Candidate</th><th>Position</th><th>Employer</th><th>Status</th><th>Applied</th></tr></thead>
                  <tbody>
                    {visibleApplications.map((application) => (
                      <tr key={application.id}>
                        <td><strong>{application.applicant_name}</strong><small>{application.applicant_email}</small></td>
                        <td><strong>{application.job_title}</strong><small>{application.company} · {application.location}</small></td>
                        <td>{application.employer_name}</td>
                        <td><span className={`status-badge status-${application.status}`}>{application.status}</span></td>
                        <td>{new Date(application.applied_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!visibleApplications.length && <p className="admin-empty">No applications match your search.</p>}
              </div>
              {applications.length < totals.applications && <button className="button button-secondary admin-load-more" type="button" onClick={() => loadMore('applications')}>Load more applications</button>}
            </section>
          )}

          {!loading && section === 'settings' && system && (
            <section className="recruiter-panel admin-data-panel">
              <div className="recruiter-panel-heading"><div><span className="panel-icon green-panel-icon" aria-hidden="true">⚙</span><div><h2>System status</h2><p>Read-only service health and configuration guidance</p></div></div></div>
              <div className="admin-system-grid">
                <article><span>API service</span><strong className="admin-health-value">{system.api_status}</strong><small>{system.api_name} · v{system.api_version}</small></article>
                <article><span>Database</span><strong className="admin-health-value">{system.database_status}</strong><small>Database connectivity check</small></article>
                <article><span>Configuration</span><strong>Environment managed</strong><small>{system.configuration_source}</small></article>
              </div>
              <div className="admin-settings-note">
                <strong>Deployment configuration</strong>
                <p>Secrets and infrastructure settings are intentionally not editable or displayed in this dashboard. Configure <code>DATABASE_URL</code>, <code>SECRET_KEY</code>, and <code>CORS_ORIGINS</code> in the backend deployment environment, then restart the API.</p>
              </div>
            </section>
          )}
          <footer className="employer-footer">© {currentYear} JobConnect · System administration</footer>
        </main>
      </div>
    </div>
  )
}

export default AdminDashboard

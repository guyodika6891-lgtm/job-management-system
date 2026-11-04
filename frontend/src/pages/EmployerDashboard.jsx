import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import NotificationCenter from '../components/NotificationCenter'
import ApplicationConversation from '../components/ApplicationConversation'
import InterviewPanel from '../components/InterviewPanel'
import { apiRequest, downloadFile } from '../api'
import { useAuth } from '../context/useAuth'

function getApplicationTrend(applications, range, now) {
  const slots = range === 'today'
    ? Array.from({ length: 8 }, (_, index) => ({
      key: String(index),
      label: `${(index * 3) % 12 || 12}${index < 4 ? 'a' : 'p'}`,
      date: null,
    }))
    : range === 'week'
      ? Array.from({ length: 7 }, (_, index) => {
        const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6 + index)
        return {
          key: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
          label: date.toLocaleDateString(undefined, { weekday: 'short' }),
          date,
        }
      })
      : Array.from({ length: 12 }, (_, index) => {
        const date = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1)
        return {
          key: `${date.getFullYear()}-${date.getMonth()}`,
          label: date.toLocaleDateString(undefined, { month: 'short' }),
          date,
        }
      })

  return slots.map((slot, index) => {
    const matchesSlot = (application) => {
      const appliedAt = new Date(application.applied_at)
      if (Number.isNaN(appliedAt.getTime())) return false
      if (range === 'today') {
        return appliedAt.getFullYear() === now.getFullYear()
          && appliedAt.getMonth() === now.getMonth()
          && appliedAt.getDate() === now.getDate()
          && Math.floor(appliedAt.getHours() / 3) === index
      }
      if (range === 'week') {
        return appliedAt.getFullYear() === slot.date.getFullYear()
          && appliedAt.getMonth() === slot.date.getMonth()
          && appliedAt.getDate() === slot.date.getDate()
      }
      return appliedAt.getFullYear() === slot.date.getFullYear()
        && appliedAt.getMonth() === slot.date.getMonth()
    }
    const matchingApplications = applications.filter(matchesSlot)
    return {
      ...slot,
      applications: matchingApplications.length,
      shortlisted: matchingApplications.filter((application) => application.status === 'accepted').length,
    }
  })
}

function EmployerDashboard() {
  const { user, token, logout } = useAuth()
  const [jobs, setJobs] = useState([])
  const [applications, setApplications] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [interviews, setInterviews] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [applicationFilter, setApplicationFilter] = useState('all')
  const [trendRange, setTrendRange] = useState('month')
  const [activeSection, setActiveSection] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [interviewsLoading, setInterviewsLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState(null)
  const [dashboardDate] = useState(() => new Date())
  const [newTodo, setNewTodo] = useState('')
  const [todos, setTodos] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(`jobconnect-employer-todos-${user?.id}`) || '[]')
      return Array.isArray(saved) ? saved : []
    } catch {
      return []
    }
  })
  const candidateSearchRef = useRef(null)

  useEffect(() => {
    localStorage.setItem(`jobconnect-employer-todos-${user?.id}`, JSON.stringify(todos))
  }, [todos, user?.id])

  useEffect(() => {
    let active = true
    Promise.all([
      apiRequest('/api/jobs/mine', { token }),
      apiRequest('/api/applications/received', { token }),
      apiRequest('/api/jobs/analytics', { token }),
      apiRequest('/api/interviews/me', { token }),
    ])
      .then(([jobData, applicationData, analyticsData, interviewData]) => {
        if (active) {
          setJobs(jobData)
          setApplications(applicationData)
          setAnalytics(analyticsData)
          setInterviews(interviewData)
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.message)
      })
      .finally(() => {
        if (active) {
          setLoading(false)
          setInterviewsLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [token])

  useEffect(() => {
    function focusCandidateSearch(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        candidateSearchRef.current?.focus()
      }
    }

    window.addEventListener('keydown', focusCandidateSearch)
    return () => window.removeEventListener('keydown', focusCandidateSearch)
  }, [])

  async function refreshInterviews() {
    try {
      const data = await apiRequest('/api/interviews/me', { token })
      setInterviews(data)
      setError('')
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function changeApplicationStatus(applicationId, status) {
    setUpdatingId(applicationId)
    try {
      const updated = await apiRequest(`/api/applications/${applicationId}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ status }),
      })
      setError('')
      setApplications((current) => current.map((item) => item.id === updated.id ? updated : item))
      const analyticsData = await apiRequest('/api/jobs/analytics', { token })
      setAnalytics(analyticsData)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setUpdatingId(null)
    }
  }

  async function toggleJob(job) {
    try {
      const updated = await apiRequest(`/api/jobs/${job.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ status: job.status === 'open' ? 'closed' : 'open' }),
      })
      setError('')
      setJobs((current) => current.map((item) => item.id === updated.id ? updated : item))
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const openJobs = jobs.filter((job) => job.status === 'open').length
  const pendingApplications = applications.filter((application) => application.status === 'pending').length
  const acceptedApplications = applications.filter((application) => application.status === 'accepted').length
  const shortlistedCount = applications.filter((application) => application.status === 'accepted').length
  const maxApplications = Math.max(...(analytics?.jobs || []).map((job) => job.applications), 1)
  const applicationTrend = getApplicationTrend(applications, trendRange, dashboardDate)
  const maxTrendCount = Math.max(...applicationTrend.map((slot) => slot.applications), 1)
  const sourceSummary = [
    { source: 'job_board', label: 'Job Boards', value: applications.filter((item) => item.source === 'job_board').length, color: '#5d63e6' },
    { source: 'social_media', label: 'Social Media', value: applications.filter((item) => item.source === 'social_media').length, color: '#8a7ef8' },
    { source: 'referral', label: 'Referrals', value: applications.filter((item) => item.source === 'referral').length, color: '#f4b46a' },
    { source: 'other', label: 'Other', value: applications.filter((item) => !['job_board', 'social_media', 'referral'].includes(item.source)).length, color: '#d6d9e6' },
  ]
  const totalSources = applications.length || 1
  const statusSummary = [
    { label: 'Open', value: openJobs, color: '#5d63e6' },
    { label: 'Closed', value: Math.max(0, jobs.length - openJobs), color: '#f1b35c' },
  ]
  const statusTotal = statusSummary.reduce((total, entry) => total + entry.value, 0) || 1
  const visibleApplications = applications.filter((application) => {
    const matchesStatus = applicationFilter === 'all' || application.status === applicationFilter
    const query = searchQuery.trim().toLowerCase()
    const matchesSearch = !query || [
      application.applicant.full_name,
      application.applicant.email,
      application.job.title,
    ].some((value) => value?.toLowerCase().includes(query))
    return matchesStatus && matchesSearch
  })
  const upcomingInterviews = interviews.slice(0, 4)
  const companyName = user?.company_name || 'Company workspace'

  function addTodo(event) {
    event.preventDefault()
    const text = newTodo.trim()
    if (!text) return
    setTodos((current) => [
      { id: `${Date.now()}-${Math.random()}`, text, completed: false },
      ...current,
    ])
    setNewTodo('')
  }

  return (
    <div className="employer-app-shell">
      <aside className="employer-sidebar" aria-label="Employer workspace">
        <Link className="employer-brand" to="/" aria-label="ProWork home">
          <span className="employer-brand-mark" aria-hidden="true">P</span>
          <span>ProWork<span className="employer-brand-dot">.</span></span>
        </Link>
        <div className="employer-company-switcher">
          <span className="company-avatar" aria-hidden="true">{companyName.charAt(0).toUpperCase()}</span>
          <span><strong>{companyName}</strong><small>Hiring workspace</small></span>
          <span className="switcher-chevron" aria-hidden="true">⌄</span>
        </div>
        <nav className="employer-navigation" aria-label="Workspace sections">
          <p>WORKSPACE</p>
          <a className={`employer-nav-link${activeSection === 'overview' ? ' active' : ''}`} href="#overview" onClick={() => setActiveSection('overview')}><span aria-hidden="true">⌂</span>Dashboard</a>
          <a className={`employer-nav-link${activeSection === 'jobs' ? ' active' : ''}`} href="#jobs" onClick={() => setActiveSection('jobs')}><span aria-hidden="true">▤</span>Jobs<span className="nav-count">{jobs.length}</span></a>
          <a className={`employer-nav-link${activeSection === 'candidates' ? ' active' : ''}`} href="#candidates" onClick={() => setActiveSection('candidates')}><span aria-hidden="true">♙</span>Candidates<span className="nav-count">{applications.length}</span></a>
          <a className={`employer-nav-link${activeSection === 'pipeline' ? ' active' : ''}`} href="#pipeline" onClick={() => setActiveSection('pipeline')}><span aria-hidden="true">⇢</span>Pipeline</a>
          <a className={`employer-nav-link${activeSection === 'analytics' ? ' active' : ''}`} href="#analytics" onClick={() => setActiveSection('analytics')}><span aria-hidden="true">▥</span>Analytics</a>
          <a className={`employer-nav-link${activeSection === 'interviews' ? ' active' : ''}`} href="#interviews" onClick={() => setActiveSection('interviews')}><span aria-hidden="true">▣</span>Interviews</a>
          <a className={`employer-nav-link${activeSection === 'todos' ? ' active' : ''}`} href="#todos" onClick={() => setActiveSection('todos')}><span aria-hidden="true">☑</span>To do<span className="nav-count">{todos.filter((todo) => !todo.completed).length}</span></a>
          <p className="navigation-spacer">ACCOUNT</p>
          <a className={`employer-nav-link${activeSection === 'notifications' ? ' active' : ''}`} href="#notifications" onClick={() => setActiveSection('notifications')}><span aria-hidden="true">♧</span>Notifications</a>
          <Link className="employer-nav-link" to="/"><span aria-hidden="true">⌕</span>Browse jobs</Link>
        </nav>
        <div className="sidebar-account">
          <span className="account-avatar" aria-hidden="true">{user?.full_name?.charAt(0)?.toUpperCase() || 'U'}</span>
          <span><strong>{user?.full_name}</strong><small>Employer</small></span>
          <button className="account-logout" type="button" onClick={logout}><span aria-hidden="true">↗</span>Log out</button>
        </div>
      </aside>

      <div className="employer-workspace">
        <header className="employer-topbar">
          <div className="topbar-page-title"><span>Workspace</span><span aria-hidden="true">/</span><strong>Dashboard</strong></div>
          <label className="dashboard-search">
            <span aria-hidden="true">⌕</span>
            <input
              ref={candidateSearchRef}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search candidates..."
              aria-label="Search candidates by name, email, or job title"
            />
            <kbd>⌘ K</kbd>
          </label>
          <div className="topbar-account">
            <a className="topbar-icon-button" href="#notifications" aria-label="View notifications">♧</a>
            <span className="topbar-divider" aria-hidden="true" />
            <span className="topbar-avatar" aria-hidden="true">{user?.full_name?.charAt(0)?.toUpperCase() || 'U'}</span>
            <span className="topbar-user">{user?.full_name?.split(' ')[0]}</span>
            <button type="button" className="topbar-menu-button" onClick={logout}><span aria-hidden="true">↗</span> Log out</button>
          </div>
        </header>

        <main className="employer-main" id="overview">
          <div className="dashboard-heading">
            <div>
              <p className="dashboard-date">{dashboardDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
              <h1>Dashboard</h1>
              <p className="dashboard-subtitle">Here’s what’s happening with your hiring today.</p>
            </div>
            <Link className="button button-primary" to="/employer/create-job"><span aria-hidden="true">＋</span> Post a new role</Link>
          </div>

          {error && <p className="state-message error-message dashboard-error" role="alert">{error}</p>}
          {loading && <p className="state-message">Loading your workspace…</p>}

          {!loading && (
            <>
              <section className="recruiter-stats-grid" aria-label="Hiring overview">
                <article className="recruiter-stat-card">
                  <span className="recruiter-stat-icon violet" aria-hidden="true">▤</span>
                  <span className="recruiter-stat-label">Total Applicants</span>
                  <strong>{applications.length}</strong>
                  <small>{pendingApplications} awaiting review</small>
                </article>
                <article className="recruiter-stat-card">
                  <span className="recruiter-stat-icon blue" aria-hidden="true">♙</span>
                  <span className="recruiter-stat-label">Scheduled Interviews</span>
                  <strong>{interviews.length}</strong>
                  <small>Proposed and accepted</small>
                </article>
                <article className="recruiter-stat-card">
                  <span className="recruiter-stat-icon green" aria-hidden="true">✓</span>
                  <span className="recruiter-stat-label">Accepted Candidates</span>
                  <strong>{shortlistedCount}</strong>
                  <small>{acceptedApplications} accepted</small>
                </article>
                <article className="recruiter-stat-card">
                  <span className="recruiter-stat-icon amber" aria-hidden="true">▣</span>
                  <span className="recruiter-stat-label">Open Jobs</span>
                  <strong>{openJobs}</strong>
                  <small>{jobs.length} active listings</small>
                </article>
              </section>

              <div className="recruiter-overview-grid">
                <section className="recruiter-panel analytics-panel" id="analytics">
                  <div className="recruiter-panel-heading">
                    <div><span className="panel-icon" aria-hidden="true">▥</span><div><h2>Applications Overview</h2><p>Applicants across your job listings</p></div></div>
                    <div className="analytics-actions">
                      <div className="trend-period-tabs" aria-label="Application chart period">
                        {[
                          ['today', 'Today'],
                          ['week', 'Week'],
                          ['month', 'Month'],
                        ].map(([range, label]) => (
                          <button
                            type="button"
                            key={range}
                            className={trendRange === range ? 'active' : ''}
                            aria-pressed={trendRange === range}
                            onClick={() => setTrendRange(range)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <a className="text-action" href="#jobs">View jobs <span aria-hidden="true">→</span></a>
                    </div>
                  </div>
                  {applications.length > 0 && (
                    <>
                      <div className="application-trend-chart" role="list" aria-label={`Applications and accepted candidates by ${trendRange}`}>
                        {applicationTrend.map((slot) => (
                          <div className="trend-slot" role="listitem" key={slot.key}>
                            <div className="trend-bars" aria-hidden="true">
                              <span className="trend-bar applications-bar" style={{ height: `${Math.max((slot.applications / maxTrendCount) * 100, slot.applications ? 3 : 0)}%` }} />
                              <span className="trend-bar shortlisted-bar" style={{ height: `${Math.max((slot.shortlisted / maxTrendCount) * 100, slot.shortlisted ? 3 : 0)}%` }} />
                            </div>
                            <span>{slot.label}</span>
                          </div>
                        ))}
                      </div>
                      <div className="chart-legend">
                        <span><i className="legend-pending" /> Applications</span>
                        <span><i className="legend-accepted" /> Accepted</span>
                      </div>
                    </>
                  )}
                  {applications.length === 0 && (
                    <p className="panel-empty">Application activity will appear here when candidates apply.</p>
                  )}
                  {analytics?.jobs.length > 0 && <p className="chart-subheading">Applications by job listing</p>}
                  {analytics?.jobs.length ? (
                    <>
                      <div className="application-chart" role="list" aria-label="Application counts by job listing">
                        {analytics.jobs.map((item) => (
                          <div className="chart-row" role="listitem" key={item.job_id}>
                            <span className="chart-job-title" title={item.title}>{item.title}</span>
                            <div
                              className="chart-track"
                              role="img"
                              aria-label={`${item.title}: ${item.applications} total, ${item.pending} pending, ${item.accepted} accepted, ${item.rejected} declined`}
                            >
                              <span className="chart-bar" style={{ width: `${Math.max((item.applications / maxApplications) * 100, item.applications ? 2 : 0)}%` }}>
                                <span className="chart-bar-pending" style={{ width: `${item.applications ? (item.pending / item.applications) * 100 : 0}%` }} />
                                <span className="chart-bar-accepted" style={{ width: `${item.applications ? (item.accepted / item.applications) * 100 : 0}%` }} />
                                <span className="chart-bar-rejected" style={{ width: `${item.applications ? (item.rejected / item.applications) * 100 : 0}%` }} />
                              </span>
                            </div>
                            <strong className="chart-count">{item.applications}</strong>
                          </div>
                        ))}
                      </div>
                      <div className="chart-legend">
                        <span><i className="legend-pending" /> Pending</span>
                        <span><i className="legend-accepted" /> Accepted</span>
                        <span><i className="legend-rejected" /> Declined</span>
                      </div>
                    </>
                  ) : <p className="panel-empty">Application activity will appear here when candidates apply.</p>}
                </section>

                <div className="recruiter-side-stack">
                  <section className="recruiter-panel source-panel" aria-label="Application sources">
                    <div className="recruiter-panel-heading">
                      <div><span className="panel-icon blue-panel-icon" aria-hidden="true">▣</span><div><h2>Application received by source</h2><p>Traffic mix across channels</p></div></div>
                    </div>
                    <div className="source-breakdown" role="list">
                      {sourceSummary.map((source) => (
                        <div className="source-row" key={source.label} role="listitem">
                          <div className="source-label-row">
                            <span>{source.label}</span>
                            <strong>{source.value}</strong>
                          </div>
                          <div className="source-track">
                            <span style={{ width: `${(source.value / totalSources) * 100}%`, background: source.color }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    {!applications.length && (
                      <p className="source-empty">Source data will appear as candidates apply.</p>
                    )}
                  </section>

                  <section className="recruiter-panel status-panel" aria-label="Job status overview">
                    <div className="recruiter-panel-heading">
                      <div><span className="panel-icon green-panel-icon" aria-hidden="true">◔</span><div><h2>Job Status</h2><p>Current listing mix</p></div></div>
                    </div>
                    <div className="status-ring-wrap">
                      <div
                        className="status-ring"
                        style={{
                          background: `conic-gradient(${statusSummary.map((entry) => `${entry.color} ${((entry.value / statusTotal) * 100).toFixed(2)}%`).join(', ')})`,
                        }}
                        aria-label={`Open jobs ${openJobs}, closed jobs ${Math.max(0, jobs.length - openJobs)}`}
                      >
                        <div className="status-ring-inner">
                          <strong>{jobs.length}</strong>
                          <span>Total Jobs</span>
                        </div>
                      </div>
                      <div className="status-legend">
                        {statusSummary.map((entry) => (
                          <span key={entry.label}><i style={{ background: entry.color }} /> {entry.label}</span>
                        ))}
                      </div>
                    </div>
                  </section>

                  <section className="recruiter-panel interview-panel" id="interviews">
                    <div className="recruiter-panel-heading">
                      <div><span className="panel-icon blue-panel-icon" aria-hidden="true">▣</span><div><h2>Upcoming interviews</h2><p>Your next candidate meetings</p></div></div>
                      <a className="panel-more" href="#candidates" aria-label="View interview candidates">···</a>
                    </div>
                    {interviewsLoading ? <p className="panel-empty">Loading interviews…</p> : upcomingInterviews.length ? (
                      <div className="upcoming-interview-list">
                        {upcomingInterviews.map((interview) => {
                          const application = applications.find((item) => item.id === interview.application_id)
                          return (
                            <article className="upcoming-interview-item" key={interview.id}>
                              <span className="interview-time">{new Date(interview.scheduled_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                              <div>
                                <strong>{application?.job.title || 'Interview'}</strong>
                                <span>{application?.applicant.full_name || 'Candidate'}</span>
                              </div>
                              <span className={`interview-status status-${interview.status}`}>{interview.status}</span>
                            </article>
                          )
                        })}
                      </div>
                    ) : <p className="panel-empty">No upcoming interviews. Interview invitations will show here.</p>}
                    <a className="panel-footer-link" href="#candidates">Manage candidate interviews <span aria-hidden="true">→</span></a>
                  </section>

                  <section className="recruiter-panel todo-panel" id="todos">
                    <div className="recruiter-panel-heading">
                      <div><span className="panel-icon" aria-hidden="true">☑</span><div><h2>To Do</h2><p>Keep track of your hiring tasks</p></div></div>
                      <span className="panel-total">{todos.filter((todo) => !todo.completed).length} left</span>
                    </div>
                    <form className="todo-form" onSubmit={addTodo}>
                      <input
                        aria-label="New to-do item"
                        maxLength={120}
                        onChange={(event) => setNewTodo(event.target.value)}
                        placeholder="Add a task"
                        value={newTodo}
                      />
                      <button type="submit" disabled={!newTodo.trim()} aria-label="Add task">＋</button>
                    </form>
                    {todos.length ? (
                      <ul className="todo-list">
                        {todos.map((todo) => (
                          <li key={todo.id} className={todo.completed ? 'completed' : ''}>
                            <label>
                              <input
                                type="checkbox"
                                checked={todo.completed}
                                onChange={() => setTodos((current) => current.map((item) => (
                                  item.id === todo.id ? { ...item, completed: !item.completed } : item
                                )))}
                              />
                              <span>{todo.text}</span>
                            </label>
                            <button
                              type="button"
                              aria-label={`Delete ${todo.text}`}
                              onClick={() => setTodos((current) => current.filter((item) => item.id !== todo.id))}
                            >×</button>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="todo-empty">Add a task to get started.</p>}
                  </section>
                </div>

                <section className="recruiter-panel pipeline-panel" id="pipeline">
                  <div className="recruiter-panel-heading">
                    <div><span className="panel-icon green-panel-icon" aria-hidden="true">⇢</span><div><h2>Candidate pipeline</h2><p>Applications by current stage</p></div></div>
                    <a className="text-action" href="#candidates">Review candidates <span aria-hidden="true">→</span></a>
                  </div>
                  <div className="pipeline-stages">
                    {[
                      ['pending', 'Pending review', pendingApplications, 'pipeline-pending'],
                      ['accepted', 'Accepted', acceptedApplications, 'pipeline-accepted'],
                      ['rejected', 'Declined', applications.filter((item) => item.status === 'rejected').length, 'pipeline-rejected'],
                    ].map(([status, label, count, className]) => (
                      <button
                        type="button"
                        className={`pipeline-stage ${className}`}
                        key={status}
                        onClick={() => {
                          setApplicationFilter(status)
                          document.getElementById('candidates')?.scrollIntoView({ behavior: 'smooth' })
                        }}
                      >
                        <span>{label}</span><strong>{count}</strong>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="recruiter-panel notifications-panel recruiter-notifications" id="notifications">
                  <NotificationCenter token={token} />
                </section>
              </div>

              <section className="recruiter-panel jobs-panel" id="jobs">
                <div className="recruiter-panel-heading">
                  <div><span className="panel-icon" aria-hidden="true">▤</span><div><h2>Your job listings</h2><p>Manage roles and keep listings up to date</p></div></div>
                  <div className="panel-heading-actions"><span className="panel-total">{jobs.length} total</span><Link className="text-action" to="/employer/create-job">＋ Add job</Link></div>
                </div>
                {jobs.length === 0 ? (
                  <div className="panel-empty"><p>You haven’t posted any jobs yet.</p><Link className="button button-primary" to="/employer/create-job">Create your first listing</Link></div>
                ) : (
                  <div className="recruiter-jobs-list">
                    {jobs.map((job) => (
                      <article className="recruiter-job-row" key={job.id}>
                        <span className="job-company-avatar" aria-hidden="true">{job.company.charAt(0).toUpperCase()}</span>
                        <div className="recruiter-job-info">
                          <strong>{job.title}</strong>
                          <span>{job.company} <i aria-hidden="true">·</i> {job.location}</span>
                        </div>
                        <span className={`status-badge status-${job.status}`}>{job.status}</span>
                        <span className="recruiter-job-applicants">{applications.filter((application) => application.job_id === job.id).length} applicants</span>
                        <div className="job-card-actions">
                          <Link className="button button-secondary" to={`/employer/jobs/${job.id}/edit`}>Edit</Link>
                          <button className="button button-secondary" type="button" onClick={() => toggleJob(job)}>
                            {job.status === 'open' ? 'Close listing' : 'Reopen listing'}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="recruiter-panel candidates-panel" id="candidates">
                <div className="recruiter-panel-heading">
                  <div><span className="panel-icon blue-panel-icon" aria-hidden="true">♙</span><div><h2>Candidate applications</h2><p>Review applicants, update stages, and stay in touch</p></div></div>
                  <span className="panel-total">{applications.length} total</span>
                </div>
                <div className="candidate-toolbar">
                  <div className="candidate-filters" aria-label="Filter candidates by application status">
                    {[
                      ['all', 'All candidates', applications.length],
                      ['pending', 'Pending', pendingApplications],
                      ['accepted', 'Accepted', acceptedApplications],
                      ['rejected', 'Declined', applications.filter((item) => item.status === 'rejected').length],
                    ].map(([status, label, count]) => (
                      <button
                        type="button"
                        className={applicationFilter === status ? 'candidate-filter active' : 'candidate-filter'}
                        key={status}
                        onClick={() => setApplicationFilter(status)}
                        aria-pressed={applicationFilter === status}
                      >
                        {label}<span>{count}</span>
                      </button>
                    ))}
                  </div>
                  <label className="candidate-search">
                    <span aria-hidden="true">⌕</span>
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Filter candidates"
                      aria-label="Filter candidate applications"
                    />
                  </label>
                </div>
                {applications.length === 0 ? (
                  <div className="panel-empty"><p>Applications for your open jobs will appear here.</p></div>
                ) : visibleApplications.length === 0 ? (
                  <div className="panel-empty"><p>No candidates match this search and status filter.</p><button className="text-action" type="button" onClick={() => { setSearchQuery(''); setApplicationFilter('all') }}>Clear filters</button></div>
                ) : (
                  <div className="candidate-list">
                    {visibleApplications.map((application) => (
                      <article className="candidate-row" key={application.id}>
                        <span className="application-company-mark applicant-mark" aria-hidden="true">{application.applicant.full_name?.charAt(0)?.toUpperCase() || 'C'}</span>
                        <div className="applicant-details">
                          <h3>{application.applicant.full_name}</h3>
                          <p>{application.applicant.email}</p>
                          <p><Link to={`/jobs/${application.job.id}`}>{application.job.title}</Link> <span aria-hidden="true">·</span> {application.job.company}</p>
                          <small>Applied {new Date(application.applied_at).toLocaleDateString()}</small>
                          {application.resume_filename && (
                            <button
                              className="resume-link"
                              type="button"
                              onClick={async () => {
                                try {
                                  await downloadFile(`/api/applications/${application.id}/resume`, application.resume_filename, token)
                                } catch (downloadError) {
                                  setError(downloadError.message)
                                }
                              }}
                            >Download {application.resume_filename}</button>
                          )}
                        </div>
                        <div className="application-actions">
                          <span className={`status-badge status-${application.status}`}>{application.status}</span>
                          <label className="sr-only" htmlFor={`application-${application.id}`}>Update application status</label>
                          <select
                            id={`application-${application.id}`}
                            value={application.status}
                            disabled={updatingId === application.id}
                            onChange={(event) => changeApplicationStatus(application.id, event.target.value)}
                          >
                            <option value="pending">Pending</option>
                            <option value="accepted">Accepted</option>
                            <option value="rejected">Rejected</option>
                            <option value="withdrawn" disabled>Withdrawn</option>
                          </select>
                        </div>
                        <div className="application-tools-row">
                          <ApplicationConversation applicationId={application.id} token={token} userId={user?.id} />
                          {application.status !== 'withdrawn' && application.status !== 'rejected' && (
                            <InterviewPanel applicationId={application.id} token={token} userId={user?.id} role="employer" onInterviewChange={refreshInterviews} />
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
          <footer className="employer-footer">© {dashboardDate.getFullYear()} JobConnect · Hiring made clearer.</footer>
        </main>
      </div>
    </div>
  )
}

export default EmployerDashboard

import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import NotificationCenter from '../components/NotificationCenter'
import SavedSearchAlerts from '../components/SavedSearchAlerts'
import ApplicationConversation from '../components/ApplicationConversation'
import InterviewPanel from '../components/InterviewPanel'
import JobCard from '../components/JobCard'
import SaveJobButton from '../components/SaveJobButton'
import { apiRequest, downloadFile } from '../api'
import { useAuth } from '../context/useAuth'

function Dashboard() {
  const { user, token, logout } = useAuth()
  const [applications, setApplications] = useState([])
  const [savedJobs, setSavedJobs] = useState([])
  const [interviews, setInterviews] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [applicationFilter, setApplicationFilter] = useState('all')
  const [activeSection, setActiveSection] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [dashboardDate] = useState(() => new Date())
  const searchRef = useRef(null)

  const pendingCount = applications.filter((application) => application.status === 'pending').length
  const acceptedCount = applications.filter((application) => application.status === 'accepted').length
  const rejectedCount = applications.filter((application) => application.status === 'rejected').length
  const withdrawnCount = applications.filter((application) => application.status === 'withdrawn').length
  const upcomingInterviews = interviews.slice(0, 4)
  const visibleApplications = applications.filter((application) => {
    const matchesStatus = applicationFilter === 'all' || application.status === applicationFilter
    const query = searchQuery.trim().toLowerCase()
    const matchesSearch = !query || [
      application.job.title,
      application.job.company,
      application.job.location,
      application.status,
    ].some((value) => value?.toLowerCase().includes(query))
    return matchesStatus && matchesSearch
  })

  useEffect(() => {
    let active = true
    Promise.all([
      apiRequest('/api/applications/me', { token }),
      apiRequest('/api/saved-jobs/', { token }),
      apiRequest('/api/interviews/me', { token }),
    ])
      .then(([applicationData, savedJobData, interviewData]) => {
        if (active) {
          setApplications(applicationData)
          setSavedJobs(savedJobData)
          setInterviews(interviewData)
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
  }, [token])

  useEffect(() => {
    function focusApplicationSearch(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }

    window.addEventListener('keydown', focusApplicationSearch)
    return () => window.removeEventListener('keydown', focusApplicationSearch)
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

  async function withdrawApplication(applicationId) {
    setActionError('')
    try {
      const updated = await apiRequest(`/api/applications/me/${applicationId}`, {
        method: 'DELETE',
        token,
      })
      setApplications((current) => current.map((item) => item.id === updated.id ? updated : item))
    } catch (requestError) {
      setActionError(requestError.message)
    }
  }

  const sectionLink = (section, label, icon, count) => (
    <a
      className={`employer-nav-link${activeSection === section ? ' active' : ''}`}
      href={`#${section}`}
      onClick={() => setActiveSection(section)}
    >
      <span aria-hidden="true">{icon}</span>{label}
      {count !== undefined && <span className="nav-count">{count}</span>}
    </a>
  )

  return (
    <div className="employer-app-shell seeker-app-shell">
      <aside className="employer-sidebar" aria-label="Job seeker workspace">
        <Link className="employer-brand" to="/" aria-label="JobConnect home">
          <span className="employer-brand-mark" aria-hidden="true">J</span>
          <span>JobConnect<span className="employer-brand-dot">.</span></span>
        </Link>
        <div className="employer-company-switcher">
          <span className="company-avatar seeker-company-avatar" aria-hidden="true">{user?.full_name?.charAt(0)?.toUpperCase() || 'U'}</span>
          <span><strong>{user?.full_name}</strong><small>Job seeker workspace</small></span>
          <span className="switcher-chevron" aria-hidden="true">⌄</span>
        </div>
        <nav className="employer-navigation" aria-label="Workspace sections">
          <p>MY WORKSPACE</p>
          {sectionLink('overview', 'Overview', '⌂')}
          {sectionLink('applications', 'Applications', '▤', applications.length)}
          {sectionLink('saved-jobs', 'Saved jobs', '♡', savedJobs.length)}
          {sectionLink('interviews', 'Interviews', '▣', interviews.length)}
          {sectionLink('job-alerts', 'Job alerts', '⌁')}
          <p className="navigation-spacer">ACCOUNT</p>
          {sectionLink('notifications', 'Notifications', '♧')}
          <Link className="employer-nav-link" to="/"><span aria-hidden="true">⌕</span>Explore jobs</Link>
        </nav>
        <div className="sidebar-account">
          <span className="account-avatar" aria-hidden="true">{user?.full_name?.charAt(0)?.toUpperCase() || 'U'}</span>
          <span><strong>{user?.full_name}</strong><small>Job seeker</small></span>
          <button className="account-logout" type="button" onClick={logout}><span aria-hidden="true">↗</span>Log out</button>
        </div>
      </aside>

      <div className="employer-workspace">
        <header className="employer-topbar">
          <div className="topbar-page-title"><span>Workspace</span><span aria-hidden="true">/</span><strong>My dashboard</strong></div>
          <label className="dashboard-search">
            <span aria-hidden="true">⌕</span>
            <input
              ref={searchRef}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search your applications..."
              aria-label="Search applications by job title, company, location, or status"
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
              <h1>Good to see you, {user?.full_name?.split(' ')[0]}</h1>
              <p className="dashboard-subtitle">Keep track of your applications and find your next opportunity.</p>
            </div>
            <Link className="button button-primary" to="/"><span aria-hidden="true">⌕</span> Explore open jobs</Link>
          </div>

          {error && <p className="state-message error-message dashboard-error" role="alert">{error}</p>}
          {actionError && <p className="state-message error-message dashboard-error" role="alert">{actionError}</p>}
          {loading && <p className="state-message">Loading your job search…</p>}

          {!loading && (
            <>
              <section className="recruiter-stats-grid seeker-recruiter-stats" aria-label="Job search summary">
                <article className="recruiter-stat-card">
                  <span className="recruiter-stat-icon violet" aria-hidden="true">▤</span>
                  <span className="recruiter-stat-label">Applications sent</span>
                  <strong>{applications.length}</strong>
                  <small>Your opportunities in motion</small>
                </article>
                <article className="recruiter-stat-card">
                  <span className="recruiter-stat-icon amber" aria-hidden="true">◷</span>
                  <span className="recruiter-stat-label">Awaiting a response</span>
                  <strong>{pendingCount}</strong>
                  <small>Applications under review</small>
                </article>
                <article className="recruiter-stat-card">
                  <span className="recruiter-stat-icon green" aria-hidden="true">✓</span>
                  <span className="recruiter-stat-label">Positive responses</span>
                  <strong>{acceptedCount}</strong>
                  <small>Accepted applications</small>
                </article>
                <article className="recruiter-stat-card">
                  <span className="recruiter-stat-icon blue" aria-hidden="true">▣</span>
                  <span className="recruiter-stat-label">Upcoming interviews</span>
                  <strong>{interviews.length}</strong>
                  <small>{savedJobs.length} saved jobs on your shortlist</small>
                </article>
              </section>

              <div className="recruiter-overview-grid seeker-overview-grid">
                <section className="recruiter-panel seeker-progress-panel">
                  <div className="recruiter-panel-heading">
                    <div><span className="panel-icon" aria-hidden="true">⇢</span><div><h2>Application progress</h2><p>A quick look at where your search stands</p></div></div>
                    <a className="text-action" href="#applications" onClick={() => setActiveSection('applications')}>View applications <span aria-hidden="true">→</span></a>
                  </div>
                  <div className="seeker-progress-total">
                    <strong>{applications.length}</strong>
                    <span>total applications</span>
                  </div>
                  <div className="seeker-progress-track" role="img" aria-label={`${pendingCount} pending, ${acceptedCount} accepted, ${rejectedCount} declined, ${withdrawnCount} withdrawn`}>
                    <span className="progress-pending" style={{ width: `${applications.length ? (pendingCount / applications.length) * 100 : 0}%` }} />
                    <span className="progress-accepted" style={{ width: `${applications.length ? (acceptedCount / applications.length) * 100 : 0}%` }} />
                    <span className="progress-rejected" style={{ width: `${applications.length ? (rejectedCount / applications.length) * 100 : 0}%` }} />
                    <span className="progress-withdrawn" style={{ width: `${applications.length ? (withdrawnCount / applications.length) * 100 : 0}%` }} />
                  </div>
                  <div className="seeker-progress-legend">
                    {[
                      ['Pending', pendingCount, 'legend-pending'],
                      ['Accepted', acceptedCount, 'legend-accepted'],
                      ['Declined', rejectedCount, 'legend-rejected'],
                      ['Withdrawn', withdrawnCount, 'legend-withdrawn'],
                    ].map(([label, count, className]) => (
                      <span key={label}><i className={className} />{label}<strong>{count}</strong></span>
                    ))}
                  </div>
                </section>

                <section className="recruiter-panel seeker-interviews-panel" id="interviews">
                  <div className="recruiter-panel-heading">
                    <div><span className="panel-icon blue-panel-icon" aria-hidden="true">▣</span><div><h2>Upcoming interviews</h2><p>Meetings with hiring teams</p></div></div>
                    <a className="panel-more" href="#applications" aria-label="View interview invitations">···</a>
                  </div>
                  {upcomingInterviews.length ? (
                    <div className="upcoming-interview-list">
                      {upcomingInterviews.map((interview) => {
                        const application = applications.find((item) => item.id === interview.application_id)
                        return (
                          <article className="upcoming-interview-item" key={interview.id}>
                            <span className="interview-time">{new Date(interview.scheduled_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                            <div>
                              <strong>{application?.job.title || 'Interview invitation'}</strong>
                              <span>{application?.job.company || 'Hiring team'} · {new Date(interview.scheduled_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                            </div>
                            <span className={`interview-status status-${interview.status}`}>{interview.status}</span>
                            {application && <a className="interview-review-link" href={`#application-${application.id}`}>Review</a>}
                          </article>
                        )
                      })}
                    </div>
                  ) : <p className="panel-empty">No upcoming interviews yet. Invitations will show here.</p>}
                </section>

                <section className="recruiter-panel notifications-panel recruiter-notifications" id="notifications">
                  <NotificationCenter token={token} />
                </section>

                <section className="recruiter-panel seeker-shortlist-summary">
                  <div className="recruiter-panel-heading">
                    <div><span className="panel-icon green-panel-icon" aria-hidden="true">♡</span><div><h2>Saved jobs</h2><p>Roles you want to come back to</p></div></div>
                    <a className="text-action" href="#saved-jobs" onClick={() => setActiveSection('saved-jobs')}>View shortlist <span aria-hidden="true">→</span></a>
                  </div>
                  {savedJobs.length ? (
                    <div className="seeker-shortlist-preview">
                      {savedJobs.slice(0, 2).map((job) => (
                        <Link className="seeker-shortlist-item" to={`/jobs/${job.id}`} key={job.id}>
                          <span className="job-company-avatar" aria-hidden="true">{job.company?.charAt(0)?.toUpperCase() || 'J'}</span>
                          <span><strong>{job.title}</strong><small>{job.company} · {job.location}</small></span>
                          <span aria-hidden="true">→</span>
                        </Link>
                      ))}
                    </div>
                  ) : <p className="panel-empty">Save roles you like and they’ll be waiting here.</p>}
                </section>
              </div>

              <section className="recruiter-panel jobs-panel seeker-applications-panel" id="applications">
                <div className="recruiter-panel-heading">
                  <div><span className="panel-icon" aria-hidden="true">▤</span><div><h2>My applications</h2><p>Follow each opportunity from application to answer</p></div></div>
                  <span className="panel-total">{applications.length} total</span>
                </div>
                <div className="candidate-toolbar">
                  <div className="candidate-filters" aria-label="Filter applications by status">
                    {[
                      ['all', 'All applications', applications.length],
                      ['pending', 'Pending', pendingCount],
                      ['accepted', 'Accepted', acceptedCount],
                      ['rejected', 'Declined', rejectedCount],
                      ['withdrawn', 'Withdrawn', withdrawnCount],
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
                      placeholder="Filter applications"
                      aria-label="Filter applications"
                    />
                  </label>
                </div>
                {error && <p className="state-message error-message" role="alert">{error}</p>}
                {actionError && <p className="state-message error-message" role="alert">{actionError}</p>}
                {!applications.length ? (
                  <div className="panel-empty"><p>You haven’t applied to any jobs yet.</p><Link className="button button-primary" to="/">Explore open roles</Link></div>
                ) : !visibleApplications.length ? (
                  <div className="panel-empty"><p>No applications match this search and status filter.</p><button className="text-action" type="button" onClick={() => { setSearchQuery(''); setApplicationFilter('all') }}>Clear filters</button></div>
                ) : (
                  <div className="candidate-list">
                    {visibleApplications.map((application) => (
                      <article className="candidate-row seeker-application-row" id={`application-${application.id}`} key={application.id}>
                        <span className="application-company-mark" aria-hidden="true">{application.job.company?.charAt(0)?.toUpperCase() || 'J'}</span>
                        <div className="applicant-details">
                          <h3><Link to={`/jobs/${application.job.id}`}>{application.job.title}</Link></h3>
                          <p>{application.job.company} <span aria-hidden="true">·</span> {application.job.location}</p>
                          <small>Applied {new Date(application.applied_at).toLocaleDateString()}</small>
                        </div>
                        <div className="application-actions">
                          <span className={`status-badge status-${application.status}`}>{application.status}</span>
                          {application.resume_filename && (
                            <button className="button button-secondary" type="button" onClick={async () => {
                              try {
                                await downloadFile(`/api/applications/${application.id}/resume`, application.resume_filename, token)
                              } catch (downloadError) {
                                setActionError(downloadError.message)
                              }
                            }}>Download resume</button>
                          )}
                          {application.status === 'pending' && (
                            <button className="button button-secondary" type="button" onClick={() => withdrawApplication(application.id)}>
                              Withdraw
                            </button>
                          )}
                        </div>
                        <div className="application-tools-row">
                          <ApplicationConversation applicationId={application.id} token={token} userId={user?.id} />
                          <InterviewPanel applicationId={application.id} token={token} userId={user?.id} role="job_seeker" onInterviewChange={refreshInterviews} />
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="recruiter-panel jobs-panel seeker-saved-jobs-panel" id="saved-jobs">
                <div className="recruiter-panel-heading">
                  <div><span className="panel-icon green-panel-icon" aria-hidden="true">♡</span><div><h2>Saved jobs</h2><p>Keep interesting roles close while you decide what’s next</p></div></div>
                  <span className="panel-total">{savedJobs.length} saved</span>
                </div>
                {savedJobs.length ? (
                  <div className="jobs-grid">
                    {savedJobs.map((job) => (
                      <JobCard
                        key={job.id}
                        job={job}
                        action={<SaveJobButton
                          jobId={job.id}
                          isSaved
                          token={token}
                          onSavedChange={(jobId) => setSavedJobs((current) => current.filter((item) => item.id !== jobId))}
                        />}
                      />
                    ))}
                  </div>
                ) : <div className="panel-empty"><p>No saved jobs yet. Save a role from the listings page to find it here.</p><Link className="button button-primary" to="/">Explore jobs</Link></div>}
              </section>

              <section id="job-alerts" className="seeker-alerts-panel">
                <SavedSearchAlerts token={token} />
              </section>
            </>
          )}
          <footer className="employer-footer">© {dashboardDate.getFullYear()} JobConnect · Your next opportunity starts here.</footer>
        </main>
      </div>
    </div>
  )
}

export default Dashboard

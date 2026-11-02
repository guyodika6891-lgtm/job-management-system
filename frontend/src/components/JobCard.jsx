import { Link } from 'react-router-dom'

function JobCard({ job, action }) {
  return (
    <article className="job-card">
      <div className="job-card-heading">
        <div>
          <h3>{job.title}</h3>
          <p className="job-company">{job.company}</p>
        </div>
        {job.status && <span className={`status-badge status-${job.status}`}>{job.status}</span>}
      </div>
      <p className="job-meta">{job.location}{job.salary ? ` · ${job.salary}` : ''}</p>
      <p className="job-description">{job.description}</p>
      <div className="job-card-actions">
        <Link className="button button-secondary" to={`/jobs/${job.id}`}>View details</Link>
        {action}
      </div>
    </article>
  )
}

export default JobCard

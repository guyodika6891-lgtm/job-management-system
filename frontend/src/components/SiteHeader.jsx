import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

function SiteHeader() {
  const { user, logout } = useAuth()
  const location = useLocation()

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="brand" aria-label="JobConnect home">
          <span className="brand-mark" aria-hidden="true">J</span>
          <span className="brand-wordmark">JobConnect<span>.</span></span>
        </Link>
        <nav aria-label="Main navigation">
          <Link
            className={location.pathname === '/' ? 'nav-link active' : 'nav-link'}
            aria-current={location.pathname === '/' ? 'page' : undefined}
            to="/"
          >
            Find jobs
          </Link>
          {user?.role === 'employer' && (
            <Link
              className={location.pathname.startsWith('/employer') ? 'nav-link active' : 'nav-link'}
              aria-current={location.pathname.startsWith('/employer') ? 'page' : undefined}
              to="/employer"
            >
              Hiring workspace
            </Link>
          )}
          {user?.role === 'admin' && (
            <Link
              className={location.pathname.startsWith('/admin') ? 'nav-link active' : 'nav-link'}
              aria-current={location.pathname.startsWith('/admin') ? 'page' : undefined}
              to="/admin"
            >
              Admin workspace
            </Link>
          )}
          {user?.role === 'job_seeker' && (
            <Link
              className={location.pathname === '/job-seeker' ? 'nav-link active' : 'nav-link'}
              aria-current={location.pathname === '/job-seeker' ? 'page' : undefined}
              to="/job-seeker"
            >
              My applications
            </Link>
          )}
          <span className="nav-divider" aria-hidden="true" />
          {user ? (
            <div className="nav-account">
              <span className="nav-avatar" aria-hidden="true">{user.full_name?.charAt(0)?.toUpperCase() || 'U'}</span>
              <span className="nav-user-name">{user.full_name?.split(' ')[0]}</span>
              <button className="button button-secondary nav-logout" type="button" onClick={logout}>Log out</button>
            </div>
          ) : (
            <div className="nav-auth-actions">
              <Link className="nav-link" to="/login">Log in</Link>
              <Link className="button button-primary" to="/register">Get started <span aria-hidden="true">→</span></Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  )
}

export default SiteHeader

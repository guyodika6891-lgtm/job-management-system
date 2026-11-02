import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

function RoleProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <p>Checking authentication...</p>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!allowedRoles.includes(user.role)) {
    const destination = user.role === 'admin'
      ? '/admin'
      : user.role === 'employer'
        ? '/employer'
        : '/job-seeker'
    return <Navigate to={destination} replace />
  }

  return children
}

export default RoleProtectedRoute
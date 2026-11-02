import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function RoleGuard({ children, allowedRoles }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <p>Checking permissions...</p>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />
  }

  return children
}

export default RoleGuard
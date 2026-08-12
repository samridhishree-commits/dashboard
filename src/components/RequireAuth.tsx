import { Navigate, useLocation } from 'react-router-dom'
import { useAuth, type AuthRole } from '../context/AuthContext'

export function RequireAuth({
  children,
  role,
}: {
  children: React.ReactNode
  role?: AuthRole
}) {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (role === 'admin' && user.role !== 'admin') {
    const dest =
      user.role === 'institute' && user.instituteId
        ? `/institute/${user.instituteId}`
        : '/login'
    return <Navigate to={dest} replace />
  }

  return children
}

/** Institute user may only open their own institute routes. */
export function RequireInstituteAccess({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const location = useLocation()
  const match = location.pathname.match(/^\/institute\/([^/]+)/)
  const pathInstituteId = match?.[1]

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (
    user.role === 'institute' &&
    user.instituteId &&
    pathInstituteId &&
    pathInstituteId !== user.instituteId
  ) {
    return <Navigate to={`/institute/${user.instituteId}`} replace />
  }

  return children
}

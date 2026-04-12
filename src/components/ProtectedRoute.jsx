import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/** 로그인한 사용자만 접근 */
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-950 text-slate-400">
        불러오는 중…
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}

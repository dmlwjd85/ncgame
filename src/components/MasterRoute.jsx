import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/** 마스터(관리자) 전용 */
export default function MasterRoute({ children }) {
  const { user, loading, isMaster } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-950 text-slate-400">
        불러오는 중…
      </div>
    )
  }

  if (!user) {
    return (
      <Navigate to="/master-login" replace state={{ from: location }} />
    )
  }

  if (!isMaster) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-slate-950 px-4 text-center text-slate-300">
        <p className="text-lg font-medium">접근 권한이 없습니다.</p>
        <p className="max-w-sm text-sm text-slate-500">
          관리자 화면은 <span className="text-slate-400">마스터 로그인</span>으로
          들어온 계정만 사용할 수 있습니다.
        </p>
        <Link
          to="/master-login"
          className="rounded-xl border border-emerald-600/50 px-4 py-2 text-sm text-emerald-300"
        >
          마스터 로그인으로 이동
        </Link>
        <Link
          to="/"
          className="rounded-xl border border-slate-600 px-4 py-2 text-sm text-emerald-300"
        >
          홈으로
        </Link>
      </div>
    )
  }

  return children
}

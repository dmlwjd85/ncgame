import { Link, NavLink, Outlet } from 'react-router-dom'

/**
 * 마스터 관리 공통 레이아웃 — 엑셀 미리보기 / 회원 관리
 */
export default function AdminLayout() {
  return (
    <div className="min-h-dvh bg-slate-950 px-4 py-6 text-slate-100">
      <div className="mx-auto w-full max-w-3xl">
        <p className="text-xs text-slate-500">
          <Link className="text-emerald-400 underline" to="/">
            ← 홈
          </Link>
        </p>
        <h1 className="mt-2 text-xl font-semibold">관리자</h1>
        <nav className="mt-4 flex flex-wrap gap-2 border-b border-slate-800 pb-3">
          <NavLink
            to="/admin/excel"
            className={({ isActive }) =>
              `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                isActive
                  ? 'bg-emerald-900/50 text-emerald-100 ring-1 ring-emerald-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`
            }
          >
            엑셀 미리보기
          </NavLink>
          <NavLink
            to="/admin/users"
            className={({ isActive }) =>
              `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                isActive
                  ? 'bg-emerald-900/50 text-emerald-100 ring-1 ring-emerald-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`
            }
          >
            회원 관리
          </NavLink>
        </nav>
        <div className="mt-6">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

import { Link } from 'react-router-dom'

/**
 * 앱 진입(임시) — 이후 게임 로비·페이즈 선택으로 확장 예정
 */
export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col bg-slate-950 px-4 py-8 text-slate-100">
      <header className="mx-auto w-full max-w-md text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-400/90">
          NC Game
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          교육용 웹 보드게임
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          1페이즈·2페이즈 개발 전, 관리자에서 카드팩 엑셀을 먼저 확인할 수
          있습니다.
        </p>
      </header>

      <nav className="mx-auto mt-10 flex w-full max-w-md flex-col gap-3">
        <Link
          to="/admin"
          className="rounded-2xl border border-emerald-500/40 bg-emerald-600/20 px-4 py-4 text-center text-base font-medium text-emerald-100 transition hover:bg-emerald-600/30"
        >
          관리자 · 엑셀 업로드
        </Link>
      </nav>
    </div>
  )
}

import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCardPacks } from '../contexts/CardPackContext'

/**
 * 앱 홈 — 로그인·카드팩(ncxlxs) 요약
 */
export default function Home() {
  const { user, loading: authLoading, signOut, isMaster } = useAuth()
  const { packs, loading: packsLoading, error: packsError, reloadPacks } =
    useCardPacks()

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
          ncxlxs 폴더의 엑셀·시트별로 카드팩이 로드됩니다. 로그인 후 게임
          페이즈는 이후 연결됩니다.
        </p>
      </header>

      <section className="mx-auto mt-8 w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-4 text-left text-sm">
        <h2 className="font-medium text-slate-200">계정</h2>
        {authLoading ? (
          <p className="mt-2 text-slate-500">확인 중…</p>
        ) : user ? (
          <div className="mt-2 flex flex-col gap-2">
            <p className="text-slate-300">
              <span className="text-slate-500">이름 </span>
              {user.displayName || '—'}
              {isMaster ? (
                <span className="ml-2 rounded-md bg-amber-500/20 px-2 py-0.5 text-xs text-amber-200">
                  마스터
                </span>
              ) : null}
            </p>
            <button
              type="button"
              className="w-fit rounded-lg border border-slate-600 px-3 py-1.5 text-slate-300"
              onClick={() => void signOut()}
            >
              로그아웃
            </button>
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            <Link
              className="rounded-lg bg-emerald-600 px-3 py-2 text-white"
              to="/login"
            >
              로그인
            </Link>
            <Link
              className="rounded-lg border border-slate-600 px-3 py-2 text-slate-200"
              to="/register"
            >
              회원가입
            </Link>
          </div>
        )}
      </section>

      <section className="mx-auto mt-6 w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-4 text-left">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-slate-200">
            ncxlxs 카드팩 (시트 단위)
          </h2>
          <button
            type="button"
            className="text-xs text-emerald-400 underline"
            onClick={() => void reloadPacks()}
          >
            새로고침
          </button>
        </div>
        {packsLoading ? (
          <p className="mt-2 text-sm text-slate-500">불러오는 중…</p>
        ) : packsError ? (
          <p className="mt-2 text-sm text-amber-200/90">{packsError}</p>
        ) : packs.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            등록된 팩이 없습니다. 저장소의 <code className="text-emerald-300">ncxlxs</code> 폴더에
            .xlsx를 넣고 manifest.json에 파일명을 추가한 뒤 빌드하세요.
          </p>
        ) : (
          <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto text-sm text-slate-300">
            {packs.map((p) => (
              <li
                key={p.id}
                className="rounded-lg border border-slate-800/80 px-2 py-2"
              >
                <span className="text-slate-400">{p.sourceFile}</span>
                <span className="mx-1 text-slate-600">·</span>
                <span className="text-slate-200">{p.sheetName}</span>
                <span className="ml-2 text-xs text-slate-500">
                  ({p.rows.length}장
                  {p.missingColumns.length > 0
                    ? ` · 열 누락 ${p.missingColumns.join(', ')}`
                    : ''}
                  )
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <nav className="mx-auto mt-8 flex w-full max-w-md flex-col gap-3">
        {isMaster ? (
          <Link
            to="/admin"
            className="rounded-2xl border border-amber-500/40 bg-amber-600/15 px-4 py-4 text-center text-base font-medium text-amber-100 transition hover:bg-amber-600/25"
          >
            관리자 · 엑셀 미리보기
          </Link>
        ) : null}
      </nav>
    </div>
  )
}

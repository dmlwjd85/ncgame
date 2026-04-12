import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCardPacks } from '../contexts/CardPackContext'

/**
 * 앱 홈 — 로그인·카드팩(ncxlxs) 선택·게임 시작
 */
export default function Home() {
  const navigate = useNavigate()
  const { user, loading: authLoading, signOut, isMaster } = useAuth()
  const { packs, loading: packsLoading, error: packsError, reloadPacks } =
    useCardPacks()
  const [selectedPackId, setSelectedPackId] = useState(null)
  const [botCount, setBotCount] = useState(1)

  const effectivePackId = selectedPackId ?? packs[0]?.id ?? null
  const selectedPack = packs.find((p) => p.id === effectivePackId)
  const canStart =
    user &&
    selectedPack &&
    selectedPack.rows.length >= 3 &&
    selectedPack.missingColumns.length === 0

  const startGame = () => {
    if (!canStart) return
    navigate('/game', {
      state: { packId: effectivePackId, botCount },
    })
  }

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
          ncxlxs 폴더의 엑셀·시트별로 카드팩이 로드됩니다. 로그인 후 팩을
          고르고 가상 플레이어와 1·2페이즈 게임을 시작할 수 있습니다.
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
              <li key={p.id}>
                <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-800/80 px-2 py-2 has-[:checked]:border-emerald-500/50 has-[:checked]:bg-emerald-950/20">
                  <input
                    type="radio"
                    name="pack"
                    className="mt-1"
                    checked={effectivePackId === p.id}
                    onChange={() => setSelectedPackId(p.id)}
                  />
                  <span>
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
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>

      {user ? (
        <section className="mx-auto mt-6 w-full max-w-md rounded-2xl border border-emerald-800/50 bg-emerald-950/20 px-4 py-4 text-left">
          <h2 className="text-sm font-medium text-emerald-200/90">
            게임 시작
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            1페이즈: 주제어·해설 매칭으로 덱 완성 · 2페이즈: 사전순 눈치게임
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <span className="text-slate-400">가상 플레이어</span>
            <label className="flex items-center gap-1.5 text-slate-300">
              <input
                type="radio"
                name="bots"
                checked={botCount === 1}
                onChange={() => setBotCount(1)}
              />
              1명
            </label>
            <label className="flex items-center gap-1.5 text-slate-300">
              <input
                type="radio"
                name="bots"
                checked={botCount === 2}
                onChange={() => setBotCount(2)}
              />
              2명
            </label>
          </div>
          <button
            type="button"
            disabled={!canStart}
            onClick={startGame}
            className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-3 text-center text-base font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {!selectedPack
              ? '팩을 선택하세요'
              : selectedPack.rows.length < 3
                ? '이 팩은 행이 3개 미만입니다'
                : selectedPack.missingColumns.length > 0
                  ? '열 누락 팩은 시작할 수 없습니다'
                  : '선택한 팩으로 플레이'}
          </button>
        </section>
      ) : null}

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

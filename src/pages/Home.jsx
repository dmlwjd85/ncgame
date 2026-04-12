import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import GameHelpModal from '../components/GameHelpModal'
import HallOfFamePanel from '../components/HallOfFamePanel'
import { useAuth } from '../contexts/AuthContext'
import { useCardPacks } from '../contexts/CardPackContext'
import { maxLevelFromRowCount } from '../utils/gameRules'

/**
 * 앱 홈 — 플레이 / 명예의 전당 · 팩별 게임 안내 모달
 */
export default function Home() {
  const navigate = useNavigate()
  const { user, loading: authLoading, signOut, isMaster } = useAuth()
  const { packs, loading: packsLoading, error: packsError, reloadPacks } =
    useCardPacks()
  const [tab, setTab] = useState(/** @type {'play'|'hof'} */ ('play'))
  const [selectedPackId, setSelectedPackId] = useState(null)
  const [botCount, setBotCount] = useState(1)
  const [helpOpen, setHelpOpen] = useState(false)

  const effectivePackId = selectedPackId ?? packs[0]?.id ?? null
  const selectedPack = packs.find((p) => p.id === effectivePackId)
  const validCount = selectedPack
    ? selectedPack.rows.filter((r) => r.topic && r.explanation).length
    : 0
  const maxLv = maxLevelFromRowCount(validCount)

  const canStart =
    user &&
    selectedPack &&
    maxLv >= 1 &&
    selectedPack.missingColumns.length === 0

  const openHelp = () => {
    if (!canStart) return
    setHelpOpen(true)
  }

  const closeHelp = () => setHelpOpen(false)

  const goGame = () => {
    if (!effectivePackId) return
    setHelpOpen(false)
    navigate('/game', {
      state: { packId: effectivePackId, botCount },
    })
  }

  return (
    <div className="game-shell relative min-h-dvh overflow-hidden text-slate-100">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_60%_at_50%_-10%,rgba(56,189,248,0.12),transparent)]"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_100%_100%,rgba(139,92,246,0.08),transparent)]" />

      <div className="relative mx-auto flex min-h-dvh max-w-lg flex-col px-4 py-8">
        <header className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-cyan-400/90">
            NC Game
          </p>
          <h1 className="mt-2 bg-gradient-to-r from-white via-cyan-100 to-violet-200 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
            국어 사전순 눈치
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-slate-400">
            낱말과 해설을 맞추고, 사전 순서를 읽는 눈치게임. 교육과 플레이를 함께
            담았습니다.
          </p>
        </header>

        <div className="mx-auto mt-8 flex w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-1 backdrop-blur-md">
          <button
            type="button"
            className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition ${
              tab === 'play'
                ? 'bg-gradient-to-r from-cyan-600/90 to-violet-600/90 text-white shadow-lg'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            onClick={() => setTab('play')}
          >
            플레이
          </button>
          <button
            type="button"
            className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition ${
              tab === 'hof'
                ? 'bg-gradient-to-r from-amber-600/90 to-rose-600/80 text-white shadow-lg'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            onClick={() => setTab('hof')}
          >
            명예의 전당
          </button>
        </div>

        {tab === 'play' ? (
          <>
            <section className="mx-auto mt-6 w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/40 px-4 py-4 backdrop-blur-md">
              <h2 className="font-medium text-slate-200">계정</h2>
              {authLoading ? (
                <p className="mt-2 text-sm text-slate-500">확인 중…</p>
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
                    className="w-fit rounded-lg border border-white/15 px-3 py-1.5 text-sm text-slate-300"
                    onClick={() => void signOut()}
                  >
                    로그아웃
                  </button>
                </div>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Link
                    className="rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-md"
                    to="/login"
                  >
                    로그인
                  </Link>
                  <Link
                    className="rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-200"
                    to="/register"
                  >
                    회원가입
                  </Link>
                </div>
              )}
            </section>

            <section className="mx-auto mt-4 w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/40 px-4 py-4 backdrop-blur-md">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-medium text-slate-200">
                  단어 팩 (시트 단위)
                </h2>
                <button
                  type="button"
                  className="text-xs text-cyan-400 underline"
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
                  <code className="text-cyan-300">ncxlxs</code>에 엑셀을 두고
                  manifest에 등록한 뒤 빌드하세요.
                </p>
              ) : (
                <ul className="mt-3 max-h-52 space-y-2 overflow-y-auto text-sm">
                  {packs.map((p) => {
                    const v = p.rows.filter((r) => r.topic && r.explanation).length
                    const ml = maxLevelFromRowCount(v)
                    return (
                      <li key={p.id}>
                        <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-white/10 px-3 py-2 transition has-[:checked]:border-cyan-500/50 has-[:checked]:bg-cyan-950/30">
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
                            <span className="text-slate-100">{p.sheetName}</span>
                            <span className="ml-2 text-xs text-slate-500">
                              ({v}장 · 최대 Lv.{ml}
                              {p.missingColumns.length > 0
                                ? ` · 열 누락 ${p.missingColumns.join(', ')}`
                                : ''}
                              )
                            </span>
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            {user ? (
              <section className="mx-auto mt-4 w-full max-w-md rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/40 to-violet-950/30 px-4 py-5 backdrop-blur-md">
                <h2 className="text-sm font-semibold text-cyan-100">게임 시작</h2>
                <p className="mt-1 text-xs text-slate-500">
                  버튼을 누르면 게임 방법·족보를 확인한 뒤 시작할 수 있습니다.
                </p>
                <button
                  type="button"
                  disabled={!canStart}
                  onClick={openHelp}
                  className="mt-4 w-full rounded-2xl bg-gradient-to-r from-cyan-500 via-sky-500 to-violet-600 py-3.5 text-base font-semibold text-white shadow-lg shadow-cyan-900/30 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {!selectedPack
                    ? '팩을 선택하세요'
                    : maxLv < 1
                      ? '유효한 낱말이 부족합니다'
                      : selectedPack.missingColumns.length > 0
                        ? '열 누락 팩은 시작할 수 없습니다'
                        : '게임 안내 및 시작'}
                </button>
              </section>
            ) : null}
          </>
        ) : (
          <section className="mx-auto mt-6 w-full max-w-md rounded-2xl border border-amber-500/20 bg-slate-900/50 px-4 py-5 backdrop-blur-md">
            <h2 className="text-sm font-semibold text-amber-100">명예의 전당</h2>
            <p className="mt-1 text-xs text-slate-500">
              팩마다 달성한 최고 레벨이 기기에 저장됩니다.
            </p>
            <div className="mt-4">
              {packsLoading ? (
                <p className="text-sm text-slate-500">불러오는 중…</p>
              ) : (
                <HallOfFamePanel packs={packs} />
              )}
            </div>
          </section>
        )}

        <nav className="mx-auto mt-auto flex w-full max-w-md flex-col gap-3 pt-10">
          {isMaster ? (
            <Link
              to="/admin"
              className="rounded-2xl border border-amber-500/30 bg-amber-950/30 px-4 py-3 text-center text-sm font-medium text-amber-100"
            >
              관리자 · 엑셀 미리보기
            </Link>
          ) : null}
        </nav>
      </div>

      <GameHelpModal
        open={helpOpen}
        onClose={closeHelp}
        pack={selectedPack}
        botCount={botCount}
        onBotCountChange={setBotCount}
        onStart={goGame}
      />
    </div>
  )
}

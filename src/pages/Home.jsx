import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  clearRunSave,
  clearStagedResume,
  loadRunSave,
} from '../utils/gameRunSave'
import GameRulesModal from '../components/GameRulesModal'
import JokboModal from '../components/JokboModal'
import HallOfFamePanel from '../components/HallOfFamePanel'
import { useAuth } from '../contexts/AuthContext'
import { useCardPacks } from '../contexts/CardPackContext'
import { DISPLAY_NAME_MAX_LEN, formatHoFDisplayName } from '../utils/displayName'
import { maxLevelFromRowCount } from '../utils/gameRules'

/**
 * 홈 — 로그인·팩 선택·설명/족보 팝업·시작
 */
export default function Home() {
  const navigate = useNavigate()
  const { user, loading: authLoading, signOut, isMaster, updateDisplayName } =
    useAuth()
  const { packs, loading: packsLoading, error: packsError, reloadPacks } =
    useCardPacks()
  const [tab, setTab] = useState(/** @type {'play'|'hof'} */ ('play'))
  const [selectedPackId, setSelectedPackId] = useState(null)
  const [botCount, setBotCount] = useState(1)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [jokboOpen, setJokboOpen] = useState(false)
  const [nameEdit, setNameEdit] = useState('')
  const [nameMsg, setNameMsg] = useState(/** @type {string} */ (''))
  const [nameSaving, setNameSaving] = useState(false)

  useEffect(() => {
    if (user?.displayName) {
      setNameEdit(formatHoFDisplayName(user.displayName))
    } else {
      setNameEdit('')
    }
  }, [user?.displayName])

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

  const savedRun = loadRunSave()
  const canResume =
    !!savedRun &&
    !!effectivePackId &&
    String(savedRun.packId) === String(effectivePackId)

  const goGame = () => {
    if (!effectivePackId || !canStart) return
    clearStagedResume()
    clearRunSave()
    navigate('/game', {
      state: { packId: effectivePackId, botCount },
    })
  }

  const continueGame = () => {
    if (!effectivePackId || !canStart || !savedRun) return
    try {
      sessionStorage.setItem(
        `ncgame-resume-${effectivePackId}`,
        JSON.stringify(savedRun),
      )
    } catch {
      /* noop */
    }
    clearRunSave()
    navigate('/game', {
      state: { packId: effectivePackId, botCount: savedRun.botCount },
    })
  }

  return (
    <div className="game-shell relative min-h-dvh overflow-hidden text-slate-100">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_60%_at_50%_-10%,rgba(56,189,248,0.1),transparent)]"
        aria-hidden
      />

      <div className="relative mx-auto flex min-h-dvh max-w-lg flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
        {/* 상단: 로그인 · 회원가입 (게스트) / 간단 프로필 */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold text-white md:text-2xl">
              가나다 눈치게임
            </h1>
          </div>
          {authLoading ? (
            <span className="text-xs text-slate-500">…</span>
          ) : user ? (
            <div className="flex items-center gap-2">
              <span className="max-w-[140px] truncate text-sm text-slate-300">
                {formatHoFDisplayName(user.displayName)}
              </span>
              <button
                type="button"
                className="rounded-xl border border-white/15 px-3 py-1.5 text-xs text-slate-300"
                onClick={() => void signOut()}
              >
                나가기
              </button>
            </div>
          ) : (
            <div className="flex shrink-0 gap-2">
              <Link
                className="rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-md"
                to="/login"
              >
                로그인
              </Link>
              <Link
                className="rounded-xl border border-white/20 px-4 py-2 text-sm font-medium text-slate-100"
                to="/register"
              >
                회원가입
              </Link>
            </div>
          )}
        </div>

        {user ? (
          <div className="mx-auto mt-4 w-full rounded-2xl border border-white/10 bg-slate-900/45 px-3 py-3 backdrop-blur-sm">
            <p className="text-[11px] text-slate-500">
              명예의 전당 표시 이름 (최대 {DISPLAY_NAME_MAX_LEN}글자)
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                type="text"
                maxLength={DISPLAY_NAME_MAX_LEN}
                value={nameEdit}
                onChange={(e) =>
                  setNameEdit(formatHoFDisplayName(e.target.value))
                }
                className="min-w-[8rem] flex-1 rounded-xl border border-white/15 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500/50"
                autoComplete="nickname"
              />
              <button
                type="button"
                disabled={nameSaving}
                className="shrink-0 rounded-xl bg-gradient-to-r from-cyan-600/90 to-violet-600/80 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                onClick={async () => {
                  setNameMsg('')
                  setNameSaving(true)
                  try {
                    await updateDisplayName(nameEdit)
                    setNameMsg('저장했어요.')
                  } catch (e) {
                    setNameMsg(e?.message ?? '저장에 실패했습니다.')
                  } finally {
                    setNameSaving(false)
                  }
                }}
              >
                {nameSaving ? '…' : '저장'}
              </button>
            </div>
            {nameMsg ? (
              <p className="mt-2 text-xs text-slate-400">{nameMsg}</p>
            ) : null}
          </div>
        ) : null}

        <div className="mx-auto mt-6 flex w-full rounded-2xl border border-white/10 bg-white/5 p-1 backdrop-blur-md">
          <button
            type="button"
            className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition ${
              tab === 'play'
                ? 'bg-gradient-to-r from-cyan-600/90 to-violet-600/90 text-white shadow-lg'
                : 'text-slate-400'
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
                : 'text-slate-400'
            }`}
            onClick={() => setTab('hof')}
          >
            명예의 전당
          </button>
        </div>

        {tab === 'play' ? (
          <>
            <section className="mx-auto mt-5 w-full rounded-2xl border border-white/10 bg-slate-900/50 px-4 py-4 backdrop-blur-md">
              <div className="mb-3 flex items-center justify-end">
                <button
                  type="button"
                  className="text-xs text-cyan-400/90 underline underline-offset-2"
                  onClick={() => void reloadPacks()}
                >
                  새로고침
                </button>
              </div>
              {packsLoading ? (
                <p className="text-sm text-slate-500">불러오는 중…</p>
              ) : packsError ? (
                <p className="text-sm text-amber-200/90">{packsError}</p>
              ) : packs.length === 0 ? (
                <p className="text-sm text-slate-500">등록된 단어 팩이 없습니다.</p>
              ) : (
                <ul className="max-h-52 space-y-2 overflow-y-auto">
                  {packs.map((p) => {
                    const v = p.rows.filter((r) => r.topic && r.explanation).length
                    const ml = maxLevelFromRowCount(v)
                    const broken = p.missingColumns.length > 0
                    return (
                      <li key={p.id}>
                        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 px-3 py-3 transition has-[:checked]:border-cyan-500/50 has-[:checked]:bg-cyan-950/25">
                          <input
                            type="radio"
                            name="pack"
                            className="h-4 w-4 shrink-0"
                            checked={effectivePackId === p.id}
                            onChange={() => setSelectedPackId(p.id)}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-slate-100">{p.sheetName}</p>
                            <p className="text-xs text-slate-500">
                              최대 {ml}단계 · 카드 {v}장
                              {broken ? ' · 설정 필요' : ''}
                            </p>
                          </div>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            {user && packs.length > 0 ? (
              selectedPack &&
              maxLv >= 1 &&
              selectedPack.missingColumns.length === 0 ? (
                <section className="mx-auto mt-4 w-full space-y-3 rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/35 to-violet-950/25 px-4 py-5 backdrop-blur-md">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className="rounded-xl border border-white/15 bg-white/5 py-3 text-sm font-medium text-slate-100"
                      onClick={() => setRulesOpen(true)}
                    >
                      게임 설명서 보기
                    </button>
                    <button
                      type="button"
                      className="rounded-xl border border-white/15 bg-white/5 py-3 text-sm font-medium text-slate-100"
                      onClick={() => setJokboOpen(true)}
                    >
                      족보 보기
                    </button>
                  </div>
                  <div className="flex items-center justify-center gap-4 text-sm text-slate-300">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="bots"
                        checked={botCount === 1}
                        onChange={() => setBotCount(1)}
                      />
                      친구 1명
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="bots"
                        checked={botCount === 2}
                        onChange={() => setBotCount(2)}
                      />
                      친구 2명
                    </label>
                  </div>
                  {canResume ? (
                    <div className="flex w-full flex-col gap-2">
                      <button
                        type="button"
                        disabled={!canStart}
                        onClick={continueGame}
                        className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 py-3.5 text-base font-semibold text-white shadow-lg disabled:opacity-40"
                      >
                        이어하기
                      </button>
                      <button
                        type="button"
                        disabled={!canStart}
                        onClick={goGame}
                        className="w-full rounded-2xl border border-white/20 bg-white/5 py-3 text-base font-semibold text-slate-100 disabled:opacity-40"
                      >
                        새로 시작
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={!canStart}
                      onClick={goGame}
                      className="w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-violet-600 py-3.5 text-base font-semibold text-white shadow-lg disabled:opacity-40"
                    >
                      시작하기
                    </button>
                  )}
                </section>
              ) : (
                <p className="mx-auto mt-6 text-center text-sm text-slate-500">
                  {selectedPack?.missingColumns?.length
                    ? '이 팩은 지금 쓸 수 없어요. 다른 팩을 골라 주세요.'
                    : maxLv < 1
                      ? '이 팩으로는 아직 시작할 수 없어요.'
                      : '단어 팩을 골라 주세요.'}
                </p>
              )
            ) : null}
            {!user ? (
              <p className="mx-auto mt-6 text-center text-sm text-slate-500">
                로그인하면 플레이할 수 있어요.
              </p>
            ) : null}
          </>
        ) : (
          <section className="mx-auto mt-6 w-full rounded-2xl border border-amber-500/20 bg-slate-900/50 px-4 py-5 backdrop-blur-md">
            <h2 className="text-sm font-semibold text-amber-100">명예의 전당</h2>
            <div className="mt-4">
              {packsLoading ? (
                <p className="text-sm text-slate-500">불러오는 중…</p>
              ) : (
                <HallOfFamePanel packs={packs} />
              )}
            </div>
          </section>
        )}

        {isMaster ? (
          <nav className="mx-auto mt-auto w-full pt-8">
            <Link
              to="/admin"
              className="block rounded-2xl border border-amber-500/25 bg-amber-950/20 py-3 text-center text-sm text-amber-100"
            >
              관리자
            </Link>
          </nav>
        ) : (
          <div className="mt-8 flex-1" aria-hidden />
        )}
      </div>

      <GameRulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
      <JokboModal
        open={jokboOpen}
        pack={selectedPack}
        onClose={() => setJokboOpen(false)}
      />
    </div>
  )
}

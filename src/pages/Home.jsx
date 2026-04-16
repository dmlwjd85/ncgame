import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  clearRunSave,
  clearStagedResume,
  loadRunSave,
} from '../utils/gameRunSave'
import GameRulesModal from '../components/GameRulesModal'
import JokboModal from '../components/JokboModal'
import HallOfFamePanel from '../components/HallOfFamePanel'
import ShopPanel from '../components/ShopPanel'
import GuestRecordWarningModal from '../components/GuestRecordWarningModal'
import {
  hasGuestRecordWarningAck,
  setGuestRecordWarningAck,
} from '../utils/guestRecordWarningSession'
import { useAuth } from '../contexts/AuthContext'
import { useCardPacks } from '../contexts/CardPackContext'
import { useUserProgress } from '../contexts/UserProgressContext'
import { prepareGameBootstrap } from '../services/userShopService'
import { DISPLAY_NAME_MAX_LEN, formatHoFDisplayName } from '../utils/displayName'
import { displaySheetName } from '../utils/tutorialPack'
import { maxLevelFromRowCount } from '../utils/gameRules'
import { buildGameLocation } from '../utils/gameRoute'
import { getPracticeComboRecord } from '../utils/hallOfFame'
import { INITIAL_LIVES } from '../utils/userProgressConstants'

/**
 * 홈 — 단어 팩 선택 후 눈치게임/무한도전 분기, 하단 탭은 상점·명예의 전당만
 */
export default function Home() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, loading: authLoading, signOut, isMaster, updateDisplayName } =
    useAuth()
  const { packs, loading: packsLoading, error: packsError, reloadPacks } =
    useCardPacks()
  /** 메인 하단 탭 — 상점·명예의 전당만 */
  const [tab, setTab] = useState(/** @type {'shop' | 'hof'} */ ('shop'))
  /** 단어팩 화면: 허브(팩+눈치) vs 무한도전 모드 선택 */
  const [screen, setScreen] = useState(/** @type {'hub' | 'comboPick'} */ ('hub'))
  /** 선택 팩으로 눈치게임(설명·시작) 패널 펼침 */
  const [nimchiOpen, setNimchiOpen] = useState(false)
  const [selectedPackId, setSelectedPackId] = useState(null)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [jokboOpen, setJokboOpen] = useState(false)
  const [guestWarnOpen, setGuestWarnOpen] = useState(false)
  const [guestPending, setGuestPending] = useState(
    /** @type {'game-new' | 'game-resume' | null} */ (null),
  )
  const [guestPendingCombo, setGuestPendingCombo] = useState(
    /** @type {null | { packId: string, mode: 'challenge' | 'practice' }} */ (
      null
    ),
  )
  const [nameEdit, setNameEdit] = useState('')
  const [nameMsg, setNameMsg] = useState(/** @type {string} */ (''))
  const [nameSaving, setNameSaving] = useState(false)

  const { points: userPoints, refreshProgress } = useUserProgress()

  useEffect(() => {
    void refreshProgress()
  }, [tab, refreshProgress])

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

  const canStartPack =
    selectedPack &&
    maxLv >= 1 &&
    selectedPack.missingColumns.length === 0

  const savedRun = loadRunSave()
  const canResume =
    !!savedRun &&
    !!effectivePackId &&
    String(savedRun.packId) === String(effectivePackId)

  const goGameDirect = async () => {
    if (!effectivePackId || !canStartPack) return
    clearStagedResume()
    clearRunSave()
    const loc = buildGameLocation(effectivePackId)
    let gameBootstrap = {
      startLevel: 1,
      lives: INITIAL_LIVES,
      cheonryan: 1,
    }
    if (user?.uid) {
      try {
        gameBootstrap = await prepareGameBootstrap(user.uid, maxLv)
      } catch {
        /* 폴백 */
      }
    }
    navigate(loc, {
      state: { packId: effectivePackId, botCount: 1, gameBootstrap },
    })
  }

  const goGame = () => {
    if (!effectivePackId || !canStartPack) return
    if (!user && !hasGuestRecordWarningAck()) {
      setGuestPending('game-new')
      setGuestPendingCombo(null)
      setGuestWarnOpen(true)
      return
    }
    void goGameDirect()
  }

  const continueGameDirect = () => {
    if (!effectivePackId || !canStartPack || !savedRun) return
    try {
      sessionStorage.setItem(
        `ncgame-resume-${effectivePackId}`,
        JSON.stringify(savedRun),
      )
    } catch {
      /* noop */
    }
    clearRunSave()
    const loc = buildGameLocation(effectivePackId)
    navigate(loc, {
      state: { packId: effectivePackId, botCount: 1 },
    })
  }

  const continueGame = () => {
    if (!effectivePackId || !canStartPack || !savedRun) return
    if (!user && !hasGuestRecordWarningAck()) {
      setGuestPending('game-resume')
      setGuestPendingCombo(null)
      setGuestWarnOpen(true)
      return
    }
    continueGameDirect()
  }

  const startComboWithMode = (mode) => {
    if (!effectivePackId || !canStartPack) return
    const packId = String(effectivePackId)
    if (!user && !hasGuestRecordWarningAck()) {
      setGuestPending(null)
      setGuestPendingCombo({ packId, mode })
      setGuestWarnOpen(true)
      return
    }
    navigate('/combo-challenge', {
      state: { comboAutoStart: { packId, mode } },
    })
  }

  const practiceRecord =
    effectivePackId != null
      ? getPracticeComboRecord(String(effectivePackId))
      : null

  return (
    <div className="game-shell shell-3d relative flex h-[100dvh] max-h-[100dvh] flex-col overflow-x-hidden overflow-y-hidden text-slate-800">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_55%_at_50%_-8%,rgba(120,100,60,0.12),transparent)]"
        aria-hidden
      />

      <div className="relative mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
        {/* 상단: 로그인 · 회원가입 (게스트) / 간단 프로필 */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="min-w-0">
              <h1 className="font-display truncate text-xl font-bold text-slate-100 md:text-2xl">
                가나다 눈치게임
              </h1>
              {user ? (
                <p className="mt-0.5 text-xs font-medium text-slate-300">
                  보유 포인트{' '}
                  <span className="font-mono text-amber-300">{userPoints}</span> P
                </p>
              ) : null}
            </div>
          </div>
          {authLoading ? (
            <span className="text-xs text-slate-500">…</span>
          ) : user ? (
            <div className="flex items-center gap-2">
              <span className="max-w-[140px] truncate text-sm text-slate-200">
                {formatHoFDisplayName(user.displayName)}
              </span>
              <button
                type="button"
                className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700"
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
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800"
                to="/register"
              >
                회원가입
              </Link>
            </div>
          )}
        </div>

        {user ? (
          <div className="card-lift-3d mx-auto mt-4 w-full rounded-2xl border border-amber-200/90 bg-white/95 px-3 py-3">
            <p className="text-[11px] text-slate-600">
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
                className="min-w-[8rem] flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500"
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
                    const trimmed = nameEdit.trim()
                    const fallback = formatHoFDisplayName(user?.displayName ?? '')
                    const toSave = trimmed || fallback
                    await updateDisplayName(toSave)
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

        <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden">
        {screen === 'comboPick' ? (
          <div className="min-h-0 flex-1 overflow-y-auto [-webkit-overflow-scrolling:touch] pr-0.5">
            <div className="card-lift-3d mx-auto mt-2 w-full rounded-2xl border border-violet-500/40 bg-gradient-to-b from-slate-900/95 to-indigo-950/90 px-4 py-5 text-zinc-100">
              <button
                type="button"
                className="text-sm font-medium text-violet-200 underline underline-offset-2"
                onClick={() => {
                  setScreen('hub')
                }}
              >
                ← 단어 팩 선택으로
              </button>
              <h2 className="font-display mt-3 text-lg font-bold text-violet-100">
                무한도전
              </h2>
              <p className="mt-1 text-sm text-zinc-300">
                팩:{' '}
                <span className="font-semibold text-white">
                  {selectedPack ? displaySheetName(selectedPack) : '—'}
                </span>
              </p>
              <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                모드를 고른 뒤 시작하면 해당 팩으로 바로 플레이 화면으로 이동합니다.
              </p>

              <div className="mt-5 space-y-4">
                <section className="rounded-xl border border-violet-400/35 bg-violet-950/40 px-4 py-4">
                  <h3 className="text-sm font-bold text-violet-100">도전모드</h3>
                  <ul className="mt-2 list-inside list-disc space-y-1.5 text-xs leading-relaxed text-zinc-200">
                    <li>5초 제한, 명예의 전당(도전 최고 연속) 반영.</li>
                    <li>
                      로그인 시 가끔 1~5포인트 도전 팝업(튜토·동물·식물 팩 제외).
                    </li>
                  </ul>
                  <button
                    type="button"
                    disabled={!canStartPack}
                    onClick={() => startComboWithMode('challenge')}
                    className="mt-4 w-full rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-700 py-3 text-sm font-bold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    도전모드로 시작
                  </button>
                </section>

                <section className="rounded-xl border border-emerald-500/35 bg-emerald-950/35 px-4 py-4">
                  <h3 className="text-sm font-bold text-emerald-100">연습모드</h3>
                  <ul className="mt-2 list-inside list-disc space-y-1.5 text-xs leading-relaxed text-zinc-200">
                    <li>시간 제한 없음, 포인트·보상 팝업 없음.</li>
                    <li>연습 최고 연속은 이 기기에만 저장됩니다.</li>
                  </ul>
                  {practiceRecord ? (
                    <p className="mt-2 text-xs font-medium text-emerald-200/90">
                      이 팩 연습 최고 연속:{' '}
                      <span className="font-mono">{practiceRecord.maxCombo}</span>
                    </p>
                  ) : null}
                  <button
                    type="button"
                    disabled={!canStartPack}
                    onClick={() => startComboWithMode('practice')}
                    className="mt-4 w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 py-3 text-sm font-bold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    연습모드로 시작
                  </button>
                </section>
              </div>
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto [-webkit-overflow-scrolling:touch] pr-0.5">
            <section className="card-lift-3d mx-auto mt-2 w-full rounded-2xl border border-slate-200 bg-white/95 px-4 py-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-slate-800">단어 팩</h2>
                <button
                  type="button"
                  className="text-xs text-sky-700 underline underline-offset-2"
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
                <ul className="max-h-[min(42dvh,18rem)] space-y-2 overflow-y-auto">
                  {packs.map((p) => {
                    const v = p.rows.filter((r) => r.topic && r.explanation).length
                    const ml = maxLevelFromRowCount(v)
                    const broken = p.missingColumns.length > 0
                    const playable = ml >= 1 && p.missingColumns.length === 0
                    const sel = effectivePackId === p.id
                    return (
                      <li key={p.id}>
                        <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-2 sm:flex-row sm:items-stretch">
                          <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition has-[:checked]:bg-sky-50">
                            <input
                              type="radio"
                              name="pack"
                              className="h-4 w-4 shrink-0"
                              checked={sel}
                              onChange={() => {
                                setSelectedPackId(p.id)
                                setNimchiOpen(false)
                                setScreen('hub')
                              }}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-slate-900">
                                {displaySheetName(p)}
                              </p>
                              <p className="text-xs text-slate-500">
                                최대 {ml}단계 · 카드 {v}장
                                {broken ? ' · 설정 필요' : ''}
                              </p>
                            </div>
                          </label>
                          {sel && playable ? (
                            <div className="flex shrink-0 flex-col gap-2 sm:w-[11.5rem]">
                              <button
                                type="button"
                                onClick={() => {
                                  setNimchiOpen(true)
                                  setScreen('hub')
                                }}
                                className="rounded-xl bg-gradient-to-r from-cyan-600 to-sky-700 py-2.5 text-xs font-bold text-white shadow-md sm:text-sm"
                              >
                                눈치게임
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setNimchiOpen(false)
                                  setScreen('comboPick')
                                }}
                                className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-800 py-2.5 text-xs font-bold text-white shadow-md sm:text-sm"
                              >
                                무한도전
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            {nimchiOpen && packs.length > 0 ? (
              selectedPack &&
              maxLv >= 1 &&
              selectedPack.missingColumns.length === 0 ? (
                <section className="card-lift-3d mx-auto mt-4 w-full space-y-3 rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-violet-50 px-4 py-5">
                  <p className="text-center text-xs font-semibold text-slate-600">
                    눈치게임 — {displaySheetName(selectedPack)}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className="rounded-xl border border-slate-300 bg-white py-3 text-sm font-medium text-slate-800 shadow-sm"
                      onClick={() => setRulesOpen(true)}
                    >
                      게임 설명서 보기
                    </button>
                    <button
                      type="button"
                      className="rounded-xl border border-slate-300 bg-white py-3 text-sm font-medium text-slate-800 shadow-sm"
                      onClick={() => setJokboOpen(true)}
                    >
                      족보 보기
                    </button>
                  </div>
                  <p className="text-center text-xs text-slate-500">
                    가상 플레이어 1명과 대전합니다.
                  </p>
                  {canResume ? (
                    <div className="flex w-full flex-col gap-2">
                      <button
                        type="button"
                        disabled={!canStartPack}
                        onClick={continueGame}
                        className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 py-3.5 text-base font-semibold text-white shadow-lg disabled:opacity-40"
                      >
                        이어하기
                      </button>
                      <button
                        type="button"
                        disabled={!canStartPack}
                        onClick={goGame}
                        className="w-full rounded-2xl border border-slate-300 bg-white py-3 text-base font-semibold text-slate-800 shadow-sm disabled:opacity-40"
                      >
                        새로 시작
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={!canStartPack}
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
                로그인하면 기록·포인트가 저장돼요. 비로그인으로도 플레이할 수 있어요.
              </p>
            ) : null}

            <div className="tab-rail-3d mx-auto mt-6 grid w-full grid-cols-2 gap-1 rounded-2xl border border-slate-600/80 bg-gradient-to-b from-slate-800/95 to-slate-900/90 p-1">
              <button
                type="button"
                className={`rounded-xl py-2.5 text-xs font-medium transition sm:text-sm ${
                  tab === 'shop'
                    ? 'bg-gradient-to-b from-amber-700 to-rose-900 text-white shadow-[0_4px_0_rgba(120,30,30,0.45),0_8px_20px_rgba(120,20,20,0.3)]'
                    : 'text-slate-400'
                }`}
                onClick={() => setTab('shop')}
              >
                상점
              </button>
              <button
                type="button"
                className={`rounded-xl py-2.5 text-xs font-medium transition sm:text-sm ${
                  tab === 'hof'
                    ? 'bg-gradient-to-b from-amber-600 to-amber-950 text-white shadow-[0_4px_0_rgba(120,80,20,0.45),0_8px_20px_rgba(120,80,20,0.28)]'
                    : 'text-slate-400'
                }`}
                onClick={() => setTab('hof')}
              >
                명예의 전당
              </button>
            </div>

            <div className="mt-3 min-h-0 pb-2">
        {tab === 'shop' ? (
          <div className="min-h-0 flex-1 overflow-y-auto [-webkit-overflow-scrolling:touch] pr-0.5">
            <ShopPanel />
          </div>
        ) : (
          <section className="hof-temple mx-auto flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border px-4 py-4">
            <div className="shrink-0 border-b border-[var(--hof-border)] pb-3">
              <h2 className="font-display text-lg font-bold text-[var(--hof-ink)]">
                명예의 전당
              </h2>
              <p className="athens-subtitle mt-0.5 text-[12px] text-[var(--hof-muted)]">
                Hall of Fame — agōn
              </p>
              <p className="mt-1.5 text-[11px] leading-snug text-[var(--hof-muted)]">
                <span className="font-semibold text-[var(--hof-ink)]">눈치게임</span>은 팩별
                최고 레벨,{' '}
                <span className="font-semibold text-[var(--hof-ink)]">무한도전</span>은 최고
                연속 성공을 각각 올립니다. 동점이면 먼저 달성한 분이 위입니다.
              </p>
            </div>
            <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1 [-webkit-overflow-scrolling:touch]">
              {packsLoading ? (
                <p className="text-sm text-[var(--hof-muted)]">불러오는 중…</p>
              ) : (
                <HallOfFamePanel packs={packs} />
              )}
            </div>
          </section>
        )}
            </div>
          </div>
        )}

        </div>

        {isMaster ? (
          <nav className="mx-auto mt-2 w-full shrink-0 pb-1 pt-4">
            <Link
              to="/admin"
              className="block rounded-2xl border border-amber-300 bg-amber-50 py-3 text-center text-sm text-amber-900"
            >
              관리자
            </Link>
          </nav>
        ) : null}
      </div>

      <GameRulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
      <JokboModal
        open={jokboOpen}
        pack={selectedPack}
        onClose={() => setJokboOpen(false)}
      />

      <GuestRecordWarningModal
        open={guestWarnOpen}
        onClose={() => {
          setGuestWarnOpen(false)
          setGuestPending(null)
          setGuestPendingCombo(null)
        }}
        onGoLogin={() => {
          setGuestWarnOpen(false)
          setGuestPending(null)
          setGuestPendingCombo(null)
          navigate('/login', {
            state: {
              from: {
                pathname: location.pathname,
                search: location.search,
              },
            },
          })
        }}
        onPlayAnyway={() => {
          setGuestRecordWarningAck()
          setGuestWarnOpen(false)
          if (guestPending === 'game-new') {
            void goGameDirect()
          } else if (guestPending === 'game-resume') {
            continueGameDirect()
          } else if (guestPendingCombo) {
            navigate('/combo-challenge', {
              state: {
                comboAutoStart: {
                  packId: guestPendingCombo.packId,
                  mode: guestPendingCombo.mode,
                },
              },
            })
          }
          setGuestPending(null)
          setGuestPendingCombo(null)
        }}
      />
    </div>
  )
}

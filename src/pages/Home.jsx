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
import {
  buildGameLocation,
  NCGAME_HOME_SELECTED_PACK_KEY,
  NCGAME_LAST_PACK_KEY,
} from '../utils/gameRoute'
import {
  createNimchiRoom,
  joinNimchiRoom,
  leaveNimchiRoom,
  normalizeRoomName,
  opponentSeatLabelsFromRoom,
  startNimchiGameSession,
  subscribeNimchiRoom,
} from '../services/nimchiRoomService'
import { getPracticeComboRecord } from '../utils/hallOfFame'
import { INITIAL_LIVES } from '../utils/userProgressConstants'

/**
 * 홈 — 단어 팩·눈치/무한 분기, 상점·명예의 전당은 상단 탭으로 전환(세로 스크롤 축소)
 */
export default function Home() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, loading: authLoading, signOut, isMaster, updateDisplayName } =
    useAuth()
  const { packs, loading: packsLoading, error: packsError, reloadPacks } =
    useCardPacks()
  /** 상단 탭 — 플레이·상점·명예의 전당 */
  const [tab, setTab] = useState(/** @type {'play' | 'shop' | 'hof'} */ ('play'))
  /** hub: 메인 / comboPick: 무한도전 / nimchiPick: 눈치게임(설명·혼자·같이 한 화면) */
  const [screen, setScreen] = useState(
    /** @type {'hub' | 'comboPick' | 'nimchiPick'} */ ('hub'),
  )
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
  /** 멀티 방: 참가 중 방 id(없으면 솔로) */
  const [nimchiJoinedRoomId, setNimchiJoinedRoomId] = useState(
    /** @type {string | null} */ (null),
  )
  const [nimchiRoomDoc, setNimchiRoomDoc] = useState(/** @type {object | null} */ (null))
  const [nimchiRoomDraft, setNimchiRoomDraft] = useState('')
  const [nimchiRoomBusy, setNimchiRoomBusy] = useState(false)
  const [nimchiRoomMsg, setNimchiRoomMsg] = useState('')
  /** 단어 팩 목록 — 팝업에서 고름 */
  const [packPickerOpen, setPackPickerOpen] = useState(false)

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

  useEffect(() => {
    if (!nimchiJoinedRoomId) {
      setNimchiRoomDoc(null)
      return
    }
    const unsub = subscribeNimchiRoom(
      nimchiJoinedRoomId,
      (data) => setNimchiRoomDoc(data),
      () => setNimchiRoomDoc(null),
    )
    return () => unsub()
  }, [nimchiJoinedRoomId])

  /**
   * 방에 gameSession이 올라오면(호스트가 시작) 모든 멤버가 동일 시드로 게임으로 이동합니다.
   * sessionStorage로 같은 시드에 대한 중복 이동(복귀 후 재트리거)을 막습니다.
   */
  useEffect(() => {
    const gs = nimchiRoomDoc?.gameSession
    const roomId = nimchiJoinedRoomId
    if (!gs || roomId == null || !user?.uid || packsLoading || packsError) return
    const rawSeed = gs.seed
    if (rawSeed == null || rawSeed === '') return
    const seed = Number(rawSeed)
    if (!Number.isFinite(seed)) return
    const seedU = seed >>> 0
    const seedStr = String(seedU)
    const storageKey = `nimchi-p2-nav-${roomId}`
    let storedNav = ''
    try {
      storedNav = sessionStorage.getItem(storageKey) ?? ''
    } catch {
      /* storage 비활성 시에도 게임 이동은 시도 */
    }
    if (storedNav === seedStr) return

    const packForGame = String(gs.packId ?? nimchiRoomDoc?.packId ?? '')
    if (!packForGame) return

    const pack = packs.find((p) => p.id === packForGame)
    const validCount = pack
      ? pack.rows.filter((r) => r.topic && r.explanation).length
      : 0
    if (!pack || validCount < 1 || pack.missingColumns.length > 0) return

    const maxLv = maxLevelFromRowCount(validCount)
    const memberCount = Array.isArray(nimchiRoomDoc.memberUids)
      ? nimchiRoomDoc.memberUids.length
      : 1
    const botCount =
      typeof gs.botCount === 'number' && Number.isFinite(gs.botCount)
        ? Math.min(3, Math.max(1, Math.floor(gs.botCount)))
        : Math.min(3, Math.max(1, memberCount - 1))

    let cancelled = false
    ;(async () => {
      let gameBootstrap = {
        startLevel: 1,
        lives: INITIAL_LIVES,
        cheonryan: 1,
      }
      try {
        gameBootstrap = await prepareGameBootstrap(user.uid, maxLv)
      } catch {
        /* 폴백 */
      }
      if (cancelled) return

      try {
        sessionStorage.setItem(storageKey, seedStr)
      } catch {
        /* noop */
      }

      const loc = buildGameLocation(packForGame, botCount)
      const nimchiRoom = {
        roomId: String(nimchiRoomDoc.id ?? roomId),
        opponentSeatLabels: opponentSeatLabelsFromRoom(nimchiRoomDoc, user.uid),
      }
      navigate(loc, {
        state: {
          packId: packForGame,
          botCount,
          gameBootstrap,
          nimchiRoom,
          p2ShuffleSeed: seedU,
        },
      })
    })()

    return () => {
      cancelled = true
    }
  }, [
    nimchiRoomDoc,
    nimchiJoinedRoomId,
    user?.uid,
    packs,
    packsLoading,
    packsError,
    navigate,
  ])

  /** 홈: 마지막으로 고른 팩·최근 플레이 팩 복원 */
  useEffect(() => {
    if (!packs.length || packsLoading) return
    setSelectedPackId((prev) => {
      if (prev != null) return prev
      try {
        const fromHome = localStorage.getItem(NCGAME_HOME_SELECTED_PACK_KEY)
        if (fromHome && packs.some((p) => p.id === fromHome)) return fromHome
        const fromLast = sessionStorage.getItem(NCGAME_LAST_PACK_KEY)
        if (fromLast && packs.some((p) => p.id === fromLast)) return fromLast
      } catch {
        /* noop */
      }
      return packs[0]?.id ?? null
    })
  }, [packs, packsLoading])

  useEffect(() => {
    if (!selectedPackId) return
    try {
      localStorage.setItem(
        NCGAME_HOME_SELECTED_PACK_KEY,
        String(selectedPackId),
      )
    } catch {
      /* noop */
    }
  }, [selectedPackId])

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

    const inRoom =
      !!nimchiJoinedRoomId && !!user?.uid && !!nimchiRoomDoc

    /** 멀티 방: Firestore에 세션만 올리고, 구독 effect가 모두 같은 시드로 이동 */
    if (inRoom) {
      const memberCount = Array.isArray(nimchiRoomDoc.memberUids)
        ? nimchiRoomDoc.memberUids.length
        : 0
      if (memberCount < 2) {
        setNimchiRoomMsg('멀티는 2인 이상일 때 시작할 수 있어요.')
        return
      }
      const packForGame = String(nimchiRoomDoc.packId ?? effectivePackId)
      const botCount = Math.min(3, Math.max(1, memberCount - 1))
      const seed =
        typeof crypto !== 'undefined' && crypto.getRandomValues
          ? crypto.getRandomValues(new Uint32Array(1))[0] >>> 0
          : (Math.floor(Math.random() * 0x100000000) >>> 0)
      setNimchiRoomBusy(true)
      setNimchiRoomMsg('')
      try {
        await startNimchiGameSession(nimchiJoinedRoomId, {
          packId: packForGame,
          botCount,
          seed,
        })
        setNimchiRoomMsg('같은 판으로 이동합니다…')
      } catch (e) {
        setNimchiRoomMsg(e?.message ?? '시작 신호를 보내지 못했습니다.')
      } finally {
        setNimchiRoomBusy(false)
      }
      return
    }

    const packForGame = String(effectivePackId)
    const botCount = 1
    const loc = buildGameLocation(packForGame, botCount)
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
      state: {
        packId: packForGame,
        botCount,
        gameBootstrap,
      },
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
                onClick={() => setScreen('hub')}
              >
                ← 메뉴로
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
        ) : screen === 'nimchiPick' ? (
          <div className="min-h-0 flex-1 overflow-y-auto [-webkit-overflow-scrolling:touch] pr-0.5">
            {selectedPack &&
            maxLv >= 1 &&
            selectedPack.missingColumns.length === 0 &&
            packs.length > 0 ? (
              <div className="card-lift-3d mx-auto mt-2 w-full space-y-3 rounded-2xl border border-sky-300/80 bg-gradient-to-br from-sky-50 via-white to-violet-50 px-4 py-5 shadow-md">
                <button
                  type="button"
                  className="text-sm font-medium text-sky-800 underline underline-offset-2"
                  onClick={() => setScreen('hub')}
                >
                  ← 메뉴로
                </button>
                <h2 className="font-display text-lg font-bold text-slate-900">
                  눈치게임
                </h2>
                <p className="text-sm text-slate-600">
                  팩:{' '}
                  <span className="font-semibold text-slate-900">
                    {displaySheetName(selectedPack)}
                  </span>
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

                <div className="rounded-xl border border-cyan-200 bg-white/95 px-3 py-3">
                  <p className="text-sm font-bold text-slate-900">혼자 시작</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                    가상 상대와 같은 팩으로 진행합니다.
                  </p>
                  {canResume ? (
                    <div className="mt-3 flex w-full flex-col gap-2">
                      <button
                        type="button"
                        disabled={!canStartPack}
                        onClick={continueGame}
                        className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 py-3 text-sm font-semibold text-white shadow-md disabled:opacity-40"
                      >
                        이어하기
                      </button>
                      <button
                        type="button"
                        disabled={!canStartPack}
                        onClick={goGame}
                        className="w-full rounded-2xl border border-slate-300 bg-white py-3 text-sm font-semibold text-slate-800 shadow-sm disabled:opacity-40"
                      >
                        새로 시작
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={!canStartPack}
                      onClick={goGame}
                      className="mt-3 w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-violet-600 py-3.5 text-sm font-semibold text-white shadow-lg disabled:opacity-40"
                    >
                      시작하기
                    </button>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 bg-white/90 px-3 py-3 text-left text-xs text-slate-700">
                  <p className="text-sm font-bold text-slate-900">같이 하기</p>
                  <p className="mt-1 leading-relaxed text-slate-600">
                    로그인 후 방 이름으로 만들거나 참가하세요. 2인 이상이면 시작하기로 같은
                    팩·같은 덱이 열립니다.
                  </p>
                  {user?.uid ? (
                    <div className="mt-3 space-y-2">
                      <input
                        type="text"
                        value={nimchiRoomDraft}
                        onChange={(e) => setNimchiRoomDraft(e.target.value)}
                        placeholder="방 이름"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500"
                        maxLength={24}
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={nimchiRoomBusy || !canStartPack}
                          className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                          onClick={async () => {
                            const n = normalizeRoomName(nimchiRoomDraft)
                            if (!n || !effectivePackId) return
                            setNimchiRoomBusy(true)
                            setNimchiRoomMsg('')
                            try {
                              await createNimchiRoom({
                                name: n,
                                packId: String(effectivePackId),
                                hostUid: user.uid,
                                hostDisplayName: user.displayName ?? '',
                              })
                              setNimchiJoinedRoomId(n)
                              setNimchiRoomMsg('방을 만들었어요.')
                            } catch (e) {
                              setNimchiRoomMsg(
                                e?.message ?? '방 만들기에 실패했습니다.',
                              )
                            } finally {
                              setNimchiRoomBusy(false)
                            }
                          }}
                        >
                          방 만들기
                        </button>
                        <button
                          type="button"
                          disabled={nimchiRoomBusy}
                          className="rounded-lg border border-slate-400 px-3 py-2 text-xs font-semibold text-slate-800 disabled:opacity-40"
                          onClick={async () => {
                            const n = normalizeRoomName(nimchiRoomDraft)
                            if (!n) return
                            setNimchiRoomBusy(true)
                            setNimchiRoomMsg('')
                            try {
                              await joinNimchiRoom(
                                n,
                                user.uid,
                                user.displayName ?? '',
                              )
                              setNimchiJoinedRoomId(n)
                              setNimchiRoomMsg('방에 참가했어요.')
                            } catch (e) {
                              setNimchiRoomMsg(
                                e?.message ?? '참가에 실패했습니다.',
                              )
                            } finally {
                              setNimchiRoomBusy(false)
                            }
                          }}
                        >
                          참가하기
                        </button>
                        {nimchiJoinedRoomId ? (
                          <button
                            type="button"
                            disabled={nimchiRoomBusy}
                            className="rounded-lg border border-rose-400 px-3 py-2 text-xs font-semibold text-rose-800 disabled:opacity-40"
                            onClick={async () => {
                              if (!user?.uid || !nimchiJoinedRoomId) return
                              setNimchiRoomBusy(true)
                              try {
                                await leaveNimchiRoom(
                                  nimchiJoinedRoomId,
                                  user.uid,
                                )
                                try {
                                  sessionStorage.removeItem(
                                    `nimchi-p2-nav-${nimchiJoinedRoomId}`,
                                  )
                                } catch {
                                  /* noop */
                                }
                                setNimchiJoinedRoomId(null)
                                setNimchiRoomMsg('방을 나왔어요.')
                              } catch (e) {
                                setNimchiRoomMsg(
                                  e?.message ?? '나가기에 실패했습니다.',
                                )
                              } finally {
                                setNimchiRoomBusy(false)
                              }
                            }}
                          >
                            방 나가기
                          </button>
                        ) : null}
                      </div>
                      {nimchiJoinedRoomId && nimchiRoomDoc ? (
                        <div className="rounded-lg border border-sky-200 bg-sky-50/80 px-2 py-2 text-[11px] text-sky-950">
                          <p className="font-semibold">
                            방: {nimchiJoinedRoomId} · 인원{' '}
                            {Array.isArray(nimchiRoomDoc.memberUids)
                              ? nimchiRoomDoc.memberUids.length
                              : 0}
                            /4
                          </p>
                          <ul className="mt-1 list-inside list-disc space-y-0.5">
                            {(nimchiRoomDoc.memberUids ?? []).map((uid) => (
                              <li key={uid}>
                                {nimchiRoomDoc.members?.[uid]?.displayName ??
                                  uid}
                                {uid === user.uid ? ' (나)' : ''}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {nimchiRoomMsg ? (
                        <p className="text-[11px] text-slate-600">
                          {nimchiRoomMsg}
                        </p>
                      ) : null}
                      <button
                        type="button"
                        disabled={!canStartPack || nimchiRoomBusy}
                        onClick={goGame}
                        className="mt-2 w-full rounded-2xl bg-gradient-to-r from-violet-600 to-sky-700 py-3 text-sm font-semibold text-white shadow-md disabled:opacity-40"
                      >
                        시작하기
                      </button>
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] text-slate-500">
                      같이 하기는 로그인 후 이용할 수 있어요.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p className="mx-auto mt-6 text-center text-sm text-slate-500">
                {selectedPack?.missingColumns?.length
                  ? '이 팩은 지금 쓸 수 없어요. 다른 팩을 골라 주세요.'
                  : maxLv < 1
                    ? '이 팩으로는 아직 시작할 수 없어요.'
                    : '단어 팩을 먼저 골라 주세요.'}
              </p>
            )}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {/* 상단 탭: 플레이 / 상점 / 명예의 전당 */}
            <div className="tab-rail-3d mx-auto w-full shrink-0 grid grid-cols-3 gap-1 rounded-2xl border border-slate-600/80 bg-gradient-to-b from-slate-800/95 to-slate-900/90 p-1">
              <button
                type="button"
                className={`rounded-xl py-2.5 text-xs font-medium transition sm:text-sm ${
                  tab === 'play'
                    ? 'bg-gradient-to-b from-sky-600 to-sky-950 text-white shadow-[0_4px_0_rgba(20,60,120,0.45),0_8px_20px_rgba(10,30,80,0.28)]'
                    : 'text-slate-400'
                }`}
                onClick={() => setTab('play')}
              >
                플레이
              </button>
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

            {/* 탭 콘텐츠 */}
            <div className="mt-2 min-h-0 flex-1 overflow-y-auto overflow-x-hidden [-webkit-overflow-scrolling:touch] pr-0.5">
              {tab === 'play' ? (
                <section className="card-lift-3d mx-auto w-full rounded-2xl border border-slate-200 bg-white/95 px-4 py-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h2 className="text-sm font-bold text-slate-800">플레이</h2>
                    <button
                      type="button"
                      className="text-xs text-sky-700 underline underline-offset-2"
                      onClick={() => void reloadPacks()}
                    >
                      단어 팩 새로고침
                    </button>
                  </div>

                  {packsLoading ? (
                    <p className="text-sm text-slate-500">불러오는 중…</p>
                  ) : packsError ? (
                    <p className="text-sm text-amber-200/90">{packsError}</p>
                  ) : packs.length === 0 ? (
                    <p className="text-sm text-slate-500">등록된 단어 팩이 없습니다.</p>
                  ) : (
                    <>
                      {!selectedPack ? (
                        <div
                          className="mb-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950"
                          role="status"
                        >
                          <p className="font-bold">처음 오셨나요?</p>
                          <p className="mt-1 text-xs leading-relaxed text-sky-900/80">
                            아래 <span className="font-semibold">단어 팩 선택</span>을 눌러
                            팩을 고른 뒤 시작해 보세요.
                          </p>
                          <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-sky-800">
                            <span aria-hidden className="text-base leading-none">
                              ↘
                            </span>
                            단어 팩을 고르세요
                          </p>
                        </div>
                      ) : null}

                      <div className="rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white px-3 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-800/80">
                          선택한 단어 팩
                        </p>
                        <p className="mt-1 line-clamp-2 text-base font-bold text-slate-900">
                          {selectedPack ? displaySheetName(selectedPack) : '—'}
                        </p>
                        {selectedPack ? (
                          <p className="mt-1 text-xs text-slate-600">
                            최대 {maxLv}단계 · 카드 {validCount}장
                            {selectedPack.missingColumns.length > 0 ? ' · 설정 필요' : ''}
                          </p>
                        ) : null}
                        <button
                          type="button"
                          className="mt-3 w-full rounded-xl border border-sky-500/60 bg-white py-2.5 text-sm font-semibold text-sky-950 shadow-sm transition hover:bg-sky-50"
                          onClick={() => setPackPickerOpen(true)}
                        >
                          단어 팩 선택
                        </button>
                      </div>

                      {canStartPack && selectedPack ? (
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setScreen('nimchiPick')}
                            className="rounded-xl bg-gradient-to-r from-cyan-600 to-sky-700 px-3 py-3 text-left text-white shadow-md"
                          >
                            <p className="text-sm font-extrabold">눈치게임</p>
                            <p className="mt-0.5 text-[11px] leading-snug text-white/85">
                              시간 안에 족보 순서를 맞춰 카드 제출
                            </p>
                          </button>
                          <button
                            type="button"
                            onClick={() => setScreen('comboPick')}
                            className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-800 px-3 py-3 text-left text-white shadow-md"
                          >
                            <p className="text-sm font-extrabold">무한도전</p>
                            <p className="mt-0.5 text-[11px] leading-snug text-white/85">
                              제한 안에서 연속 성공 기록에 도전
                            </p>
                          </button>
                        </div>
                      ) : (
                        <p className="mt-3 text-center text-sm text-slate-500">
                          {selectedPack?.missingColumns?.length
                            ? '이 팩은 지금 쓸 수 없어요. 다른 팩을 골라 주세요.'
                            : maxLv < 1
                              ? '이 팩으로는 아직 시작할 수 없어요.'
                              : '단어 팩을 골라 주세요.'}
                        </p>
                      )}
                    </>
                  )}
                </section>
              ) : tab === 'shop' ? (
                <div className="min-h-0 flex-1">
                  <ShopPanel />
                </div>
              ) : (
                <section className="hof-temple mx-auto flex min-h-[min(70dvh,34rem)] w-full flex-col overflow-hidden rounded-2xl border px-3 py-4 sm:px-5 sm:py-5">
                  <div className="shrink-0 border-b border-[var(--hof-border)] pb-3">
                    <h2 className="font-display text-lg font-bold text-[var(--hof-ink)] sm:text-xl">
                      명예의 전당
                    </h2>
                    <p className="athens-subtitle mt-1 text-xs text-[var(--hof-muted)] sm:text-sm">
                      Hall of Fame — agōn
                    </p>
                    <p className="mt-2 text-[11px] leading-relaxed text-[var(--hof-muted)] sm:text-xs">
                      <span className="font-semibold text-[var(--hof-ink)]">눈치게임</span>
                      은 팩별 최고 레벨,{' '}
                      <span className="font-semibold text-[var(--hof-ink)]">무한도전</span>은
                      최고 연속 성공을 각각 올립니다.
                    </p>
                  </div>
                  <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-0.5 [-webkit-overflow-scrolling:touch]">
                    {packsLoading ? (
                      <p className="text-sm text-[var(--hof-muted)]">불러오는 중…</p>
                    ) : (
                      <HallOfFamePanel packs={packs} />
                    )}
                  </div>
                </section>
              )}

              {!user ? (
                <p className="mx-auto mt-3 text-center text-xs text-slate-500 sm:text-sm">
                  로그인하면 기록·포인트가 저장돼요. 비로그인으로도 플레이할 수 있어요.
                </p>
              ) : null}
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

      {packPickerOpen && packs.length > 0 ? (
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center p-3 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pack-picker-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/55"
            aria-label="팝업 닫기"
            onClick={() => setPackPickerOpen(false)}
          />
          <div className="relative z-10 flex max-h-[min(78dvh,34rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
              <h2
                id="pack-picker-title"
                className="text-sm font-bold text-slate-900"
              >
                단어 팩 선택
              </h2>
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
                onClick={() => setPackPickerOpen(false)}
              >
                닫기
              </button>
            </div>
            <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 py-3 [-webkit-overflow-scrolling:touch]">
              {packs.map((p) => {
                const v = p.rows.filter((r) => r.topic && r.explanation).length
                const ml = maxLevelFromRowCount(v)
                const broken = p.missingColumns.length > 0
                const sel = effectivePackId === p.id
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPackId(p.id)
                        setScreen('hub')
                        setPackPickerOpen(false)
                      }}
                      className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                        sel
                          ? 'border-sky-500 bg-sky-50 ring-1 ring-sky-400/60'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <p className="font-semibold text-slate-900">
                        {displaySheetName(p)}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        최대 {ml}단계 · 카드 {v}장
                        {broken ? ' · 설정 필요' : ''}
                      </p>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      ) : null}

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

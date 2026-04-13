import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCardPacks } from '../contexts/CardPackContext'
import { resolveDisplayNameForHoF } from '../services/authService'
import { addPointsBonus } from '../services/userShopService'
import {
  getPracticeComboRecord,
  saveHallOfFameComboIfBetter,
  savePracticeComboIfBetter,
} from '../utils/hallOfFame'
import { sfxCombo } from '../utils/gameSfx'
import { maxLevelFromRowCount } from '../utils/gameRules'
import {
  displaySheetName,
  isComboPointEligiblePack,
} from '../utils/tutorialPack'
import { usePlayerProgressStore } from '../stores/playerProgressStore'

/** 한 번에 주제어 1개 + 보기(뜻) 3개 — 탭으로 선택 */
const WAVE_SIZE = 1
const MATCH_WINDOW_MS = 5000

function shuffleRows(rows) {
  const a = [...rows]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * 한 주제어(row)에 대해 보기 3칸(정답 1 + 오답 2) 생성 — 포인트 도전 팝업 등에 재사용
 */
function buildExplanationChoiceSlots(targetRow, validRows, idPrefix) {
  if (!targetRow?.id || !validRows?.length) return []
  const correctParts = [
    {
      explanation: String(targetRow.explanation ?? '').trim(),
      correctRowId: String(targetRow.id),
      _p1Filler: false,
    },
  ]
  const excluded = new Set(correctParts.map((c) => c.explanation))
  const pool = shuffleRows(
    validRows.filter((r) => {
      const exp = String(r.explanation ?? '').trim()
      return r.topic && exp && !excluded.has(exp)
    }),
  )
  const distractors = []
  let guard = 0
  while (distractors.length < 2 && guard < 500) {
    guard += 1
    const r = pool.pop()
    if (!r) break
    const exp = String(r.explanation ?? '').trim()
    if (!exp || excluded.has(exp)) continue
    excluded.add(exp)
    distractors.push({
      explanation: exp,
      correctRowId: null,
      _p1Filler: true,
    })
  }
  let fb = 0
  while (distractors.length < 2 && validRows.length > 0) {
    const r = validRows[fb % validRows.length]
    fb += 1
    const exp = String(r?.explanation ?? '').trim()
    if (!exp || excluded.has(exp)) continue
    excluded.add(exp)
    distractors.push({
      explanation: exp,
      correctRowId: null,
      _p1Filler: true,
    })
  }
  const combined = shuffleRows([...correctParts, ...distractors]).slice(0, 3)
  return combined.map((item, i) => ({
    id: `${idPrefix}-${i}`,
    explanation: item.explanation,
    correctRowId: item.correctRowId,
    _p1Filler: item._p1Filler,
  }))
}

/**
 * 무한도전 — 주제어에 맞는 뜻을 3개 중 탭으로 고름. 주제는 매 판 랜덤.
 */
function comboPackPlayable(p) {
  const validRows = p.rows.filter((r) => r.topic && r.explanation)
  const maxLv = maxLevelFromRowCount(validRows.length)
  return (
    maxLv >= 1 && p.missingColumns.length === 0 && validRows.length > 0
  )
}

export default function ComboChallenge() {
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const { packs, loading, error } = useCardPacks()
  const refreshFromServer = usePlayerProgressStore((s) => s.refreshFromServer)

  /** 로비 한 화면 vs 플레이 */
  const [view, setView] = useState(/** @type {'lobby' | 'play'} */ ('lobby'))
  const [lobbyPackId, setLobbyPackId] = useState(/** @type {string | null} */ (null))
  const [lobbyMode, setLobbyMode] = useState(
    /** @type {'challenge' | 'practice'} */ ('challenge'),
  )
  const [playPackId, setPlayPackId] = useState(/** @type {string | null} */ (null))
  const [playMode, setPlayMode] = useState(
    /** @type {'challenge' | 'practice'} */ ('challenge'),
  )

  const isChallenge = playMode === 'challenge'
  const isPractice = playMode === 'practice'

  const pack = useMemo(
    () =>
      playPackId
        ? packs.find((p) => String(p.id) === String(playPackId))
        : null,
    [packs, playPackId],
  )

  const validRows = useMemo(
    () => (pack ? pack.rows.filter((r) => r.topic && r.explanation) : []),
    [pack],
  )

  // URL로 들어온 packId·mode → 로비 초기값 (공유·홈 링크)
  useEffect(() => {
    const id = searchParams.get('packId')
    const m = searchParams.get('mode')
    if (view !== 'lobby') return
    queueMicrotask(() => {
      if (id && packs.length > 0) {
        const exists = packs.some((p) => String(p.id) === String(id))
        if (exists) setLobbyPackId(String(id))
      }
      if (m === 'practice') setLobbyMode('practice')
      else if (m === 'challenge') setLobbyMode('challenge')
    })
  }, [searchParams, packs, view])

  const usedRowIdsRef = useRef(/** @type {Set<string>} */ (new Set()))
  const [queue, setQueue] = useState(/** @type {object[]} */ ([]))
  const [queueReady, setQueueReady] = useState(false)
  const [roundVersion, setRoundVersion] = useState(0)
  const [p1BatchMatchedIds, setP1BatchMatchedIds] = useState(
    () => new Set(),
  )
  const [p1UsedExplanations, setP1UsedExplanations] = useState(
    /** @type {string[]} */ ([]),
  )
  const [p1Collected, setP1Collected] = useState(/** @type {object[]} */ ([]))

  const [combo, setCombo] = useState(0)
  const [bestCombo, setBestCombo] = useState(0)
  const [interlude, setInterlude] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [started, setStarted] = useState(false)
  const [deadline, setDeadline] = useState(() => Date.now() + MATCH_WINDOW_MS)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const p1BatchCompleteFiredRef = useRef(false)
  const comboSyncedRef = useRef(false)
  const practiceSyncedRef = useRef(false)
  /** 도전모드 랜덤 포인트 팝업 */
  const [pointBonus, setPointBonus] = useState(
    /** @type {null | { points: number, row: object, slots: object[] }} */ (
      null
    ),
  )
  const lastBonusAtComboRef = useRef(0)
  const comboRef = useRef(0)

  const cardsNeededThisLevel = WAVE_SIZE
  const need = cardsNeededThisLevel - p1Collected.length

  const refillQueueFromPool = useCallback(() => {
    const used = usedRowIdsRef.current
    let pool = validRows.filter((r) => !used.has(String(r.id)))
    if (pool.length === 0) {
      used.clear()
      pool = validRows
    }
    if (pool.length === 0) return []
    const pick = pool[Math.floor(Math.random() * pool.length)]
    return [pick]
  }, [validRows])

  useEffect(() => {
    if (!pack || queueReady || validRows.length === 0) return
    usedRowIdsRef.current = new Set()
    queueMicrotask(() => {
      setQueue(refillQueueFromPool())
      setQueueReady(true)
    })
  }, [pack, queueReady, validRows, refillQueueFromPool])

  useEffect(() => {
    comboRef.current = combo
  }, [combo])

  const handleP1BatchComplete = useCallback(
    (rows) => {
      const real = rows.filter((r) => !r._p1Filler)
      if (real.length === 0) return
      setP1Collected((c) => {
        const newC = [...c, ...real]
        setQueue((q) => {
          const next = q.slice(real.length)
          real.forEach((r) => usedRowIdsRef.current.add(String(r.id)))
          if (next.length === 0) {
            return refillQueueFromPool()
          }
          return next
        })
        if (newC.length < cardsNeededThisLevel) {
          setRoundVersion((v) => v + 1)
          return newC
        }
        setRoundVersion((v) => v + 1)
        return []
      })
    },
    [cardsNeededThisLevel, refillQueueFromPool],
  )

  useEffect(() => {
    queueMicrotask(() => {
      setP1BatchMatchedIds(new Set())
      setP1UsedExplanations([])
      p1BatchCompleteFiredRef.current = false
    })
  }, [roundVersion])

  const p1Slots = useMemo(() => {
    if (need <= 0 || queue.length === 0) return []
    const batchTake = Math.min(need, queue.length, 3)
    const batchReal = queue
      .slice(0, batchTake)
      .map((r) => ({ ...r, _p1Filler: /** @type {const} */ (false) }))
    const unmatched = batchReal.filter(
      (r) => !p1BatchMatchedIds.has(String(r.id)),
    )
    if (unmatched.length === 0 && batchReal.length > 0) return []

    const correctParts = unmatched.map((r) => ({
      explanation: String(r.explanation ?? '').trim(),
      correctRowId: String(r.id),
      _p1Filler: false,
    }))

    const excluded = new Set([
      ...correctParts.map((c) => c.explanation),
      ...p1UsedExplanations,
    ])

    const pool = shuffleRows(
      validRows.filter((r) => {
        const exp = String(r.explanation ?? '').trim()
        return r.topic && exp && !excluded.has(exp)
      }),
    )

    const distractors = []
    let guard = 0
    while (distractors.length < 3 - correctParts.length && guard < 500) {
      guard += 1
      const r = pool.pop()
      if (!r) break
      const exp = String(r.explanation ?? '').trim()
      if (!exp || excluded.has(exp)) continue
      excluded.add(exp)
      distractors.push({
        explanation: exp,
        correctRowId: null,
        _p1Filler: true,
      })
    }
    let fb = 0
    while (distractors.length < 3 - correctParts.length && validRows.length > 0) {
      const r = validRows[fb % validRows.length]
      fb += 1
      const exp = String(r?.explanation ?? '').trim()
      if (!exp || excluded.has(exp)) continue
      excluded.add(exp)
      distractors.push({
        explanation: exp,
        correctRowId: null,
        _p1Filler: true,
      })
    }

    const combined = shuffleRows([...correctParts, ...distractors]).slice(0, 3)
    return combined.map((item, i) => ({
      id: `combo-tap-${roundVersion}-${i}`,
      explanation: item.explanation,
      correctRowId: item.correctRowId,
      _p1Filler: item._p1Filler,
    }))
  }, [
    need,
    queue,
    validRows,
    roundVersion,
    p1BatchMatchedIds,
    p1UsedExplanations,
  ])

  const p1TopicRows = useMemo(() => {
    if (need <= 0 || queue.length === 0) return []
    const batchTake = Math.min(need, queue.length, 3)
    return queue
      .slice(0, batchTake)
      .map((r) => ({ ...r, _p1Filler: false }))
      .filter((r) => !p1BatchMatchedIds.has(String(r.id)))
  }, [need, queue, p1BatchMatchedIds])

  const handleP1RealMatch = useCallback((row, explanationText) => {
    const t = String(explanationText).trim()
    setP1UsedExplanations((prev) => (prev.includes(t) ? prev : [...prev, t]))
    setP1BatchMatchedIds((prev) => {
      const next = new Set(prev)
      next.add(String(row.id))
      return next
    })
  }, [])

  useEffect(() => {
    if (!queueReady || need <= 0) return
    const batchTake = Math.min(need, queue.length, 3)
    if (batchTake === 0) return
    const batch = queue.slice(0, batchTake)
    if (p1BatchMatchedIds.size < batchTake) return
    const allDone = batch.every((r) => p1BatchMatchedIds.has(String(r.id)))
    if (!allDone || p1BatchCompleteFiredRef.current) return
    p1BatchCompleteFiredRef.current = true
    handleP1BatchComplete(batch.map((r) => ({ ...r, _p1Filler: false })))
  }, [
    queueReady,
    need,
    queue,
    p1BatchMatchedIds,
    handleP1BatchComplete,
  ])

  const onMatchAttempt = useCallback(
    (ok) => {
      if (!started || gameOver || interlude) return
      if (ok) {
        setInterlude(true)
        setCombo((c) => {
          const n = c + 1
          setBestCombo((b) => Math.max(b, n))
          sfxCombo(n)
          return n
        })
      } else {
        setGameOver(true)
      }
    },
    [started, gameOver, interlude],
  )

  const onPickExplanation = useCallback(
    (explanation) => {
      if (!started || gameOver || interlude) return
      const row = queue[0]
      if (!row || !p1Slots.length) return
      const exp = String(explanation).trim()
      const slot = p1Slots.find((s) => String(s.explanation).trim() === exp)
      const ok =
        slot != null &&
        slot.correctRowId != null &&
        String(slot.correctRowId) === String(row.id)
      if (ok) {
        handleP1RealMatch(row, exp)
        onMatchAttempt(true)
      } else {
        onMatchAttempt(false)
      }
    },
    [
      started,
      gameOver,
      interlude,
      queue,
      p1Slots,
      handleP1RealMatch,
      onMatchAttempt,
    ],
  )

  // 연속 성공 후 1초 딜레이 — 끝나면 도전모드에서 랜덤 포인트 팝업 시도 또는 다음 타이머
  useEffect(() => {
    if (!interlude) return
    const id = window.setTimeout(() => {
      setInterlude(false)
      const t = Date.now()
      setNowMs(t)
      const c = comboRef.current

      const canOfferPointBonus =
        isChallenge &&
        user?.uid &&
        pack &&
        isComboPointEligiblePack(pack) &&
        validRows.length > 0 &&
        c >= 2 &&
        c - lastBonusAtComboRef.current >= 2 &&
        Math.random() < 0.28

      if (canOfferPointBonus) {
        const row = validRows[Math.floor(Math.random() * validRows.length)]
        const slots = buildExplanationChoiceSlots(row, validRows, `pb-${t}`)
        if (slots.length >= 3 && row) {
          lastBonusAtComboRef.current = c
          const points = 1 + Math.floor(Math.random() * 5)
          setPointBonus({ points, row, slots })
          return
        }
      }

      if (isChallenge) {
        setDeadline(t + MATCH_WINDOW_MS)
      } else {
        setDeadline(Number.POSITIVE_INFINITY)
      }
    }, 1000)
    return () => window.clearTimeout(id)
  }, [interlude, isChallenge, user, pack, validRows])

  useEffect(() => {
    if (!started || gameOver || interlude || pointBonus) return
    if (isPractice) return
    const id = window.setInterval(() => {
      const t = Date.now()
      setNowMs(t)
      if (t > deadline) setGameOver(true)
    }, 100)
    return () => window.clearInterval(id)
  }, [started, gameOver, interlude, deadline, pointBonus, isPractice])

  const dismissPointBonusAndResume = useCallback(() => {
    setPointBonus(null)
    const t = Date.now()
    setNowMs(t)
    if (isChallenge) {
      setDeadline(t + MATCH_WINDOW_MS)
    } else {
      setDeadline(Number.POSITIVE_INFINITY)
    }
  }, [isChallenge])

  const onPickPointBonus = useCallback(
    (explanation) => {
      if (!pointBonus || !user?.uid) {
        dismissPointBonusAndResume()
        return
      }
      const exp = String(explanation).trim()
      const slot = pointBonus.slots.find(
        (s) => String(s.explanation).trim() === exp,
      )
      const ok =
        slot != null &&
        slot.correctRowId != null &&
        String(slot.correctRowId) === String(pointBonus.row.id)
      if (ok) {
        const pts = pointBonus.points
        void addPointsBonus(user.uid, pts).then(() =>
          refreshFromServer(user.uid),
        )
      }
      dismissPointBonusAndResume()
    },
    [pointBonus, user, refreshFromServer, dismissPointBonusAndResume],
  )

  useEffect(() => {
    if (!gameOver || !pack || !user?.uid || !isChallenge) return
    if (comboSyncedRef.current) return
    const bc = bestCombo
    if (bc < 1) return
    comboSyncedRef.current = true
    void (async () => {
      try {
        const name = await resolveDisplayNameForHoF(user)
        await saveHallOfFameComboIfBetter(pack.id, bc, name, { uid: user.uid })
      } catch {
        /* noop */
      }
    })()
  }, [gameOver, pack, user, bestCombo, isChallenge])

  useEffect(() => {
    if (!gameOver || !pack || isChallenge) return
    if (practiceSyncedRef.current) return
    const bc = bestCombo
    if (bc < 1) return
    practiceSyncedRef.current = true
    queueMicrotask(() => {
      savePracticeComboIfBetter(String(pack.id), bc)
    })
  }, [gameOver, pack, bestCombo, isChallenge])

  useEffect(() => {
    if (!gameOver) {
      comboSyncedRef.current = false
      practiceSyncedRef.current = false
    }
  }, [gameOver])

  const maxLv = maxLevelFromRowCount(validRows.length)
  const canPlay =
    pack && maxLv >= 1 && pack.missingColumns.length === 0 && validRows.length > 0

  const topicRow = p1TopicRows[0]
  const topicText = topicRow
    ? String(topicRow.topic ?? '').trim() || '—'
    : ''

  const playablePacks = useMemo(
    () => packs.filter(comboPackPlayable),
    [packs],
  )

  const practiceRecordLobby =
    lobbyPackId != null
      ? getPracticeComboRecord(String(lobbyPackId))
      : null

  const beginPlaySession = useCallback(() => {
    if (!lobbyPackId) return
    const p = packs.find((x) => String(x.id) === String(lobbyPackId))
    if (!p) return
    const vr = p.rows.filter((r) => r.topic && r.explanation)
    const ml = maxLevelFromRowCount(vr.length)
    if (ml < 1 || p.missingColumns.length > 0 || vr.length === 0) return

    setPlayPackId(String(lobbyPackId))
    setPlayMode(lobbyMode)
    setView('play')
    setStarted(true)
    queueMicrotask(() => {
      usedRowIdsRef.current = new Set()
      p1BatchCompleteFiredRef.current = false
      comboSyncedRef.current = false
      practiceSyncedRef.current = false
      lastBonusAtComboRef.current = 0
      setQueue([])
      setQueueReady(false)
      setRoundVersion((v) => v + 1)
      setP1BatchMatchedIds(new Set())
      setP1UsedExplanations([])
      setP1Collected([])
      setCombo(0)
      setBestCombo(0)
      setInterlude(false)
      setGameOver(false)
      setPointBonus(null)
      const t = Date.now()
      setNowMs(t)
      if (lobbyMode === 'challenge') {
        setDeadline(t + MATCH_WINDOW_MS)
      } else {
        setDeadline(Number.POSITIVE_INFINITY)
      }
    })
  }, [lobbyPackId, lobbyMode, packs])

  const returnToLobby = useCallback(() => {
    setView('lobby')
    setPlayPackId(null)
    setStarted(false)
    setInterlude(false)
    setGameOver(false)
    setCombo(0)
    setBestCombo(0)
    usedRowIdsRef.current = new Set()
    setP1Collected([])
    setRoundVersion((v) => v + 1)
    setQueueReady(false)
    setQueue([])
    setPointBonus(null)
    lastBonusAtComboRef.current = 0
    setDeadline(Date.now() + MATCH_WINDOW_MS)
  }, [])

  if (loading) {
    return (
      <div className="game-shell flex min-h-dvh items-center justify-center text-zinc-200">
        불러오는 중…
      </div>
    )
  }

  if (error) {
    return (
      <div className="game-shell flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center text-zinc-200">
        <p>팩을 불러오지 못했어요.</p>
        <Link className="text-sky-300 underline underline-offset-2" to="/">
          홈으로
        </Link>
      </div>
    )
  }

  // ——— 로비: 팩 + 모드 + 시작하기 한 화면 ———
  if (view === 'lobby') {
    return (
      <div className="game-shell combo-lobby min-h-dvh px-4 pb-8 pt-4 text-zinc-100">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
          <header className="flex flex-wrap items-center justify-between gap-2">
            <Link
              to="/"
              className="text-sm font-medium text-sky-300 underline underline-offset-2"
            >
              ← 홈
            </Link>
            <span className="text-xs font-medium text-zinc-300">무한도전</span>
          </header>

          <div>
            <h1 className="font-display text-xl font-bold text-violet-200">
              무한도전
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-200">
              단어팩과 모드를 고른 뒤{' '}
              <span className="font-semibold text-amber-200">시작하기</span>를 누르면
              바로 플레이 화면으로 넘어갑니다.
            </p>
          </div>

          <section className="rounded-2xl border border-zinc-600/80 bg-zinc-900/75 p-4 shadow-lg">
            <h2 className="text-sm font-bold text-zinc-50">1. 단어팩</h2>
            {playablePacks.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-200">
                지금 도전 가능한 팩이 없어요. 홈에서 엑셀 구성을 확인해 주세요.
              </p>
            ) : (
              <ul className="mt-3 max-h-[min(42dvh,20rem)] space-y-2 overflow-y-auto pr-1 [-webkit-overflow-scrolling:touch]">
                {playablePacks.map((p) => {
                  const sel = String(lobbyPackId) === String(p.id)
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => setLobbyPackId(String(p.id))}
                        className={`flex w-full rounded-xl border-2 px-3 py-3 text-left text-sm font-semibold transition ${
                          sel
                            ? 'border-violet-400 bg-violet-950/50 text-zinc-50 ring-2 ring-violet-400/40'
                            : 'border-zinc-600/90 bg-zinc-950/40 text-zinc-100 hover:border-zinc-500'
                        }`}
                      >
                        {displaySheetName(p)}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-zinc-600/80 bg-zinc-900/75 p-4 shadow-lg">
            <h2 className="text-sm font-bold text-zinc-50">2. 모드</h2>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setLobbyMode('challenge')}
                className={`flex-1 rounded-xl py-3 text-sm font-semibold ${
                  lobbyMode === 'challenge'
                    ? 'bg-violet-600 text-white ring-2 ring-violet-300/80'
                    : 'border border-zinc-600 bg-zinc-950/50 text-zinc-100 hover:bg-zinc-800/80'
                }`}
              >
                도전모드
              </button>
              <button
                type="button"
                onClick={() => setLobbyMode('practice')}
                className={`flex-1 rounded-xl py-3 text-sm font-semibold ${
                  lobbyMode === 'practice'
                    ? 'bg-emerald-600 text-white ring-2 ring-emerald-300/80'
                    : 'border border-zinc-600 bg-zinc-950/50 text-zinc-100 hover:bg-zinc-800/80'
                }`}
              >
                연습모드
              </button>
            </div>
            <ul className="mt-3 list-inside list-disc space-y-1.5 text-xs leading-relaxed text-zinc-200">
              {lobbyMode === 'challenge' ? (
                <>
                  <li>5초 제한, 명예의 전당(도전 최고 연속) 반영.</li>
                  <li>
                    로그인 시 가끔 1~5포인트 도전 팝업(튜토·동물·식물 팩 제외).
                  </li>
                </>
              ) : (
                <>
                  <li>시간 제한 없음, 포인트·보상 팝업 없음.</li>
                  <li>연습 최고 연속은 이 기기에만 저장됩니다.</li>
                </>
              )}
            </ul>
            {lobbyMode === 'practice' && practiceRecordLobby ? (
              <p className="mt-2 text-xs font-medium text-emerald-200">
                선택한 팩 연습 최고 연속:{' '}
                <span className="font-mono">{practiceRecordLobby.maxCombo}</span>
              </p>
            ) : null}
          </section>

          <button
            type="button"
            disabled={!lobbyPackId || playablePacks.length === 0}
            className="w-full rounded-2xl bg-gradient-to-r from-amber-600 to-rose-700 py-4 text-base font-bold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-45"
            onClick={() => beginPlaySession()}
          >
            시작하기
          </button>
        </div>
      </div>
    )
  }

  // ——— 플레이: 잘못된 팩 방어 ———
  if (!pack || !canPlay) {
    return (
      <div className="game-shell flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center text-zinc-200">
        <p>이 팩으로 진행할 수 없어요.</p>
        <button
          type="button"
          className="text-violet-300 underline"
          onClick={() => returnToLobby()}
        >
          설정으로 돌아가기
        </button>
        <Link className="text-sky-300 underline" to="/">
          홈으로
        </Link>
      </div>
    )
  }

  const secLeft =
    isChallenge && Number.isFinite(deadline)
      ? Math.max(0, (deadline - nowMs) / 1000)
      : null

  return (
    <div className="game-shell min-h-dvh px-4 pb-8 pt-4 text-zinc-100">
      <div className="mx-auto w-full max-w-lg">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/"
              className="text-sm font-medium text-sky-300 underline underline-offset-2"
            >
              ← 홈
            </Link>
            <button
              type="button"
              onClick={() => returnToLobby()}
              className="text-sm font-medium text-zinc-200 underline decoration-zinc-500 underline-offset-2 hover:text-white"
            >
              팩·모드 변경
            </button>
          </div>
          <div className="text-right text-xs text-zinc-200">
            <p className="font-semibold text-zinc-50">{displaySheetName(pack)}</p>
            <p>
              <span className="text-zinc-300">무한도전</span>
              {' · '}
              <span className="font-medium text-violet-200">
                {isPractice ? '연습' : '도전'}
              </span>
            </p>
          </div>
        </header>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-500/70 bg-zinc-900/70 px-4 py-3">
          <div>
            <p className="text-[11px] font-medium text-zinc-200">연속 성공</p>
            <p className="font-mono text-2xl font-bold text-amber-300">{combo}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-medium text-zinc-200">남은 시간</p>
            <p className="font-mono text-xl text-sky-300">
              {!isChallenge
                ? '∞'
                : started && !gameOver
                  ? interlude
                    ? '…'
                    : pointBonus
                      ? '…'
                      : `${secLeft != null ? secLeft.toFixed(1) : '—'}초`
                  : '—'}
            </p>
          </div>
        </div>

        {gameOver ? (
          <div className="rounded-2xl border border-zinc-600 bg-zinc-900/60 p-6 text-center">
            <p className="text-lg font-bold text-zinc-50">종료</p>
            <p className="mt-2 text-zinc-100">
              이번 최고 연속{' '}
              <span className="font-mono text-amber-300">{bestCombo}</span>
            </p>
            {isPractice ? (
              <p className="mt-1 text-xs text-emerald-200">
                연습 기록은 이 기기에만 저장됩니다.
              </p>
            ) : null}
            <button
              type="button"
              className="mt-4 w-full rounded-2xl border border-zinc-500 bg-zinc-800/80 py-3 font-medium text-zinc-50"
              onClick={() => {
                setStarted(false)
                setInterlude(false)
                setGameOver(false)
                setCombo(0)
                setBestCombo(0)
                usedRowIdsRef.current = new Set()
                setP1Collected([])
                setRoundVersion((v) => v + 1)
                setQueueReady(false)
                setQueue([])
                setPointBonus(null)
                lastBonusAtComboRef.current = 0
                const t = Date.now()
                if (isChallenge) {
                  setDeadline(t + MATCH_WINDOW_MS)
                } else {
                  setDeadline(Number.POSITIVE_INFINITY)
                }
                setNowMs(t)
                setStarted(true)
              }}
            >
              다시 도전
            </button>
            <button
              type="button"
              className="mt-3 w-full rounded-2xl border border-violet-500/50 py-2.5 text-sm font-medium text-violet-200"
              onClick={() => returnToLobby()}
            >
              팩·모드 다시 고르기
            </button>
            <Link
              className="mt-3 block text-sm text-sky-300 underline"
              to="/"
            >
              홈으로
            </Link>
          </div>
        ) : interlude ? (
          <div
            className="combo-hit-overlay !items-center !justify-center !pt-0"
            aria-live="polite"
            aria-label={`연속 ${combo}`}
          >
            <div key={combo} className="combo-hit-burst">
              <span className="combo-hit-num">{combo}</span>
              <span className="combo-hit-label">연속</span>
            </div>
          </div>
        ) : pointBonus ? (
          <div
            className="relative rounded-2xl border-2 border-amber-400/90 bg-gradient-to-b from-amber-950/95 to-zinc-950/95 p-4 shadow-xl shadow-amber-900/40"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pt-bonus-title"
          >
            <p
              id="pt-bonus-title"
              className="text-center text-base font-black text-amber-200"
            >
              {pointBonus.points}포인트 도전!
            </p>
            <p className="mt-1 text-center text-[11px] text-amber-100/95">
              맞추면 포인트가 지급됩니다
            </p>
            <p className="mt-4 text-center text-[11px] font-semibold uppercase tracking-wide text-zinc-200">
              주제어
            </p>
            <p className="mt-1 min-h-[2.5rem] text-center text-lg font-bold leading-snug text-amber-50">
              {String(pointBonus.row.topic ?? '').trim() || '—'}
            </p>
            <p className="mt-3 text-center text-[11px] text-zinc-200">
              맞는 뜻을 고르세요
            </p>
            <ul className="mt-2 flex flex-col gap-2">
              {pointBonus.slots.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className="w-full rounded-xl border border-amber-500/60 bg-zinc-800/95 px-4 py-3.5 text-left text-base font-medium leading-snug text-zinc-50 transition hover:border-amber-300 hover:bg-zinc-700/95 active:scale-[0.99]"
                    onClick={() => onPickPointBonus(s.explanation)}
                  >
                    {s.explanation}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-600 bg-zinc-900/75 p-4">
            <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-zinc-200">
              주제어
            </p>
            <p className="mt-2 min-h-[3rem] text-center text-xl font-bold leading-snug text-amber-100">
              {topicText || '…'}
            </p>
            <p className="mt-4 text-center text-[11px] text-zinc-200">
              맞는 뜻을 고르세요
            </p>
            <ul className="mt-2 flex flex-col gap-2">
              {p1Slots.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className="w-full rounded-xl border border-zinc-500 bg-zinc-800/95 px-4 py-3.5 text-left text-base font-medium leading-snug text-zinc-50 transition hover:border-amber-400/70 hover:bg-zinc-700/95 active:scale-[0.99]"
                    onClick={() => onPickExplanation(s.explanation)}
                  >
                    {s.explanation}
                  </button>
                </li>
              ))}
            </ul>
            {p1Slots.length === 0 && topicText ? (
              <p className="mt-3 text-center text-xs text-zinc-300">
                다음 문제 준비 중…
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

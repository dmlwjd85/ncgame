import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
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
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const packId = searchParams.get('packId')
  const playMode =
    searchParams.get('mode') === 'practice' ? 'practice' : 'challenge'
  const isChallenge = playMode === 'challenge'
  const isPractice = playMode === 'practice'

  const { user } = useAuth()
  const { packs, loading, error } = useCardPacks()
  const refreshFromServer = usePlayerProgressStore((s) => s.refreshFromServer)

  const setPlayModeParam = useCallback(
    (next) => {
      if (!packId) return
      const p = new URLSearchParams(searchParams)
      p.set('packId', String(packId))
      if (next === 'practice') p.set('mode', 'practice')
      else p.delete('mode')
      setSearchParams(p, { replace: true })
    },
    [packId, searchParams, setSearchParams],
  )

  const pack = useMemo(
    () => packs.find((p) => String(p.id) === String(packId)),
    [packs, packId],
  )

  const validRows = useMemo(
    () => (pack ? pack.rows.filter((r) => r.topic && r.explanation) : []),
    [pack],
  )

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

  // URL의 packId가 바뀌면 진행 상태 초기화 (다른 팩으로 전환)
  useEffect(() => {
    usedRowIdsRef.current = new Set()
    p1BatchCompleteFiredRef.current = false
    comboSyncedRef.current = false
    practiceSyncedRef.current = false
    lastBonusAtComboRef.current = 0
    queueMicrotask(() => {
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
      setStarted(false)
      setPointBonus(null)
      setDeadline(Date.now() + MATCH_WINDOW_MS)
      setNowMs(Date.now())
    })
  }, [packId])

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

  // 연습 최고 기록 표시용 — gameOver 시 갱신
  const practiceRecordDisplay = packId
    ? getPracticeComboRecord(String(packId))
    : null

  if (!packId) {
    if (loading) {
      return (
        <div className="game-shell flex min-h-dvh items-center justify-center text-slate-300">
          불러오는 중…
        </div>
      )
    }
    if (error) {
      return (
        <div className="game-shell flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center text-slate-300">
          <p>팩을 불러오지 못했어요.</p>
          <Link className="text-sky-400 underline" to="/">
            홈으로
          </Link>
        </div>
      )
    }
    return (
      <div className="game-shell min-h-dvh px-4 pb-8 pt-4 text-slate-200">
        <div className="mx-auto w-full max-w-lg">
          <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <Link
              to="/"
              className="text-sm text-sky-400 underline underline-offset-2"
            >
              ← 홈
            </Link>
            <span className="text-xs text-slate-400">무한도전</span>
          </header>
          <h1 className="font-display text-lg font-bold text-violet-200">
            단어팩 선택
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            도전할 단어팩을 고른 뒤 규칙 화면에서 도전/연습을 고르고 시작하세요.
            목록 순서는 눈치게임과 같습니다(따라하기 팩이 맨 위).
          </p>
          {playablePacks.length === 0 ? (
            <p className="mt-6 text-center text-sm text-slate-500">
              지금 도전 가능한 팩이 없어요. 홈에서 엑셀 구성을 확인해 주세요.
            </p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {playablePacks.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="w-full rounded-2xl border border-violet-500/40 bg-slate-900/70 px-4 py-3.5 text-left text-sm font-semibold text-slate-100 transition hover:border-violet-400/70 hover:bg-slate-800/80"
                    onClick={() =>
                      navigate(
                        `/combo-challenge?packId=${encodeURIComponent(String(p.id))}`,
                      )
                    }
                  >
                    {displaySheetName(p)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="game-shell flex min-h-dvh items-center justify-center text-slate-300">
        불러오는 중…
      </div>
    )
  }

  if (error || !pack || !canPlay) {
    return (
      <div className="game-shell flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center text-slate-300">
        <p>이 팩으로 도전할 수 없어요.</p>
        <Link className="text-violet-300 underline" to="/combo-challenge">
          단어팩 다시 고르기
        </Link>
        <Link className="text-sky-400 underline" to="/">
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
    <div className="game-shell min-h-dvh px-4 pb-8 pt-4 text-slate-200">
      <div className="mx-auto w-full max-w-lg">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <Link
            to="/"
            className="text-sm text-sky-400 underline underline-offset-2"
          >
            ← 홈
          </Link>
          <div className="text-right text-xs text-slate-400">
            <p className="font-medium text-slate-100">{displaySheetName(pack)}</p>
            <p>
              무한도전 ·{' '}
              <span className="text-violet-300">
                {isPractice ? '연습모드' : '도전모드'}
              </span>
            </p>
          </div>
        </header>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-600/80 bg-slate-900/60 px-4 py-3">
          <div>
            <p className="text-[11px] text-slate-400">연속 성공</p>
            <p className="font-mono text-2xl font-bold text-amber-300">{combo}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-slate-400">남은 시간</p>
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

        {!started ? (
          <div className="rounded-2xl border border-slate-600 bg-slate-900/50 p-5 text-sm leading-relaxed text-slate-300">
            <p className="font-semibold text-slate-100">모드</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setPlayModeParam('challenge')}
                className={`flex-1 rounded-xl py-2.5 text-xs font-semibold ${
                  isChallenge
                    ? 'bg-violet-600 text-white ring-2 ring-violet-400'
                    : 'border border-slate-600 bg-slate-800/80 text-slate-300'
                }`}
              >
                도전모드
              </button>
              <button
                type="button"
                onClick={() => setPlayModeParam('practice')}
                className={`flex-1 rounded-xl py-2.5 text-xs font-semibold ${
                  isPractice
                    ? 'bg-emerald-700 text-white ring-2 ring-emerald-500'
                    : 'border border-slate-600 bg-slate-800/80 text-slate-300'
                }`}
              >
                연습모드
              </button>
            </div>
            <p className="mt-4 font-semibold text-slate-100">규칙</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-xs">
              <li>주제어에 맞는 뜻을 세 가지 중 하나를 눌러 고릅니다. 주제는 매 판 랜덤입니다.</li>
              {isChallenge ? (
                <>
                  <li>5초 안에 맞추면 타이머가 다시 5초로 갱신됩니다.</li>
                  <li>오답이거나 시간이 0이 되면 종료입니다. 명예의 전당(도전 최고 연속)에 반영됩니다.</li>
                  <li>
                    로그인 시, 도전 중 가끔 1~5포인트 도전! 팝업이 뜹니다(튜토·동물·식물 팩
                    제외). 맞추면 포인트가 지급됩니다.
                  </li>
                </>
              ) : (
                <>
                  <li>시간 제한 없이 연습합니다. 포인트·도전 보상 팝업은 없습니다.</li>
                  <li>오답 시에만 종료합니다. 연습 최고 연속은 이 기기에만 저장됩니다.</li>
                </>
              )}
            </ul>
            {isPractice && practiceRecordDisplay ? (
              <p className="mt-3 text-xs text-emerald-300/90">
                이 팩 연습 최고 연속:{' '}
                <span className="font-mono font-bold">
                  {practiceRecordDisplay.maxCombo}
                </span>
              </p>
            ) : null}
            <button
              type="button"
              className="mt-4 w-full rounded-2xl bg-gradient-to-r from-amber-700 to-rose-800 py-3 text-base font-semibold text-white shadow-lg"
              onClick={() => {
                const t = Date.now()
                setStarted(true)
                setInterlude(false)
                setPointBonus(null)
                lastBonusAtComboRef.current = 0
                if (isChallenge) {
                  setDeadline(t + MATCH_WINDOW_MS)
                } else {
                  setDeadline(Number.POSITIVE_INFINITY)
                }
                setNowMs(t)
                setGameOver(false)
                setCombo(0)
              }}
            >
              시작
            </button>
            <Link
              className="mt-3 block text-center text-sm text-violet-300 underline underline-offset-2"
              to="/combo-challenge"
            >
              다른 단어팩 고르기
            </Link>
          </div>
        ) : gameOver ? (
          <div className="rounded-2xl border border-slate-600 bg-slate-900/50 p-6 text-center">
            <p className="text-lg font-bold text-slate-100">종료</p>
            <p className="mt-2 text-slate-300">
              이번 최고 연속{' '}
              <span className="font-mono text-amber-300">{bestCombo}</span>
            </p>
            {isPractice ? (
              <p className="mt-1 text-xs text-emerald-300/90">
                연습 기록은 이 기기에만 저장되며, 명예의 전당에는 올라가지 않습니다.
              </p>
            ) : null}
            <button
              type="button"
              className="mt-4 w-full rounded-2xl border border-slate-500 py-3 text-slate-200"
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
                setDeadline(Date.now() + MATCH_WINDOW_MS)
              }}
            >
              다시 도전
            </button>
            <Link
              className="mt-3 block text-sm text-sky-400 underline"
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
            className="relative rounded-2xl border-2 border-amber-400/90 bg-gradient-to-b from-amber-950/95 to-slate-900/95 p-4 shadow-xl shadow-amber-900/40"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pt-bonus-title"
          >
            <p
              id="pt-bonus-title"
              className="text-center text-base font-black text-amber-300"
            >
              {pointBonus.points}포인트 도전!
            </p>
            <p className="mt-1 text-center text-[11px] text-amber-200/90">
              맞추면 포인트가 지급됩니다
            </p>
            <p className="mt-4 text-center text-[11px] font-medium uppercase tracking-wide text-slate-400">
              주제어
            </p>
            <p className="mt-1 min-h-[2.5rem] text-center text-lg font-bold leading-snug text-amber-100">
              {String(pointBonus.row.topic ?? '').trim() || '—'}
            </p>
            <p className="mt-3 text-center text-[11px] text-slate-500">
              맞는 뜻을 고르세요
            </p>
            <ul className="mt-2 flex flex-col gap-2">
              {pointBonus.slots.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className="w-full rounded-xl border border-amber-600/50 bg-slate-800/90 px-4 py-3.5 text-left text-base font-medium leading-snug text-slate-100 transition hover:border-amber-400 hover:bg-slate-700/90 active:scale-[0.99]"
                    onClick={() => onPickPointBonus(s.explanation)}
                  >
                    {s.explanation}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-600 bg-slate-900/70 p-4">
            <p className="text-center text-[11px] font-medium uppercase tracking-wide text-slate-500">
              주제어
            </p>
            <p className="mt-2 min-h-[3rem] text-center text-xl font-bold leading-snug text-amber-100">
              {topicText || '…'}
            </p>
            <p className="mt-4 text-center text-[11px] text-slate-500">
              맞는 뜻을 고르세요
            </p>
            <ul className="mt-2 flex flex-col gap-2">
              {p1Slots.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className="w-full rounded-xl border border-slate-500/80 bg-slate-800/90 px-4 py-3.5 text-left text-base font-medium leading-snug text-slate-100 transition hover:border-amber-500/60 hover:bg-slate-700/90 active:scale-[0.99]"
                    onClick={() => onPickExplanation(s.explanation)}
                  >
                    {s.explanation}
                  </button>
                </li>
              ))}
            </ul>
            {p1Slots.length === 0 && topicText ? (
              <p className="mt-3 text-center text-xs text-slate-500">다음 문제 준비 중…</p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

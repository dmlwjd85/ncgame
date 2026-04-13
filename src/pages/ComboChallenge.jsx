import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import Phase1Matching from '../components/game/Phase1Matching'
import { useAuth } from '../contexts/AuthContext'
import { useCardPacks } from '../contexts/CardPackContext'
import { addPointsBonus } from '../services/userShopService'
import { sfxCombo } from '../utils/gameSfx'
import { maxLevelFromRowCount } from '../utils/gameRules'
import { usePlayerProgressStore } from '../stores/playerProgressStore'

const WAVE_SIZE = 3
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
 * 무한 콤보 도전 — 선택한 팩으로 1페이즈만, 5초 안에 한 번이라도 맞추면 타이머 갱신, 틀리면 종료. 10콤보당 1P.
 */
export default function ComboChallenge() {
  const [searchParams] = useSearchParams()
  const packId = searchParams.get('packId')
  const { user } = useAuth()
  const { packs, loading, error } = useCardPacks()
  const refreshFromServer = usePlayerProgressStore((s) => s.refreshFromServer)

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
  const [p1DistractorVersion, setP1DistractorVersion] = useState(0)
  const [p1Collected, setP1Collected] = useState(/** @type {object[]} */ ([]))

  const [combo, setCombo] = useState(0)
  const [bestCombo, setBestCombo] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [started, setStarted] = useState(false)
  const [deadline, setDeadline] = useState(() => Date.now() + MATCH_WINDOW_MS)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const p1BatchCompleteFiredRef = useRef(false)

  const cardsNeededThisLevel = WAVE_SIZE
  const need = cardsNeededThisLevel - p1Collected.length

  const refillQueueFromPool = useCallback(() => {
    const used = usedRowIdsRef.current
    const unused = validRows.filter((r) => !used.has(String(r.id)))
    if (unused.length === 0) {
      used.clear()
      return shuffleRows(validRows)
    }
    return shuffleRows(unused)
  }, [validRows])

  useEffect(() => {
    if (!pack || queueReady || validRows.length === 0) return
    usedRowIdsRef.current = new Set()
    queueMicrotask(() => {
      setQueue(shuffleRows(validRows))
      setQueueReady(true)
    })
  }, [pack, queueReady, validRows])

  const handleP1BatchComplete = useCallback(
    (rows) => {
      const real = rows.filter((r) => !r._p1Filler)
      if (real.length === 0) return
      setP1Collected((c) => {
        const newC = [...c, ...real]
        const needAfter = cardsNeededThisLevel - newC.length
        setQueue((q) => {
          const next = q.slice(real.length)
          real.forEach((r) => usedRowIdsRef.current.add(String(r.id)))
          if (next.length === 0 && needAfter > 0) {
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
      setP1DistractorVersion(0)
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
      id: `combo-slot-${roundVersion}-dv${p1DistractorVersion}-${i}`,
      explanation: item.explanation,
      correctRowId: item.correctRowId,
      _p1Filler: item._p1Filler,
    }))
  }, [
    need,
    queue,
    validRows,
    roundVersion,
    p1DistractorVersion,
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
    setP1DistractorVersion((v) => v + 1)
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
      if (!started || gameOver) return
      if (ok) {
        setDeadline(Date.now() + MATCH_WINDOW_MS)
        setCombo((c) => {
          const n = c + 1
          setBestCombo((b) => Math.max(b, n))
          sfxCombo(n)
          if (n > 0 && n % 10 === 0 && user?.uid) {
            void addPointsBonus(user.uid, 1).then(() =>
              refreshFromServer(user.uid),
            )
          }
          return n
        })
      } else {
        setGameOver(true)
      }
    },
    [started, gameOver, user, refreshFromServer],
  )

  useEffect(() => {
    if (!started || gameOver) return
    const id = window.setInterval(() => {
      const t = Date.now()
      setNowMs(t)
      if (t > deadline) setGameOver(true)
    }, 100)
    return () => window.clearInterval(id)
  }, [started, gameOver, deadline])

  const packKey = pack?.id ?? ''
  const maxLv = maxLevelFromRowCount(validRows.length)
  const canPlay =
    pack && maxLv >= 1 && pack.missingColumns.length === 0 && validRows.length > 0

  if (!packId) {
    return <Navigate to="/" replace />
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
        <Link className="text-sky-400 underline" to="/">
          홈으로
        </Link>
      </div>
    )
  }

  const secLeft = Math.max(0, (deadline - nowMs) / 1000)

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
            <p className="font-medium text-slate-100">{pack.sheetName}</p>
            <p>무한 콤보 도전</p>
          </div>
        </header>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-600/80 bg-slate-900/60 px-4 py-3">
          <div>
            <p className="text-[11px] text-slate-400">콤보</p>
            <p className="font-mono text-2xl font-bold text-amber-300">{combo}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-slate-400">남은 시간</p>
            <p className="font-mono text-xl text-sky-300">
              {started && !gameOver ? secLeft.toFixed(1) : '—'}초
            </p>
          </div>
        </div>

        {!started ? (
          <div className="rounded-2xl border border-slate-600 bg-slate-900/50 p-5 text-sm leading-relaxed text-slate-300">
            <p className="font-semibold text-slate-100">규칙</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-xs">
              <li>5초 안에 카드를 한 번 이상 맞추면 타이머가 다시 5초로 갱신됩니다.</li>
              <li>시간이 0이 되거나 오답이면 종료입니다.</li>
              <li>10콤보당 포인트 1 (로그인 시 지급)</li>
            </ul>
            <button
              type="button"
              className="mt-4 w-full rounded-2xl bg-gradient-to-r from-amber-700 to-rose-800 py-3 text-base font-semibold text-white shadow-lg"
              onClick={() => {
                const t = Date.now()
                setStarted(true)
                setDeadline(t + MATCH_WINDOW_MS)
                setNowMs(t)
                setGameOver(false)
                setCombo(0)
              }}
            >
              시작
            </button>
          </div>
        ) : gameOver ? (
          <div className="rounded-2xl border border-slate-600 bg-slate-900/50 p-6 text-center">
            <p className="text-lg font-bold text-slate-100">종료</p>
            <p className="mt-2 text-slate-300">
              최고 콤보 <span className="font-mono text-amber-300">{bestCombo}</span>
            </p>
            <button
              type="button"
              className="mt-4 w-full rounded-2xl border border-slate-500 py-3 text-slate-200"
              onClick={() => {
                setStarted(false)
                setGameOver(false)
                setCombo(0)
                setBestCombo(0)
                usedRowIdsRef.current = new Set()
                setP1Collected([])
                setRoundVersion((v) => v + 1)
                setQueueReady(false)
                setQueue([])
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
        ) : (
          <Phase1Matching
            slots={p1Slots}
            topicRows={p1TopicRows}
            packKey={String(packKey)}
            roundVersion={roundVersion}
            combo={combo}
            coachMode={false}
            tutorialMode={false}
            onMatchAttempt={onMatchAttempt}
            onRealMatch={handleP1RealMatch}
          />
        )}
      </div>
    </div>
  )
}

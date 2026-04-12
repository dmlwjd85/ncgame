import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import Phase1Matching from '../components/game/Phase1Matching'
import Phase2Mind from '../components/game/Phase2Mind'
import P2PrepCountdown from '../components/P2PrepCountdown'
import { useAuth } from '../contexts/AuthContext'
import { useCardPacks } from '../contexts/CardPackContext'
import {
  MAX_LIVES,
  maxLevelFromRowCount,
  phase1ComboRewards,
  phase2SecondsForLevel,
} from '../utils/gameRules'
import { formatHoFDisplayName } from '../utils/displayName'
import { saveHallOfFameIfBetter } from '../utils/hallOfFame'
import {
  clearStagedResume,
  peekResumeFromSession,
  saveRunSave,
} from '../utils/gameRunSave'

function shuffleRows(rows) {
  const a = [...rows]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * 레벨별 1페이즈 → 2페이즈 (최대 15레벨)
 */
export default function Game() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { packs } = useCardPacks()
  const { packId, botCount: bc } = location.state || {}
  const botCount = bc === 2 ? 2 : 1

  const resumeSnap = useMemo(() => {
    if (!packId) return null
    return peekResumeFromSession(packId)
  }, [packId])

  const pack = useMemo(
    () => packs.find((p) => p.id === packId),
    [packs, packId],
  )

  const validRows = useMemo(
    () => (pack ? pack.rows.filter((r) => r.topic && r.explanation) : []),
    [pack],
  )

  const maxLevel = useMemo(
    () => maxLevelFromRowCount(validRows.length),
    [validRows.length],
  )

  const [segment, setSegment] = useState(
    /** @type {'p1'|'p2'|'level_clear'|'cleared'|'over'} */ ('p1'),
  )
  const [level, setLevel] = useState(() => resumeSnap?.level ?? 1)
  const [lives, setLives] = useState(() =>
    resumeSnap
      ? Math.min(MAX_LIVES, Math.max(0, resumeSnap.lives))
      : MAX_LIVES,
  )
  const [cheonryan, setCheonryan] = useState(() => resumeSnap?.cheonryan ?? 1)
  const [p1Combo, setP1Combo] = useState(() => resumeSnap?.p1Combo ?? 0)

  const [queue, setQueue] = useState(/** @type {object[]} */ ([]))
  const [queueReady, setQueueReady] = useState(false)
  const [roundVersion, setRoundVersion] = useState(0)
  const [p1Collected, setP1Collected] = useState(/** @type {object[]} */ ([]))
  const [lastRoundTopics, setLastRoundTopics] = useState(/** @type {string[]} */ ([]))
  const [deckNotice, setDeckNotice] = useState(/** @type {string | null} */ (null))
  /** 1페이즈에서 이미 꺼낸 카드 id — 부족 시 제외 덱, 전부 소진 시 초기화 */
  const usedRowIdsRef = useRef(/** @type {Set<string>} */ (new Set()))

  const packKey = pack?.id ?? ''

  const refillQueueFromPool = useCallback(() => {
    const used = usedRowIdsRef.current
    const unused = validRows.filter((r) => !used.has(r.id))
    if (unused.length === 0) {
      used.clear()
      setDeckNotice(
        '단어팩에서 쓸 카드가 부족해요. 덱을 처음부터 다시 섞어 이어갑니다.',
      )
      window.setTimeout(() => setDeckNotice(null), 6000)
      return shuffleRows(validRows)
    }
    return shuffleRows(unused)
  }, [validRows])

  /* eslint-disable react-hooks/set-state-in-effect -- 덱 셔플 초기화·이어하기 복원 */
  useEffect(() => {
    if (!pack || queueReady) return
    if (resumeSnap && String(resumeSnap.packId) === String(packId)) {
      usedRowIdsRef.current = new Set(resumeSnap.usedRowIds.map(String))
      const byId = new Map(validRows.map((r) => [String(r.id), r]))
      const q = resumeSnap.queueRowIds
        .map((id) => byId.get(String(id)))
        .filter(Boolean)
      const pool = shuffleRows(
        validRows.filter((r) => !usedRowIdsRef.current.has(String(r.id))),
      )
      setQueue(q.length > 0 ? q : pool)
      clearStagedResume()
      setQueueReady(true)
      return
    }
    usedRowIdsRef.current = new Set()
    setQueue(shuffleRows(validRows))
    setQueueReady(true)
  }, [pack, queueReady, validRows, packId, resumeSnap])
  /* eslint-enable react-hooks/set-state-in-effect */

  const cardsNeededThisLevel = level

  const need = cardsNeededThisLevel - p1Collected.length

  const currentBatch = useMemo(() => {
    if (need <= 0 || queue.length === 0) return []
    return queue.slice(0, Math.min(3, need, queue.length))
  }, [queue, need])

  const phase1Done =
    p1Collected.length >= cardsNeededThisLevel && queueReady

  const levelDeck = useMemo(
    () => p1Collected.slice(0, cardsNeededThisLevel),
    [p1Collected, cardsNeededThisLevel],
  )

  const poolRows = useMemo(() => {
    if (!pack) return []
    const ids = new Set(levelDeck.map((r) => r.id))
    return pack.rows.filter((r) => !ids.has(r.id))
  }, [pack, levelDeck])

  const goP2 = useCallback(() => {
    setSegment('p2')
  }, [])

  const onMatchAttempt = useCallback((ok) => {
    if (ok) {
      setP1Combo((c) => {
        const n = c + 1
        const { cheonryan: ch, lives: lf } = phase1ComboRewards(n)
        if (ch) setCheonryan((x) => x + ch)
        if (lf) setLives((l) => Math.min(MAX_LIVES, l + lf))
        return n
      })
    } else {
      setP1Combo(0)
    }
  }, [])

  const onBatchComplete = useCallback(
    (batch) => {
      setP1Collected((c) => {
        const newC = [...c, ...batch]
        const needAfter = cardsNeededThisLevel - newC.length
        setQueue((q) => {
          const next = q.slice(batch.length)
          batch.forEach((r) => usedRowIdsRef.current.add(r.id))
          if (next.length === 0 && needAfter > 0) {
            return refillQueueFromPool()
          }
          return next
        })
        return newC
      })
      setRoundVersion((v) => v + 1)
      setP1Combo(0)
    },
    [cardsNeededThisLevel, refillQueueFromPool],
  )

  /* eslint-disable react-hooks/set-state-in-effect -- 큐가 비었는데 이번 레벨에 더 필요할 때만 리필 */
  useEffect(() => {
    if (!queueReady || segment !== 'p1') return
    if (phase1Done) return
    const need = cardsNeededThisLevel - p1Collected.length
    if (need <= 0 || queue.length > 0) return
    setQueue(refillQueueFromPool())
  }, [
    queue.length,
    queueReady,
    segment,
    phase1Done,
    cardsNeededThisLevel,
    p1Collected.length,
    refillQueueFromPool,
  ])
  /* eslint-enable react-hooks/set-state-in-effect */

  const onRoundWin = useCallback(
    async ({ lives: L, cheonryan: C, center }) => {
      setLives(L)
      setCheonryan(C)
      setLastRoundTopics(center.map((c) => c.topic))
      await saveHallOfFameIfBetter(
        packId,
        level,
        formatHoFDisplayName(user?.displayName),
        {
          uid: user?.uid ?? null,
        },
      )
      if (level >= maxLevel) {
        setSegment('cleared')
        return
      }
      setSegment('level_clear')
    },
    [packId, level, maxLevel, user],
  )

  const continueNextLevel = useCallback(() => {
    setLevel((l) => l + 1)
    setP1Collected([])
    setRoundVersion((v) => v + 1)
    setP1Combo(0)
    setSegment('p1')
  }, [])

  const saveAndExitToHome = useCallback(() => {
    saveRunSave({
      v: 1,
      packId,
      botCount,
      level: level + 1,
      lives,
      cheonryan,
      p1Combo,
      usedRowIds: [...usedRowIdsRef.current],
      queueRowIds: queue.map((r) => r.id),
    })
    navigate('/', { replace: true })
  }, [packId, botCount, level, lives, cheonryan, p1Combo, queue, navigate])

  const onRoundLose = useCallback(() => {
    setSegment('over')
  }, [])

  if (!packId) {
    return <Navigate to="/" replace />
  }

  if (!pack) {
    return (
      <div className="game-shell flex min-h-dvh items-center justify-center px-4 text-slate-300">
        <p>카드팩을 찾을 수 없습니다.</p>
        <Link className="mt-4 block text-cyan-400 underline" to="/">
          홈으로
        </Link>
      </div>
    )
  }

  if (maxLevel < 1) {
    return (
      <div className="game-shell flex min-h-dvh items-center justify-center px-4 text-amber-200">
        <p>이 팩은 유효한 행이 없어 게임을 시작할 수 없습니다.</p>
        <Link className="mt-4 block text-cyan-400 underline" to="/">
          홈으로
        </Link>
      </div>
    )
  }

  return (
    <div className="game-shell min-h-dvh px-[max(1rem,env(safe-area-inset-left))] pb-[max(1rem,env(safe-area-inset-bottom))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(0.75rem,env(safe-area-inset-top))] text-slate-100">
      <div className="mx-auto w-full max-w-lg game-max-w-tablet landscape:max-w-4xl">
        <header className="mb-4 flex items-center justify-between gap-2 md:mb-6">
          <Link
            to="/"
            className="text-xs font-medium text-cyan-400/90 underline decoration-cyan-500/40 underline-offset-4 md:text-sm"
          >
            ← 홈
          </Link>
          <div className="text-right text-[10px] text-slate-400 md:text-xs">
            <p className="font-medium text-slate-200">{pack.sheetName}</p>
            <p>
              {Math.min(level, maxLevel)}단계 · {phase2SecondsForLevel(level)}초
            </p>
          </div>
        </header>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 backdrop-blur-md md:px-4 md:py-3">
          <div className="text-xs md:text-sm">
            <span className="text-slate-500">라이프 </span>
            <span className="text-rose-300">
              {'♥'.repeat(Math.min(MAX_LIVES, lives))}
            </span>
            <span className="text-slate-600">
              {'♡'.repeat(Math.max(0, MAX_LIVES - Math.min(MAX_LIVES, lives)))}
            </span>
          </div>
          <div className="text-xs md:text-sm">
            <span className="text-slate-500">천리안 </span>
            <span className="font-semibold text-amber-200">{cheonryan}</span>
          </div>
          <div className="text-xs md:text-sm">
            <span className="text-slate-500">콤보 </span>
            <span className="font-semibold text-emerald-300">{p1Combo}</span>
          </div>
        </div>

        {segment === 'p1' ? (
          <>
            <h1 className="text-lg font-semibold tracking-tight text-white md:text-xl">
              1페이즈 · 아래 낱말 → 위 해설
            </h1>
            <p className="mt-1 text-xs text-slate-400 md:text-sm">
              이번 레벨 {cardsNeededThisLevel}장 ({p1Collected.length}/
              {cardsNeededThisLevel}) · 대기 {queue.length}장
            </p>
            {deckNotice ? (
              <p
                role="status"
                className="mt-3 rounded-xl border border-amber-500/35 bg-amber-950/40 px-3 py-2 text-center text-xs text-amber-100 md:text-sm"
              >
                {deckNotice}
              </p>
            ) : null}
            {!queueReady ? (
              <p className="mt-8 text-center text-slate-500">덱 준비 중…</p>
            ) : phase1Done ? (
              <P2PrepCountdown
                key={`prep-${level}-${roundVersion}`}
                level={level}
                playerCards={levelDeck}
                onComplete={goP2}
              />
            ) : (
              <div className="mt-4 md:mt-6">
                <Phase1Matching
                  key={roundVersion}
                  rows={currentBatch}
                  packKey={packKey}
                  combo={p1Combo}
                  onMatchAttempt={onMatchAttempt}
                  onBatchComplete={onBatchComplete}
                />
              </div>
            )}
          </>
        ) : null}

        {segment === 'p2' ? (
          <>
            <h1 className="text-lg font-semibold tracking-tight text-white md:text-xl">
              2페이즈 · 국어→영어→숫자 순 눈치
            </h1>
            <p className="mt-1 text-xs text-slate-400 md:text-sm">
              가상 플레이어 {botCount}명 · {phase2SecondsForLevel(level)}초
            </p>
            <div className="mt-4 md:mt-6">
              <Phase2Mind
                key={`${level}-${roundVersion}-p2`}
                level={level}
                playerCards={levelDeck}
                botCount={botCount}
                poolRows={poolRows}
                initialLives={lives}
                initialCheonryan={cheonryan}
                onRoundWin={onRoundWin}
                onRoundLose={onRoundLose}
                onLivesChange={setLives}
              />
            </div>
          </>
        ) : null}

        {segment === 'level_clear' ? (
          <div className="py-8 text-center md:py-12">
            <p className="text-lg font-semibold text-cyan-200 md:text-xl">
              레벨 {level} 클리어!
            </p>
            <p className="mt-2 text-xs text-slate-500 md:text-sm">
              이번 라운드에서 제출된 카드 순서입니다.
            </p>
            <div className="mx-auto mt-6 flex max-h-[45dvh] flex-wrap justify-center gap-2 overflow-y-auto rounded-2xl border border-white/10 bg-black/30 px-3 py-4 text-left">
              {lastRoundTopics.length === 0 ? (
                <span className="text-slate-500">—</span>
              ) : (
                lastRoundTopics.map((t, i) => (
                  <span
                    key={`${t}-${i}`}
                    className="inline-flex items-center gap-1 rounded-lg bg-violet-500/15 px-2 py-1 text-xs text-violet-100 md:text-sm"
                  >
                    <span className="font-mono text-violet-400/80">{i + 1}.</span>
                    {t}
                  </span>
                ))
              )}
            </div>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                className="w-full max-w-xs rounded-2xl bg-gradient-to-r from-cyan-500 to-violet-600 px-8 py-3 text-sm font-semibold text-white shadow-lg sm:w-auto"
                onClick={continueNextLevel}
              >
                다음 레벨 ({level + 1})
              </button>
              <button
                type="button"
                className="w-full max-w-xs rounded-2xl border border-white/25 bg-white/10 px-8 py-3 text-sm font-semibold text-slate-100 backdrop-blur sm:w-auto"
                onClick={saveAndExitToHome}
              >
                저장하고 종료하기
              </button>
            </div>
          </div>
        ) : null}

        {segment === 'cleared' ? (
          <div className="py-12 text-center md:py-16">
            <p className="bg-gradient-to-r from-cyan-200 to-violet-300 bg-clip-text text-2xl font-bold text-transparent md:text-3xl">
              전체 클리어!
            </p>
            <p className="mt-3 text-sm text-slate-400">
              레벨 {maxLevel}까지 완주했습니다.
            </p>
            <button
              type="button"
              className="mt-8 rounded-2xl border border-white/20 bg-white/5 px-6 py-3 text-slate-200 backdrop-blur"
              onClick={() => navigate('/', { replace: true })}
            >
              처음으로
            </button>
          </div>
        ) : null}

        {segment === 'over' ? (
          <div className="py-12 text-center">
            <p className="text-xl font-semibold text-rose-200 md:text-2xl">게임 오버</p>
            <p className="mt-2 text-sm text-slate-400">
              레벨 {level}에서 라이프가 소진되었거나 시간이 부족했습니다.
            </p>
            <button
              type="button"
              className="mt-8 rounded-2xl border border-white/20 bg-white/5 px-6 py-3 text-slate-200 backdrop-blur"
              onClick={() => navigate('/', { replace: true })}
            >
              처음으로
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import Phase1Matching from '../components/game/Phase1Matching'
import Phase2Mind from '../components/game/Phase2Mind'
import { useAuth } from '../contexts/AuthContext'
import { useCardPacks } from '../contexts/CardPackContext'
import {
  MAX_LEVEL,
  MAX_LIVES,
  maxLevelFromRowCount,
  phase1ComboRewards,
  phase2SecondsForLevel,
} from '../utils/gameRules'
import { saveHallOfFameIfBetter } from '../utils/hallOfFame'

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
    /** @type {'p1'|'p2'|'cleared'|'over'} */ ('p1'),
  )
  const [level, setLevel] = useState(1)
  const [lives, setLives] = useState(MAX_LIVES)
  const [cheonryan, setCheonryan] = useState(1)
  const [p1Combo, setP1Combo] = useState(0)

  const [queue, setQueue] = useState(/** @type {object[]} */ ([]))
  const [queueReady, setQueueReady] = useState(false)
  const [roundVersion, setRoundVersion] = useState(0)
  const [p1Collected, setP1Collected] = useState(/** @type {object[]} */ ([]))

  const packKey = pack?.id ?? ''

  /* eslint-disable react-hooks/set-state-in-effect -- 덱 셔플 초기화 */
  useEffect(() => {
    if (!pack || queueReady) return
    setQueue(shuffleRows(validRows))
    setQueueReady(true)
  }, [pack, queueReady, validRows])
  /* eslint-enable react-hooks/set-state-in-effect */

  const cardsNeededThisLevel = level

  const currentBatch = useMemo(() => {
    const need = cardsNeededThisLevel - p1Collected.length
    if (need <= 0) return []
    return queue.slice(0, Math.min(3, need, queue.length))
  }, [queue, cardsNeededThisLevel, p1Collected.length])

  const phase1Done = p1Collected.length >= cardsNeededThisLevel && queueReady

  const levelDeck = useMemo(
    () => p1Collected.slice(0, cardsNeededThisLevel),
    [p1Collected, cardsNeededThisLevel],
  )

  const poolRows = useMemo(() => {
    if (!pack) return []
    const ids = new Set(levelDeck.map((r) => r.id))
    return pack.rows.filter((r) => !ids.has(r.id))
  }, [pack, levelDeck])

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
      setP1Collected((c) => [...c, ...batch])
      setQueue((q) => q.slice(batch.length))
      setRoundVersion((v) => v + 1)
    },
    [],
  )

  const goPhase2 = useCallback(() => {
    setSegment('p2')
  }, [])

  const onRoundWin = useCallback(
    ({ lives: L, cheonryan: C }) => {
      setLives(L)
      setCheonryan(C)
      const name = user?.displayName || '플레이어'
      saveHallOfFameIfBetter(packId, level, name)
      if (level >= maxLevel) {
        setSegment('cleared')
        return
      }
      setLevel((lv) => lv + 1)
      setP1Collected([])
      setRoundVersion((v) => v + 1)
      setSegment('p1')
    },
    [packId, level, maxLevel, user],
  )

  const onRoundLose = useCallback(() => {
    setSegment('over')
  }, [])

  if (!packId) {
    return <Navigate to="/" replace />
  }

  if (!pack) {
    return (
      <div className="min-h-dvh bg-[#070a12] px-4 py-8 text-center text-slate-300">
        <p>카드팩을 찾을 수 없습니다.</p>
        <Link className="mt-4 inline-block text-cyan-400 underline" to="/">
          홈으로
        </Link>
      </div>
    )
  }

  if (maxLevel < 1) {
    return (
      <div className="min-h-dvh bg-[#070a12] px-4 py-8 text-center text-amber-200">
        <p>이 팩은 유효한 행이 없어 게임을 시작할 수 없습니다.</p>
        <Link className="mt-4 inline-block text-cyan-400 underline" to="/">
          홈으로
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-[#070a12] bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(56,189,248,0.12),transparent)] px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-lg">
        <header className="mb-6 flex items-center justify-between gap-2">
          <Link
            to="/"
            className="text-sm font-medium text-cyan-400/90 underline decoration-cyan-500/40 underline-offset-4"
          >
            ← 홈
          </Link>
          <div className="text-right text-xs text-slate-500">
            <p className="font-medium text-slate-300">{pack.sheetName}</p>
            <p>
              레벨 {Math.min(level, maxLevel)}/{maxLevel} · 제한{' '}
              {phase2SecondsForLevel(level)}초
            </p>
          </div>
        </header>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-md">
          <div className="text-sm">
            <span className="text-slate-500">라이프 </span>
            <span className="text-rose-300">{'♥'.repeat(lives)}</span>
            <span className="text-slate-600">{'♡'.repeat(MAX_LIVES - lives)}</span>
          </div>
          <div className="text-sm">
            <span className="text-slate-500">천리안 </span>
            <span className="font-semibold text-amber-200">{cheonryan}</span>
          </div>
          <div className="text-sm">
            <span className="text-slate-500">1페이즈 콤보 </span>
            <span className="font-semibold text-emerald-300">{p1Combo}</span>
          </div>
        </div>

        {segment === 'p1' ? (
          <>
            <h1 className="text-xl font-semibold tracking-tight text-white">
              1페이즈 · 낱말 ↔ 해석
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              이번 레벨에서 {cardsNeededThisLevel}장 모으기 (
              {p1Collected.length}/{cardsNeededThisLevel}) · 대기 {queue.length}장
            </p>
            {!queueReady ? (
              <p className="mt-8 text-center text-slate-500">덱 준비 중…</p>
            ) : phase1Done ? (
              <div className="mt-8 text-center">
                <p className="text-emerald-300">
                  덱 완성! {cardsNeededThisLevel}장이 손패로 합쳐졌습니다.
                </p>
                <button
                  type="button"
                  className="mt-6 rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-600 px-8 py-3.5 font-semibold text-white shadow-lg shadow-violet-900/40 transition hover:brightness-110"
                  onClick={goPhase2}
                >
                  2페이즈 · 눈치게임
                </button>
              </div>
            ) : (
              <div className="mt-6">
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
            <h1 className="text-xl font-semibold tracking-tight text-white">
              2페이즈 · 사전순 눈치
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              가상 플레이어 {botCount}명 · 제한 시간 {phase2SecondsForLevel(level)}초
              (마지막 2초는 내 반응용)
            </p>
            <div className="mt-6">
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
              />
            </div>
          </>
        ) : null}

        {segment === 'cleared' ? (
          <div className="py-16 text-center">
            <p className="bg-gradient-to-r from-cyan-200 to-violet-300 bg-clip-text text-3xl font-bold text-transparent">
              전체 클리어!
            </p>
            <p className="mt-3 text-slate-400">
              레벨 {maxLevel}까지 국어 사전순 눈치를 완주했습니다.
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
          <div className="py-16 text-center">
            <p className="text-2xl font-semibold text-rose-200">게임 오버</p>
            <p className="mt-2 text-slate-400">
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

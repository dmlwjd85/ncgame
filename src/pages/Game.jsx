import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import Phase1Matching from '../components/game/Phase1Matching'
import Phase2Mind from '../components/game/Phase2Mind'
import { useCardPacks } from '../contexts/CardPackContext'

function shuffleRows(rows) {
  const a = [...rows]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * 언어팩 선택 후 1페이즈(매칭) → 2페이즈(더마인드식)
 */
export default function Game() {
  const location = useLocation()
  const navigate = useNavigate()
  const { packs } = useCardPacks()
  const { packId, botCount: bc } = location.state || {}
  const botCount = bc === 2 ? 2 : 1

  const pack = useMemo(
    () => packs.find((p) => p.id === packId),
    [packs, packId],
  )

  const [phase, setPhase] = useState(/** @type {'p1'|'p2'|'end'} */ ('p1'))
  const [queue, setQueue] = useState(/** @type {object[]} */ ([]))
  const [queueReady, setQueueReady] = useState(false)
  const [roundVersion, setRoundVersion] = useState(0)
  const [collected, setCollected] = useState(/** @type {object[]} */ ([]))
  const [combo, setCombo] = useState(0)
  const [maxCombo, setMaxCombo] = useState(0)
  const [hints, setHints] = useState(0)
  const [endResult, setEndResult] = useState(/** @type {'win'|'lose'|null} */ (null))

  const packKey = pack?.id ?? ''

  // 팩이 준비되면 덱을 한 번만 셔플해 큐에 넣음(랜덤은 렌더 밖에서만)
  /* eslint-disable react-hooks/set-state-in-effect -- 셔플 초기화는 외부 데이터(pack) 동기화에 해당 */
  useEffect(() => {
    if (!pack || queueReady) return
    const rows = shuffleRows(
      pack.rows.filter((r) => r.topic && r.explanation),
    )
    setQueue(rows)
    setQueueReady(true)
  }, [pack, queueReady])
  /* eslint-enable react-hooks/set-state-in-effect */

  const currentBatch = useMemo(
    () => queue.slice(0, Math.min(3, queue.length)),
    [queue],
  )

  const onMatchAttempt = useCallback((ok) => {
    if (ok) {
      setCombo((c) => {
        const n = c + 1
        setMaxCombo((m) => Math.max(m, n))
        if (n >= 3 && n % 3 === 0) setHints((h) => h + 1)
        return n
      })
    } else {
      setCombo(0)
    }
  }, [])

  const onBatchComplete = useCallback((batch) => {
    setCollected((c) => [...c, ...batch])
    setQueue((q) => q.slice(batch.length))
    setRoundVersion((v) => v + 1)
  }, [])

  const finishPhase1 = useCallback(() => {
    setPhase('p2')
  }, [])

  const onPhase2End = useCallback((result) => {
    setEndResult(result)
    setPhase('end')
  }, [])

  const poolRows = useMemo(() => {
    if (!pack) return []
    const ids = new Set(collected.map((r) => r.id))
    return pack.rows.filter((r) => !ids.has(r.id))
  }, [pack, collected])

  if (!packId) {
    return <Navigate to="/" replace />
  }

  if (!pack) {
    return (
      <div className="min-h-dvh bg-slate-950 px-4 py-8 text-center text-slate-300">
        <p>카드팩을 찾을 수 없습니다.</p>
        <Link className="mt-4 inline-block text-emerald-400 underline" to="/">
          홈으로
        </Link>
      </div>
    )
  }

  if (pack.rows.length < 3) {
    return (
      <div className="min-h-dvh bg-slate-950 px-4 py-8 text-center text-amber-200">
        <p>이 팩은 행이 3개 미만이라 게임을 시작할 수 없습니다.</p>
        <Link className="mt-4 inline-block text-emerald-400 underline" to="/">
          홈으로
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-slate-950 px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-lg">
        <div className="mb-4 flex items-center justify-between gap-2">
          <Link to="/" className="text-sm text-emerald-400 underline">
            ← 홈
          </Link>
          <span className="text-xs text-slate-500">
            {pack.sourceFile} · {pack.sheetName}
          </span>
        </div>

        {phase === 'p1' ? (
          <>
            <h1 className="text-lg font-semibold text-slate-100">
              1페이즈 · 주제어 ↔ 해설 매칭
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              콤보 {combo} · 힌트 {hints}개 · 남은 카드 {queue.length}장
            </p>
            {!queueReady ? (
              <p className="mt-8 text-center text-slate-500">덱 준비 중…</p>
            ) : queue.length === 0 ? (
              <div className="mt-8 text-center">
                <p className="text-emerald-300">
                  1페이즈 완료! 덱 {collected.length}장
                </p>
                <button
                  type="button"
                  className="mt-4 rounded-xl bg-violet-600 px-6 py-3 font-medium text-white"
                  onClick={finishPhase1}
                >
                  2페이즈 · 눈치게임 시작
                </button>
              </div>
            ) : (
              <div className="mt-6">
                <Phase1Matching
                  key={roundVersion}
                  rows={currentBatch}
                  packKey={packKey}
                  onMatchAttempt={onMatchAttempt}
                  onBatchComplete={onBatchComplete}
                />
              </div>
            )}
          </>
        ) : null}

        {phase === 'p2' ? (
          <>
            <h1 className="text-lg font-semibold text-slate-100">
              2페이즈 · 사전순 눈치 (더마인드)
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              가상 플레이어 {botCount}명 · 최대 콤보 {maxCombo}
            </p>
            <div className="mt-6">
              <Phase2Mind
                playerCards={collected}
                botCount={botCount}
                poolRows={poolRows}
                initialHints={hints}
                onEnd={onPhase2End}
              />
            </div>
          </>
        ) : null}

        {phase === 'end' ? (
          <div className="py-12 text-center">
            <p className="text-xl font-semibold text-slate-100">
              {endResult === 'win' ? '승리!' : '패배…'}
            </p>
            <p className="mt-2 text-sm text-slate-400">
              {endResult === 'win'
                ? '모든 카드를 올바른 사전순으로 제출했습니다.'
                : '라이프가 모두 소진되었습니다.'}
            </p>
            <button
              type="button"
              className="mt-6 rounded-xl border border-slate-600 px-5 py-2 text-slate-200"
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

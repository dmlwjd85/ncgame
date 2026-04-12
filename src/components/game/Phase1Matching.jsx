import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { sfxMerge } from '../../utils/gameSfx'

/**
 * 콤보 구간별 이펙트 단계 (1…)
 * @param {number} combo
 */
function comboTier(combo) {
  if (combo >= 15) return 4
  if (combo >= 10) return 3
  if (combo >= 5) return 2
  return 1
}

/**
 * 1페이즈: 위 해설 ↔ 아래 주제어 · 맞추면 아래 대기 칸으로 합쳐짐 · 틀리면 튕김
 */
export default function Phase1Matching({
  rows,
  onMatchAttempt,
  onBatchComplete,
  packKey,
  combo = 0,
}) {
  const [matchedIds, setMatchedIds] = useState(() => new Set())
  const [burstId, setBurstId] = useState(/** @type {string|null} */ (null))
  const [rejectId, setRejectId] = useState(/** @type {string|null} */ (null))
  /** 맞춘 카드가 아래로 합쳐져 쌓임 */
  const [stagedCards, setStagedCards] = useState(
    /** @type {Array<{ key: string, topic: string, explanation: string }>} */ [],
  )
  const tier = comboTier(combo)

  const activeRows = useMemo(
    () => rows.filter((r) => !matchedIds.has(rowKey(packKey, r))),
    [rows, matchedIds, packKey],
  )

  const [topicsShuffled, setTopicsShuffled] = useState(() => [])

  /* eslint-disable react-hooks/set-state-in-effect -- 남은 주제어 행이 바뀔 때마다 랜덤 셔플 */
  useEffect(() => {
    const arr = [...activeRows]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    setTopicsShuffled(arr)
  }, [activeRows])
  /* eslint-enable react-hooks/set-state-in-effect */

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 180,
        tolerance: 6,
      },
    }),
  )

  const bumpReject = useCallback((id) => {
    if (!id) return
    setRejectId(String(id))
    window.setTimeout(() => setRejectId(null), 520)
  }, [])

  const handleDragEnd = useCallback(
    (event) => {
      const { active, over } = event
      const aid = active?.id != null ? String(active.id) : ''

      if (!over) {
        onMatchAttempt(false)
        bumpReject(aid)
        return
      }
      const ok = active.id === over.id
      if (!ok) {
        onMatchAttempt(false)
        bumpReject(aid)
        return
      }

      const row = rows.find((r) => String(rowKey(packKey, r)) === aid)
      sfxMerge()
      if (row) {
        setStagedCards((prev) => [
          ...prev,
          {
            key: aid,
            topic: row.topic,
            explanation: row.explanation,
          },
        ])
      }
      setBurstId(aid)
      window.setTimeout(() => setBurstId(null), 420)
      onMatchAttempt(true)
      setMatchedIds((prev) => {
        const next = new Set(prev).add(aid)
        if (next.size === rows.length) {
          queueMicrotask(() => onBatchComplete(rows))
        }
        return next
      })
    },
    [onMatchAttempt, onBatchComplete, rows, packKey, bumpReject],
  )

  if (rows.length === 0) return null

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div
        className={`relative flex flex-col gap-4 transition duration-300 md:gap-5 p1-tier-${tier}`}
      >
        <div
          className={`pointer-events-none absolute inset-0 rounded-3xl opacity-40 blur-3xl transition bg-gradient-to-br p1-tier-glow-${tier}`}
          aria-hidden
        />
        <p className="relative text-center text-sm leading-relaxed text-slate-300">
          위에는 뜻이 있어요.{' '}
          <span className="text-slate-200">아래 단어</span>를 잠깐 누른 뒤, 맞는
          뜻 칸으로 <span className="text-cyan-200/90">위로 끌어 올려</span>{' '}
          놓으세요.
        </p>
        <div className="relative flex flex-col gap-3">
          {rows.map((row) => (
            <ExplanationDrop
              key={rowKey(packKey, row)}
              id={String(rowKey(packKey, row))}
              matched={matchedIds.has(rowKey(packKey, row))}
              text={row.explanation}
              tier={tier}
            />
          ))}
        </div>
        <div className="relative flex min-h-[88px] flex-wrap justify-center gap-2 border-t border-white/10 pt-4">
          <p className="sr-only">아래에서 단어를 끌어 위의 해설과 맞추세요</p>
          {topicsShuffled.map((row) => (
            <TopicBadge
              key={rowKey(packKey, row)}
              id={String(rowKey(packKey, row))}
              disabled={matchedIds.has(rowKey(packKey, row))}
              label={row.topic}
              burst={burstId === String(rowKey(packKey, row))}
              reject={rejectId === String(rowKey(packKey, row))}
              tier={tier}
            />
          ))}
        </div>

        <div className="relative rounded-2xl border border-emerald-500/25 bg-slate-950/70 px-3 py-3 shadow-inner md:px-4 md:py-4">
          <p className="text-center text-[11px] font-medium text-emerald-300/90 md:text-xs">
            내 카드 대기 — 맞춘 카드가 여기로 합쳐져요
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {stagedCards.length === 0 ? (
              <p className="col-span-full py-4 text-center text-xs text-slate-500">
                아직 맞춘 카드가 없어요
              </p>
            ) : (
              stagedCards.map((c) => (
                <div
                  key={c.key}
                  className="p1-staged-card rounded-xl border border-emerald-500/35 bg-gradient-to-br from-emerald-950/90 to-slate-900/95 px-3 py-2.5 shadow-md"
                >
                  <p className="text-sm font-bold text-white md:text-base">
                    {c.topic}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-200 md:text-sm">
                    {c.explanation}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </DndContext>
  )
}

function rowKey(packKey, row) {
  return `${packKey}-${row.id}`
}

function TopicBadge({ id, label, disabled, burst, reject, tier }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id, disabled })

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px,${transform.y}px,0)`,
        opacity: isDragging ? 0.75 : 1,
      }
    : undefined

  if (disabled) return null

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={style}
      className={`touch-none select-none rounded-full border px-4 py-2.5 text-sm font-semibold shadow-lg transition active:cursor-grabbing active:touch-none p1-badge-${tier} ${
        burst ? 'p1-burst' : ''
      } ${reject ? 'p1-reject-bounce' : ''}`}
      {...listeners}
      {...attributes}
    >
      {label}
    </button>
  )
}

function ExplanationDrop({ id, text, matched, tier }) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: matched })

  if (matched) {
    return (
      <div
        className={`flex min-h-[3rem] items-center gap-2 rounded-xl border px-3 py-2 transition p1-drop-done-${tier}`}
      >
        <span className="text-lg text-emerald-400" aria-hidden>
          ✓
        </span>
        <p className="text-xs text-emerald-200/90 md:text-sm">
          맞춤 — 카드는 아래 대기 칸으로 내려갔어요
        </p>
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[4.5rem] rounded-2xl border-2 border-dashed px-4 py-4 text-left text-sm leading-relaxed transition ${
        isOver
          ? 'border-cyan-400/80 bg-cyan-950/40 text-slate-100 shadow-[0_0_24px_rgba(34,211,238,0.2)]'
          : 'border-white/20 bg-slate-800/90 text-slate-100'
      }`}
    >
      {text}
    </div>
  )
}

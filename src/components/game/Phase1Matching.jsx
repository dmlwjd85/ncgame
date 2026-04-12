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
 * 1페이즈: 위쪽 해설(드롭) ↔ 아래쪽 주제어(드래그)
 * 세로 스와이프(아래→위 드래그)가 위로 매칭되어 화면 맨 위 새로고침 제스처와 겹치지 않게 함
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

  const handleDragEnd = useCallback(
    (event) => {
      const { active, over } = event
      if (!over) {
        onMatchAttempt(false)
        return
      }
      const ok = active.id === over.id
      onMatchAttempt(ok)
      if (ok) {
        setBurstId(String(active.id))
        window.setTimeout(() => setBurstId(null), 420)
        setMatchedIds((prev) => {
          const next = new Set(prev).add(String(active.id))
          if (next.size === rows.length) {
            queueMicrotask(() => onBatchComplete(rows))
          }
          return next
        })
      }
    },
    [onMatchAttempt, onBatchComplete, rows],
  )

  if (rows.length === 0) return null

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div
        className={`relative flex flex-col gap-6 transition duration-300 p1-tier-${tier}`}
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
              topic={row.topic}
              tier={tier}
            />
          ))}
        </div>
        <div className="relative mt-1 flex min-h-[100px] flex-wrap justify-center gap-2 border-t border-white/10 pt-5">
          <p className="sr-only">아래에서 단어를 끌어 위의 해설과 맞추세요</p>
          {topicsShuffled.map((row) => (
            <TopicBadge
              key={rowKey(packKey, row)}
              id={String(rowKey(packKey, row))}
              disabled={matchedIds.has(rowKey(packKey, row))}
              label={row.topic}
              burst={burstId === String(rowKey(packKey, row))}
              tier={tier}
            />
          ))}
        </div>
      </div>
    </DndContext>
  )
}

function rowKey(packKey, row) {
  return `${packKey}-${row.id}`
}

function TopicBadge({ id, label, disabled, burst, tier }) {
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
      }`}
      {...listeners}
      {...attributes}
    >
      {label}
    </button>
  )
}

function ExplanationDrop({ id, text, matched, topic, tier }) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: matched })

  if (matched) {
    return (
      <div
        className={`rounded-2xl border px-4 py-4 text-sm leading-relaxed transition p1-drop-done-${tier}`}
      >
        <p className="text-xs font-medium text-emerald-400/80">맞춤!</p>
        <p className="mt-1 font-semibold text-emerald-100">{topic}</p>
        <p className="mt-1 text-emerald-200/70 line-through opacity-70">{text}</p>
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[4.5rem] rounded-2xl border-2 border-dashed px-4 py-4 text-left text-sm leading-relaxed transition ${
        isOver
          ? 'border-cyan-400/80 bg-cyan-950/40 shadow-[0_0_24px_rgba(34,211,238,0.2)]'
          : 'border-white/15 bg-slate-900/60 text-slate-200'
      }`}
    >
      {text}
    </div>
  )
}

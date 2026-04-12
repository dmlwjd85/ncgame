import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { useCallback, useEffect, useMemo, useState } from 'react'

/**
 * 주제어 뱃지 → 해설 카드 드롭 매칭 (1페이즈)
 * @param {{ id: string|number, topic: string, explanation: string }[]} rows — 현재 라운드 행(최대 3개)
 * @param {(ok: boolean) => void} onMatchAttempt — 정답/오답(콤보용)
 * @param {(batch: object[]) => void} onBatchComplete — 이번 라운드 전체 정답 시
 * @param {string} packKey
 * 부모에서 key(라운드마다 증가)로 리마운트해 매칭 상태를 초기화합니다.
 */
export default function Phase1Matching({
  rows,
  onMatchAttempt,
  onBatchComplete,
  packKey,
}) {
  const [matchedIds, setMatchedIds] = useState(() => new Set())

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
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
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
      <div className="flex flex-col gap-6">
        <p className="text-center text-sm text-slate-400">
          주제어를 끌어 같은 뜻의 해설 칸에 놓으세요.
        </p>
        <div className="flex min-h-[100px] flex-wrap justify-center gap-2">
          {topicsShuffled.map((row) => (
            <TopicBadge
              key={rowKey(packKey, row)}
              id={String(rowKey(packKey, row))}
              disabled={matchedIds.has(rowKey(packKey, row))}
              label={row.topic}
            />
          ))}
        </div>
        <div className="flex flex-col gap-3">
          {rows.map((row) => (
            <ExplanationDrop
              key={rowKey(packKey, row)}
              id={String(rowKey(packKey, row))}
              matched={matchedIds.has(rowKey(packKey, row))}
              text={row.explanation}
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

function TopicBadge({ id, label, disabled }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id, disabled })

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px,${transform.y}px,0)`,
        opacity: isDragging ? 0.7 : 1,
      }
    : undefined

  if (disabled) return null

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={style}
      className="touch-manipulation rounded-full border border-emerald-500/50 bg-emerald-900/40 px-4 py-2 text-sm font-medium text-emerald-100 shadow-lg active:cursor-grabbing"
      {...listeners}
      {...attributes}
    >
      {label}
    </button>
  )
}

function ExplanationDrop({ id, text, matched }) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: matched })

  if (matched) {
    return (
      <div className="rounded-xl border border-emerald-600/40 bg-emerald-950/50 px-3 py-3 text-sm text-emerald-200/80 line-through">
        {text}
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[4rem] rounded-xl border-2 border-dashed px-3 py-3 text-left text-sm leading-relaxed transition ${
        isOver
          ? 'border-emerald-400 bg-emerald-950/30'
          : 'border-slate-600 bg-slate-900/80 text-slate-200'
      }`}
    >
      {text}
    </div>
  )
}

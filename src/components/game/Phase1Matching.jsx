import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
 * 1페이즈: 위 뜻 슬롯 3개(정답·오답 섞임, 매칭마다 갱신) ↔ 아래 주제어
 */
export default function Phase1Matching({
  /** @type {Array<{ id: string, explanation: string, correctRowId: string | null, _p1Filler?: boolean }>} */
  slots,
  /** @type {object[]} */
  topicRows,
  packKey,
  roundVersion,
  combo = 0,
  coachMode = false,
  tutorialMode = false,
  onMatchAttempt,
  onRealMatch,
}) {
  const [matchedSlotIds, setMatchedSlotIds] = useState(() => new Set())
  const [burstId, setBurstId] = useState(/** @type {string|null} */ (null))
  const [rejectId, setRejectId] = useState(/** @type {string|null} */ (null))
  const [stagedCards, setStagedCards] = useState(
    /** @type {Array<{ key: string, topic: string, explanation: string }>} */ ([]),
  )
  const [successFlash, setSuccessFlash] = useState(
    /** @type {{ topic: string, explanation: string } | null} */ (null),
  )

  /** 하스스톤 느낌 드래그 연결선 */
  const [dragLine, setDragLine] = useState(
    /** @type {{ x1: number, y1: number, x2: number, y2: number } | null} */ (null),
  )
  const dragStartRef = useRef(/** @type {{ x: number, y: number } | null} */ (null))

  const tier = comboTier(combo)

  const slotsKey = useMemo(() => slots.map((s) => s.id).join('|'), [slots])

  /** 초보·튜토리얼: 아직 맞출 주제어 중 첫 줄 */
  const coachTargetKey = useMemo(() => {
    if (!coachMode && !tutorialMode) return null
    const next = topicRows[0]
    return next ? String(rowKey(packKey, next)) : null
  }, [coachMode, tutorialMode, topicRows, packKey])

  /* eslint-disable react-hooks/set-state-in-effect -- 새 슬롯 배치마다 슬롯 체크만 초기화 */
  useEffect(() => {
    setMatchedSlotIds(new Set())
    setBurstId(null)
    setRejectId(null)
  }, [slotsKey])
  /* eslint-enable react-hooks/set-state-in-effect */

  /* eslint-disable react-hooks/set-state-in-effect -- 새 배치(라운드)마다 모음 초기화 */
  useEffect(() => {
    setStagedCards([])
    setSuccessFlash(null)
  }, [roundVersion])
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!successFlash) return
    /* 맞춤 직후 황금 카드를 충분히 읽을 수 있도록 */
    const id = window.setTimeout(() => setSuccessFlash(null), 3200)
    return () => window.clearTimeout(id)
  }, [successFlash])

  const [topicsShuffled, setTopicsShuffled] = useState(() => [])

  /* eslint-disable react-hooks/set-state-in-effect -- 주제어 줄 셔플 */
  useEffect(() => {
    const arr = [...topicRows]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    setTopicsShuffled(arr)
  }, [topicRows])
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

  const pointerMoveCleanupRef = useRef(/** @type {(() => void) | null} */ (null))

  const clearDragLine = useCallback(() => {
    pointerMoveCleanupRef.current?.()
    pointerMoveCleanupRef.current = null
    dragStartRef.current = null
    setDragLine(null)
  }, [])

  const handleDragStart = useCallback(
    (_event) => {
      const id =
        _event.active?.id != null ? String(_event.active.id) : ''
      const el = document.getElementById(`p1-topic-${id}`)
      if (el) {
        const r = el.getBoundingClientRect()
        dragStartRef.current = {
          x: r.left + r.width / 2,
          y: r.top + r.height / 2,
        }
        setDragLine({
          x1: dragStartRef.current.x,
          y1: dragStartRef.current.y,
          x2: dragStartRef.current.x,
          y2: dragStartRef.current.y,
        })
        const move = (e) => {
          if (!dragStartRef.current) return
          setDragLine({
            x1: dragStartRef.current.x,
            y1: dragStartRef.current.y,
            x2: e.clientX,
            y2: e.clientY,
          })
        }
        const stop = () => {
          window.removeEventListener('pointermove', move)
        }
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', stop, { once: true })
        window.addEventListener('pointercancel', stop, { once: true })
        pointerMoveCleanupRef.current = stop
      }
    },
    [],
  )

  const handleDragEnd = useCallback(
    (event) => {
      clearDragLine()
      const { active, over } = event
      const aid = active?.id != null ? String(active.id) : ''

      if (!over) {
        onMatchAttempt(false)
        bumpReject(aid)
        return
      }

      const topicRow = topicRows.find(
        (r) => String(rowKey(packKey, r)) === aid,
      )
      const slot = slots.find((s) => String(s.id) === String(over.id))

      if (!topicRow || !slot) {
        onMatchAttempt(false)
        bumpReject(aid)
        return
      }

      const ok =
        slot.correctRowId != null &&
        String(slot.correctRowId) === String(topicRow.id)

      if (!ok) {
        onMatchAttempt(false)
        bumpReject(aid)
        return
      }

      sfxMerge()
      setSuccessFlash({
        topic: String(topicRow.topic ?? '').trim() || '—',
        explanation: String(topicRow.explanation ?? '').trim(),
      })
      setStagedCards((prev) => [
        ...prev,
        {
          key: aid,
          topic: topicRow.topic,
          explanation: topicRow.explanation,
        },
      ])
      setBurstId(aid)
      window.setTimeout(() => setBurstId(null), 420)
      onMatchAttempt(true)
      onRealMatch(topicRow, slot.explanation)
      setMatchedSlotIds((prev) => new Set(prev).add(String(slot.id)))
    },
    [clearDragLine, onMatchAttempt, onRealMatch, topicRows, slots, packKey, bumpReject],
  )

  const coachFirstId =
    topicRows[0] != null ? String(topicRows[0].id) : null

  if (slots.length === 0) return null

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={clearDragLine}
    >
      {dragLine ? (
        <svg
          className="pointer-events-none fixed inset-0 z-[75]"
          aria-hidden
        >
          <defs>
            <linearGradient id="p1-drag-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.95" />
              <stop offset="55%" stopColor="#fbbf24" stopOpacity="1" />
              <stop offset="100%" stopColor="#f97316" stopOpacity="0.9" />
            </linearGradient>
            <filter id="p1-drag-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <line
            x1={dragLine.x1}
            y1={dragLine.y1}
            x2={dragLine.x2}
            y2={dragLine.y2}
            stroke="url(#p1-drag-grad)"
            strokeWidth={5}
            strokeLinecap="round"
            filter="url(#p1-drag-glow)"
          />
          <circle cx={dragLine.x2} cy={dragLine.y2} r={7} fill="#fef08a" />
        </svg>
      ) : null}

      <div
        className={`relative flex flex-col gap-4 transition duration-300 md:gap-5 p1-tier-${tier}`}
      >
        <div
          className={`pointer-events-none absolute inset-0 rounded-3xl opacity-40 blur-3xl transition bg-gradient-to-br p1-tier-glow-${tier}`}
          aria-hidden
        />
        <p className="relative text-center text-base font-semibold leading-snug text-slate-800 md:text-lg">
          단어를 끌어와 맞는 뜻을 합쳐 카드를 완성하세요!
        </p>
        <p className="relative text-center text-xs text-slate-500 md:text-sm">
          맞출 때마다 위 뜻 3칸이 새로 섞여요. (정답 포함)
        </p>
        {(coachMode || tutorialMode) && coachTargetKey ? (
          <p
            className="relative flex items-center justify-center gap-1 text-center text-xs font-medium text-amber-800 md:text-sm"
            role="status"
          >
            <span className="inline-block animate-bounce" aria-hidden>
              ↓
            </span>
            노란 줄부터
          </p>
        ) : null}
        <div className="relative flex flex-col gap-3">
          {slots.map((slot) => (
            <SlotDrop
              key={slot.id}
              slot={slot}
              matched={matchedSlotIds.has(String(slot.id))}
              tier={tier}
              coachHighlight={
                (coachMode || tutorialMode) &&
                coachFirstId != null &&
                slot.correctRowId != null &&
                String(slot.correctRowId) === coachFirstId
              }
              tutorialPulse={tutorialMode}
            />
          ))}
        </div>
        <div className="relative flex min-h-[88px] flex-wrap justify-center gap-2 border-t border-white/10 pt-4">
          <p className="sr-only">아래에서 단어를 끌어 위의 해설과 맞추세요</p>
          {topicsShuffled.map((row) => (
            <TopicBadge
              key={rowKey(packKey, row)}
              id={String(rowKey(packKey, row))}
              label={row.topic}
              burst={burstId === String(rowKey(packKey, row))}
              reject={rejectId === String(rowKey(packKey, row))}
              tier={tier}
              coachHighlight={coachTargetKey === String(rowKey(packKey, row))}
              tutorialPulse={tutorialMode}
            />
          ))}
        </div>

        <div className="relative rounded-2xl border border-emerald-200 bg-white/95 px-3 py-3 shadow-md md:px-4 md:py-4">
          <p className="text-center text-[11px] font-medium text-emerald-700 md:text-xs">
            맞춘 카드 모음
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
                  className="p1-staged-card rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white px-3 py-2.5 shadow-sm"
                >
                  <p className="text-sm font-bold text-slate-900 md:text-base">
                    {c.topic}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-700 md:text-sm">
                    {c.explanation}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {tutorialMode && coachTargetKey ? (
          <div
            className="pointer-events-none fixed bottom-[max(5.5rem,env(safe-area-inset-bottom))] left-1/2 z-40 max-w-sm -translate-x-1/2 rounded-xl border border-sky-400 bg-sky-50/95 px-3 py-2 text-center text-xs text-sky-950 shadow-lg md:text-sm"
            role="status"
          >
            노란 줄부터 끌어 맞추기
          </div>
        ) : null}

        {successFlash ? (
          <div
            className="p1-enhance-overlay pointer-events-none fixed inset-0 z-[80] flex items-center justify-center"
            aria-live="polite"
            aria-hidden
          >
            <div className="p1-enhance-burst">
              <div className="p1-enhance-rays" aria-hidden />
              <div className="p1-enhance-card">
                <p className="p1-enhance-badge">완성!</p>
                <p className="p1-enhance-topic">{successFlash.topic}</p>
                {successFlash.explanation ? (
                  <p className="p1-enhance-exp">{successFlash.explanation}</p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </DndContext>
  )
}

function rowKey(packKey, row) {
  return `${packKey}-${row.id}`
}

function SlotDrop({ slot, matched, tier, coachHighlight, tutorialPulse }) {
  const { setNodeRef, isOver } = useDroppable({
    id: slot.id,
    disabled: matched,
  })

  if (matched) {
    return (
      <div
        className={`flex min-h-[3rem] items-center gap-2 rounded-xl border px-3 py-2 transition p1-drop-done-${tier}`}
      >
        <span className="text-lg text-emerald-600" aria-hidden>
          ✓
        </span>
        <p className="text-xs text-emerald-800 md:text-sm">맞춤</p>
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[4.5rem] rounded-2xl border-2 border-dashed px-4 py-4 text-left text-sm leading-relaxed transition ${
        coachHighlight && !isOver
          ? tutorialPulse
            ? 'animate-pulse border-amber-400 bg-amber-50/90 text-slate-900 ring-4 ring-amber-300/80 shadow-[0_0_0_4px_rgba(251,191,36,0.25)]'
            : 'border-amber-400 bg-amber-50/90 text-slate-900 ring-4 ring-amber-300/80'
          : isOver
            ? 'border-sky-400 bg-sky-50 text-slate-900 shadow-[0_0_20px_rgba(14,165,233,0.25)]'
            : 'border-slate-300 bg-white/95 text-slate-800 shadow-sm'
      }`}
    >
      {slot.explanation}
    </div>
  )
}

function TopicBadge({
  id,
  label,
  burst,
  reject,
  tier,
  coachHighlight,
  tutorialPulse = false,
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id })

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px,${transform.y}px,0)`,
        opacity: isDragging ? 0.75 : 1,
      }
    : undefined

  return (
    <button
      id={`p1-topic-${id}`}
      ref={setNodeRef}
      type="button"
      style={style}
      className={`touch-none select-none rounded-full border px-4 py-2.5 text-sm font-semibold shadow-lg transition active:cursor-grabbing active:touch-none p1-badge-${tier} ${
        coachHighlight
          ? tutorialPulse
            ? 'animate-pulse ring-4 ring-amber-400 ring-offset-2 shadow-[0_0_0_4px_rgba(251,191,36,0.35)]'
            : 'ring-4 ring-amber-400 ring-offset-2'
          : ''
      } ${burst ? 'p1-burst' : ''} ${reject ? 'p1-reject-bounce' : ''}`}
      {...listeners}
      {...attributes}
    >
      {label}
    </button>
  )
}

import { useMemo } from 'react'
import { compareTopicOrder } from '../utils/koCompare'

/**
 * 선택한 팩의 단어를 국어→영어→숫자 순으로 표시 (팝업)
 */
export default function JokboModal({ open, pack, onClose }) {
  const topicsSorted = useMemo(() => {
    if (!pack?.rows?.length) return []
    const withTopic = pack.rows.filter((r) => r.topic)
    const arr = [...withTopic]
    arr.sort((a, b) => compareTopicOrder(a.topic, b.topic))
    return arr.map((r) => r.topic)
  }, [pack])

  if (!open || !pack) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="jokbo-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-950/95 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-white/10 p-5">
          <h2 id="jokbo-title" className="text-lg font-bold text-white">
            족보
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            국어→영어→숫자 순 · 총 {topicsSorted.length}개
          </p>
        </div>
        <ol className="flex-1 list-decimal overflow-y-auto py-2 pl-9 pr-4 text-sm leading-relaxed text-slate-200 marker:text-cyan-500/90">
          {topicsSorted.length === 0 ? (
            <li className="list-none pl-0 text-slate-500">단어가 없어요.</li>
          ) : (
            topicsSorted.map((t, i) => (
              <li key={`${t}-${i}`} className="break-words py-1">
                {t}
              </li>
            ))
          )}
        </ol>
        <div className="shrink-0 border-t border-white/10 p-4">
          <button
            type="button"
            className="w-full rounded-2xl border border-white/15 py-3 text-sm font-medium text-slate-200"
            onClick={onClose}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

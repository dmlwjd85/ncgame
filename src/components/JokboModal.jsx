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
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/35 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="jokbo-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-violet-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-violet-100 bg-violet-50/80 p-5">
          <h2 id="jokbo-title" className="text-lg font-bold text-slate-900">
            족보
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            국어→영어→숫자 순 · 총 {topicsSorted.length}개
          </p>
        </div>
        <ol className="flex-1 list-decimal overflow-y-auto py-2 pl-9 pr-4 text-sm leading-relaxed text-slate-800 marker:text-sky-600">
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
        <div className="shrink-0 border-t border-slate-200 bg-white p-4">
          <button
            type="button"
            className="w-full rounded-2xl border border-slate-300 bg-amber-50 py-3 text-sm font-medium text-slate-800"
            onClick={onClose}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

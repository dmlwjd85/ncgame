import { useMemo } from 'react'
import { compareTopicOrder } from '../utils/koCompare'

const RULES_SHORT = [
  '최대 15레벨. 레벨 L에서는 각자 L장의 카드로 진행합니다.',
  '1페이즈: 낱말과 해설을 빠르게 맞추면 주제어+해설이 한 장의 카드로 합쳐집니다.',
  '1페이즈 콤보: 5마다 천리안+1, 7에 생명+1, 10에 생명+1·천리안+1, 15에 생명+2·천리안+2.',
  '2페이즈: 국어 사전순으로 카드를 올립니다. 제한 시간은 레벨×5초이며, 마지막 2초는 플레이어 반응용으로 비워 둡니다.',
  '가상 플레이어는 족보(사전순)대로 시간에 맞춰 자동 제출합니다.',
  '순서가 틀리면, 앞에 내지 못한 카드 수만큼 생명이 줄어듭니다.',
  '천리안: 상대 뒤집힌 카드 한 장을 볼 수 있습니다(기본 1장, 1페이즈 보상으로 증가).',
]

/**
 * 팩 선택 후 게임 방법·족보 미리보기
 */
export default function GameHelpModal({
  open,
  onClose,
  pack,
  botCount,
  onBotCountChange,
  onStart,
}) {
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 pb-8 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-title"
    >
      <div className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-gradient-to-b from-slate-900/95 to-slate-950/98 p-6 shadow-2xl shadow-cyan-900/20">
        <h2 id="help-title" className="text-lg font-bold text-white">
          게임 방법 · 족보
        </h2>
        <p className="mt-1 text-xs text-slate-500">{pack.sourceFile} · {pack.sheetName}</p>

        <ul className="mt-4 space-y-2 text-sm leading-relaxed text-slate-300">
          {RULES_SHORT.map((line) => (
            <li key={line} className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400/80" />
              {line}
            </li>
          ))}
        </ul>

        <div className="mt-6">
          <p className="text-xs font-medium uppercase tracking-[0.15em] text-slate-500">
            족보 미리보기 (국어 사전순)
          </p>
          <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs text-cyan-100/90">
            {topicsSorted.length === 0 ? (
              <span className="text-slate-500">주제어 없음</span>
            ) : (
              <ol className="list-decimal space-y-0.5 pl-4">
                {topicsSorted.slice(0, 40).map((t, i) => (
                  <li key={`${t}-${i}`}>{t}</li>
                ))}
                {topicsSorted.length > 40 ? (
                  <li className="list-none text-slate-500">
                    … 외 {topicsSorted.length - 40}개
                  </li>
                ) : null}
              </ol>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
          <span className="text-slate-400">가상 플레이어</span>
          <label className="flex items-center gap-1.5 text-slate-200">
            <input
              type="radio"
              name="modal-bots"
              checked={botCount === 1}
              onChange={() => onBotCountChange(1)}
            />
            1명
          </label>
          <label className="flex items-center gap-1.5 text-slate-200">
            <input
              type="radio"
              name="modal-bots"
              checked={botCount === 2}
              onChange={() => onBotCountChange(2)}
            />
            2명
          </label>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            className="flex-1 rounded-2xl border border-white/15 bg-white/5 py-3 text-sm font-medium text-slate-300"
            onClick={onClose}
          >
            닫기
          </button>
          <button
            type="button"
            className="flex-1 rounded-2xl bg-gradient-to-r from-cyan-500 to-violet-600 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-900/30"
            onClick={onStart}
          >
            시작하기
          </button>
        </div>
      </div>
    </div>
  )
}

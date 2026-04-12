import { loadHallOfFame } from '../utils/hallOfFame'

/**
 * 단어팩별 최고 레벨 (로컬 저장)
 */
export default function HallOfFamePanel({ packs }) {
  const hall = loadHallOfFame()

  if (!packs?.length) {
    return (
      <p className="text-sm text-slate-500">등록된 팩이 없습니다.</p>
    )
  }

  return (
    <ul className="space-y-2">
      {packs.map((p) => {
        const rec = hall[p.id]
        return (
          <li
            key={p.id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm backdrop-blur-sm"
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-100">{p.sheetName}</p>
              <p className="truncate text-xs text-slate-500">{p.sourceFile}</p>
            </div>
            <div className="shrink-0 text-right">
              {rec ? (
                <>
                  <p className="font-mono text-lg font-bold text-amber-200">
                    Lv.{rec.maxLevel}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {rec.displayName} ·{' '}
                    {rec.at ? new Date(rec.at).toLocaleDateString('ko-KR') : ''}
                  </p>
                </>
              ) : (
                <p className="text-xs text-slate-600">기록 없음</p>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

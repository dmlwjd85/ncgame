import { useEffect, useMemo, useState } from 'react'
import { subscribePackLeaderboard } from '../services/hallOfFameService'
import { formatHoFDisplayName } from '../utils/displayName'
import { loadHallOfFame } from '../utils/hallOfFame'

/**
 * 단어팩별 최고 레벨 — Firestore 실시간 + 로컬(내 기록)
 */
export default function HallOfFamePanel({ packs }) {
  const local = loadHallOfFame()
  const [boards, setBoards] = useState(
    /** @type {Record<string, Array<{ displayName?: string, maxLevel?: number, uid?: string }>>} */
    ({}),
  )

  useEffect(() => {
    if (!packs.length) return
    const unsubs = packs.map((p) =>
      subscribePackLeaderboard(
        p.id,
        30,
        (rows) => {
          setBoards((prev) => ({ ...prev, [p.id]: rows }))
        },
        () => {
          setBoards((prev) => ({ ...prev, [p.id]: [] }))
        },
      ),
    )
    return () => {
      for (const u of unsubs) u()
    }
  }, [packs])

  const waitingCloud = useMemo(() => {
    if (!packs.length) return false
    return packs.some((p) => !Object.prototype.hasOwnProperty.call(boards, p.id))
  }, [packs, boards])

  if (!packs?.length) {
    return <p className="text-sm text-slate-500">등록된 팩이 없습니다.</p>
  }

  if (waitingCloud) {
    return <p className="text-sm text-slate-500">불러오는 중…</p>
  }

  return (
    <ul className="space-y-3">
      {packs.map((p) => {
        const rec = local[p.id]
        const board = boards[p.id] ?? []
        return (
          <li
            key={p.id}
            className="rounded-2xl border border-amber-200/80 bg-white px-3 py-3 text-sm shadow-sm md:px-4"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 truncate font-medium text-slate-900">{p.sheetName}</p>
              {rec ? (
                <p className="shrink-0 font-mono text-sm font-bold text-amber-700">
                  나 Lv.{rec.maxLevel}
                </p>
              ) : (
                <p className="shrink-0 text-xs text-slate-500">—</p>
              )}
            </div>
            {board.length > 0 ? (
              <ol className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-[11px] text-slate-600 md:text-xs">
                {board.map((row, i) => (
                  <li key={row.uid || `${p.id}-${i}`} className="flex justify-between gap-2">
                    <span className="truncate">
                      {i + 1}. {formatHoFDisplayName(row.displayName)}
                    </span>
                    <span className="shrink-0 font-mono text-amber-700">
                      Lv.{row.maxLevel ?? '—'}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-[11px] text-slate-600">아직 순위가 없어요.</p>
            )}
          </li>
        )
      })}
    </ul>
  )
}

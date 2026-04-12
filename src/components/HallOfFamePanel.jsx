import { useEffect, useState } from 'react'
import { loadPackLeaderboard } from '../services/hallOfFameService'
import { loadHallOfFame } from '../utils/hallOfFame'

/**
 * 단어팩별 최고 레벨 — Firestore 리더보드 + 로컬 기록
 */
export default function HallOfFamePanel({ packs }) {
  const local = loadHallOfFame()
  const [boards, setBoards] = useState(
    /** @type {Record<string, Array<{ displayName?: string, maxLevel?: number, uid?: string }>>} */
    ({}),
  )
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!packs.length) {
        setLoading(false)
        return
      }
      setLoading(true)
      const out = {}
      await Promise.all(
        packs.map(async (p) => {
          out[p.id] = await loadPackLeaderboard(p.id, 30)
        }),
      )
      if (!cancelled) {
        setBoards(out)
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [packs])

  if (!packs?.length) {
    return <p className="text-sm text-slate-500">등록된 팩이 없습니다.</p>
  }

  if (loading) {
    return <p className="text-sm text-slate-500">동기화 중…</p>
  }

  return (
    <ul className="space-y-3">
      {packs.map((p) => {
        const rec = local[p.id]
        const board = boards[p.id] ?? []
        return (
          <li
            key={p.id}
            className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm backdrop-blur-sm md:px-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-100">{p.sheetName}</p>
                <p className="truncate text-xs text-slate-500">{p.sourceFile}</p>
              </div>
              {rec ? (
                <p className="shrink-0 font-mono text-sm font-bold text-amber-200">
                  나 Lv.{rec.maxLevel}
                </p>
              ) : (
                <p className="shrink-0 text-xs text-slate-600">로컬 없음</p>
              )}
            </div>
            {board.length > 0 ? (
              <ol className="mt-2 space-y-1 border-t border-white/5 pt-2 text-[11px] text-slate-400 md:text-xs">
                {board.map((row, i) => (
                  <li key={row.uid || `${p.id}-${i}`} className="flex justify-between gap-2">
                    <span className="truncate">
                      {i + 1}. {row.displayName || '—'}
                    </span>
                    <span className="shrink-0 font-mono text-amber-200/90">
                      Lv.{row.maxLevel ?? '—'}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-[11px] text-slate-600">
                클라우드 기록이 없습니다. 로그인 후 플레이하면 동기화됩니다.
              </p>
            )}
          </li>
        )
      })}
    </ul>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { subscribePackLeaderboard } from '../services/hallOfFameService'
import { formatHoFDisplayName } from '../utils/displayName'
import { loadHallOfFame } from '../utils/hallOfFame'
import { sortLeaderboardRows } from '../utils/leaderboardSort'

/**
 * 단어팩별 최고 레벨 — Firestore 실시간 + 로컬(내 기록)
 * 동률 시 `achievedAt`(또는 기존 `updatedAt`)이 빠른 순으로 표시
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
          setBoards((prev) => ({ ...prev, [p.id]: sortLeaderboardRows(rows) }))
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
    return <p className="text-sm text-[var(--hof-muted)]">등록된 팩이 없습니다.</p>
  }

  if (waitingCloud) {
    return <p className="text-sm text-[var(--hof-muted)]">불러오는 중…</p>
  }

  return (
    <ul className="hof-pack-list space-y-4 pb-2">
      {packs.map((p) => {
        const rec = local[p.id]
        const board = boards[p.id] ?? []
        const top = board[0]
        return (
          <li
            key={p.id}
            className="hof-marble-card rounded-2xl border border-[var(--hof-border)] bg-[var(--hof-card)] px-3 py-3 text-sm shadow-[var(--hof-card-shadow)] md:px-4"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 truncate font-semibold text-[var(--hof-ink)]">
                {p.sheetName}
              </p>
              {rec ? (
                <p className="shrink-0 font-mono text-sm font-bold text-[var(--hof-gold-dark)]">
                  나 Lv.{rec.maxLevel}
                </p>
              ) : (
                <p className="shrink-0 text-xs text-[var(--hof-muted)]">—</p>
              )}
            </div>

            {top ? (
              <div className="mt-2 rounded-xl border border-amber-200/60 bg-gradient-to-br from-amber-50/90 to-stone-100/80 px-2.5 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-900/70">
                  최고 기록
                </p>
                <p className="mt-0.5 truncate text-sm font-bold text-stone-800">
                  {formatHoFDisplayName(top.displayName)}{' '}
                  <span className="font-mono text-amber-800">Lv.{top.maxLevel ?? '—'}</span>
                </p>
              </div>
            ) : null}

            {board.length > 0 ? (
              <ol className="mt-2 space-y-1 border-t border-[var(--hof-border)] pt-2 text-[11px] text-[var(--hof-muted)] md:text-xs">
                {board.map((row, i) => (
                  <li
                    key={row.uid ?? row.id ?? `${p.id}-${i}`}
                    className={`flex justify-between gap-2 rounded-lg px-1 py-0.5 ${
                      i === 0 ? 'bg-amber-100/50 text-stone-800' : ''
                    }`}
                  >
                    <span className="min-w-0 truncate">
                      <span className="inline-block w-5 font-mono text-[var(--hof-gold-dark)]">
                        {i + 1}.
                      </span>{' '}
                      {formatHoFDisplayName(row.displayName)}
                    </span>
                    <span className="shrink-0 font-mono text-[var(--hof-gold-dark)]">
                      Lv.{row.maxLevel ?? '—'}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-[11px] text-[var(--hof-muted)]">아직 순위가 없어요.</p>
            )}
          </li>
        )
      })}
    </ul>
  )
}

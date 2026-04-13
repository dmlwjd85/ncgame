import { useEffect, useMemo, useState } from 'react'
import { subscribePackLeaderboard } from '../services/hallOfFameService'
import { formatHoFDisplayName } from '../utils/displayName'
import { loadHallOfFame } from '../utils/hallOfFame'
import { sortLeaderboardRows } from '../utils/leaderboardSort'

/**
 * 단어팩별 최고 레벨 — Firestore 실시간 + 로컬(내 기록)
 * 요약: 팩 옆에 1위만 표시, 클릭 시 상위 1~5위 모달 (비로그인 사용자도 조회 가능)
 */
export default function HallOfFamePanel({ packs }) {
  const local = loadHallOfFame()
  const [boards, setBoards] = useState(
    /** @type {Record<string, Array<{ displayName?: string, maxLevel?: number, uid?: string }>>} */
    ({}),
  )
  const [openPackId, setOpenPackId] = useState(/** @type {string | null} */ (null))

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

  useEffect(() => {
    if (!openPackId) return
    const onKey = (e) => {
      if (e.key === 'Escape') setOpenPackId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openPackId])

  const waitingCloud = useMemo(() => {
    if (!packs.length) return false
    return packs.some((p) => !Object.prototype.hasOwnProperty.call(boards, p.id))
  }, [packs, boards])

  const openPack = useMemo(
    () => packs.find((p) => p.id === openPackId) ?? null,
    [packs, openPackId],
  )
  const openBoard = openPackId ? (boards[openPackId] ?? []) : []
  const topFive = openBoard.slice(0, 5)

  if (!packs?.length) {
    return <p className="text-sm text-[var(--hof-muted)]">등록된 팩이 없습니다.</p>
  }

  if (waitingCloud) {
    return <p className="text-sm text-[var(--hof-muted)]">불러오는 중…</p>
  }

  return (
    <>
      <ul className="hof-pack-list space-y-3 pb-2">
        {packs.map((p) => {
          const rec = local[p.id]
          const board = boards[p.id] ?? []
          const top = board[0]
          return (
            <li
              key={p.id}
              className="hof-marble-card rounded-2xl border border-[var(--hof-border)] bg-[var(--hof-card)] px-3 py-3 text-sm shadow-[var(--hof-card-shadow)] md:px-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="min-w-0 font-semibold text-[var(--hof-ink)]">{p.sheetName}</p>
                {rec ? (
                  <p className="shrink-0 font-mono text-xs font-bold text-[var(--hof-gold-dark)]">
                    나 Lv.{rec.maxLevel}
                  </p>
                ) : (
                  <p className="shrink-0 text-xs text-[var(--hof-muted)]">—</p>
                )}
              </div>

              <button
                type="button"
                onClick={() => setOpenPackId(p.id)}
                className="mt-2 w-full rounded-xl border border-amber-200/70 bg-gradient-to-br from-amber-50/95 to-stone-100/85 px-3 py-2.5 text-left transition hover:ring-2 hover:ring-amber-300/50"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-900/70">
                  1위
                </p>
                {top ? (
                  <p className="mt-0.5 truncate text-sm font-bold text-stone-800">
                    {formatHoFDisplayName(top.displayName)}{' '}
                    <span className="font-mono text-amber-800">Lv.{top.maxLevel ?? '—'}</span>
                  </p>
                ) : (
                  <p className="mt-0.5 text-sm text-stone-600">아직 1위 기록이 없어요</p>
                )}
                <p className="mt-1 text-[10px] text-amber-900/60">탭하여 상위 1~5위 보기</p>
              </button>
            </li>
          )
        })}
      </ul>

      {openPackId && openPack ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-3 sm:items-center"
          role="presentation"
          onClick={() => setOpenPackId(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="hof-modal-title"
            className="max-h-[min(85dvh,520px)] w-full max-w-md overflow-hidden rounded-2xl border border-[var(--hof-border)] bg-[var(--hof-card)] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-[var(--hof-border)] px-4 py-3">
              <h2 id="hof-modal-title" className="text-base font-semibold text-[var(--hof-ink)]">
                {openPack.sheetName}
              </h2>
              <p className="mt-0.5 text-xs text-[var(--hof-muted)]">상위 1~5위 (동일 레벨은 먼저 달성한 순)</p>
            </div>
            <div className="max-h-[min(60dvh,360px)] overflow-y-auto px-3 py-2">
              {topFive.length > 0 ? (
                <ol className="space-y-2">
                  {topFive.map((row, i) => (
                    <li
                      key={row.uid ?? row.id ?? `${openPackId}-${i}`}
                      className={`flex items-center justify-between gap-2 rounded-xl px-2 py-2 text-sm ${
                        i === 0 ? 'bg-amber-100/70 text-stone-900' : 'text-[var(--hof-ink)]'
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="inline-block w-7 font-mono font-bold text-[var(--hof-gold-dark)]">
                          {i + 1}.
                        </span>
                        <span className="font-medium">{formatHoFDisplayName(row.displayName)}</span>
                      </span>
                      <span className="shrink-0 font-mono font-semibold text-[var(--hof-gold-dark)]">
                        Lv.{row.maxLevel ?? '—'}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="py-6 text-center text-sm text-[var(--hof-muted)]">아직 순위가 없어요.</p>
              )}
            </div>
            <div className="border-t border-[var(--hof-border)] px-3 py-3">
              <button
                type="button"
                className="w-full rounded-xl bg-stone-800 py-2.5 text-sm font-medium text-white hover:bg-stone-700"
                onClick={() => setOpenPackId(null)}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

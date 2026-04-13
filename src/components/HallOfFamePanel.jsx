import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  subscribePackComboLeaderboard,
  subscribePackLeaderboard,
} from '../services/hallOfFameService'
import { formatHoFDisplayName } from '../utils/displayName'
import { loadHallOfFame, loadHallOfFameCombo } from '../utils/hallOfFame'
import { sortComboLeaderboardRows, sortLeaderboardRows } from '../utils/leaderboardSort'

/**
 * 단어팩별 명예 — 눈치게임(최고 레벨)·무한도전(최고 연속) 분리 표시
 * 클릭 시 각각 상위 1~5위 모달
 */
export default function HallOfFamePanel({ packs }) {
  const localLevel = loadHallOfFame()
  const localCombo = loadHallOfFameCombo()
  const [boardsLevel, setBoardsLevel] = useState(
    /** @type {Record<string, Array<{ displayName?: string, maxLevel?: number, uid?: string }>>} */
    ({}),
  )
  const [boardsCombo, setBoardsCombo] = useState(
    /** @type {Record<string, Array<{ displayName?: string, maxCombo?: number, uid?: string }>>} */
    ({}),
  )
  const [openModal, setOpenModal] = useState(
    /** @type {{ packId: string, mode: 'level' | 'combo' } | null} */ (null),
  )

  useEffect(() => {
    if (!packs.length) return
    const unsubs = []
    for (const p of packs) {
      unsubs.push(
        subscribePackLeaderboard(
          p.id,
          30,
          (rows) => {
            setBoardsLevel((prev) => ({
              ...prev,
              [p.id]: sortLeaderboardRows(rows),
            }))
          },
          () => {
            setBoardsLevel((prev) => ({ ...prev, [p.id]: [] }))
          },
        ),
      )
      unsubs.push(
        subscribePackComboLeaderboard(
          p.id,
          30,
          (rows) => {
            setBoardsCombo((prev) => ({
              ...prev,
              [p.id]: sortComboLeaderboardRows(rows),
            }))
          },
          () => {
            setBoardsCombo((prev) => ({ ...prev, [p.id]: [] }))
          },
        ),
      )
    }
    return () => {
      for (const u of unsubs) u()
    }
  }, [packs])

  useEffect(() => {
    if (!openModal) return
    const onKey = (e) => {
      if (e.key === 'Escape') setOpenModal(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openModal])

  const waitingCloud = useMemo(() => {
    if (!packs.length) return false
    return packs.some(
      (p) =>
        !Object.prototype.hasOwnProperty.call(boardsLevel, p.id) ||
        !Object.prototype.hasOwnProperty.call(boardsCombo, p.id),
    )
  }, [packs, boardsLevel, boardsCombo])

  const openPack = useMemo(
    () => packs.find((p) => p.id === openModal?.packId) ?? null,
    [packs, openModal],
  )
  const openBoard =
    openModal?.mode === 'combo'
      ? openModal?.packId
        ? (boardsCombo[openModal.packId] ?? [])
        : []
      : openModal?.packId
        ? (boardsLevel[openModal.packId] ?? [])
        : []
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
          const recL = localLevel[p.id]
          const recC = localCombo[p.id]
          const boardL = boardsLevel[p.id] ?? []
          const boardC = boardsCombo[p.id] ?? []
          const topL = boardL[0]
          const topC = boardC[0]
          return (
            <li
              key={p.id}
              className="hof-marble-card rounded-2xl border border-[var(--hof-border)] bg-[var(--hof-card)] px-3 py-3 text-sm shadow-[var(--hof-card-shadow)] md:px-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="min-w-0 font-semibold text-[var(--hof-ink)]">{p.sheetName}</p>
                <p className="shrink-0 max-w-[11rem] text-right text-[10px] leading-tight text-[var(--hof-muted)]">
                  {recL || recC ? (
                    <>
                      {recL ? (
                        <span className="font-mono font-bold text-[var(--hof-gold-dark)]">
                          나 Lv.{recL.maxLevel}
                        </span>
                      ) : null}
                      {recL && recC ? <span className="text-slate-400"> · </span> : null}
                      {recC ? (
                        <span className="font-mono font-bold text-violet-700/90">
                          나 {recC.maxCombo}연속
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <span>—</span>
                  )}
                </p>
              </div>

              <div className="mt-2 grid gap-2">
                <button
                  type="button"
                  onClick={() => setOpenModal({ packId: p.id, mode: 'level' })}
                  className="w-full rounded-xl border border-amber-200/70 bg-gradient-to-br from-amber-50/95 to-stone-100/85 px-3 py-2 text-left transition hover:ring-2 hover:ring-amber-300/50"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-900/70">
                    눈치게임 · 1위
                  </p>
                  {topL ? (
                    <p className="mt-0.5 truncate text-sm font-bold text-stone-800">
                      {formatHoFDisplayName(topL.displayName)}{' '}
                      <span className="font-mono text-amber-800">
                        Lv.{topL.maxLevel ?? '—'}
                      </span>
                    </p>
                  ) : (
                    <p className="mt-0.5 text-sm text-stone-600">아직 기록이 없어요</p>
                  )}
                  <p className="mt-1 text-[10px] text-amber-900/60">탭하여 상위 1~5위</p>
                </button>

                <button
                  type="button"
                  onClick={() => setOpenModal({ packId: p.id, mode: 'combo' })}
                  className="w-full rounded-xl border border-violet-200/80 bg-gradient-to-br from-violet-50/95 to-indigo-50/90 px-3 py-2 text-left transition hover:ring-2 hover:ring-violet-300/50"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-900/75">
                    무한도전 · 1위
                  </p>
                  {topC ? (
                    <p className="mt-0.5 truncate text-sm font-bold text-stone-800">
                      {formatHoFDisplayName(topC.displayName)}{' '}
                      <span className="font-mono text-violet-800">
                        {topC.maxCombo ?? '—'}연속
                      </span>
                    </p>
                  ) : (
                    <p className="mt-0.5 text-sm text-stone-600">아직 기록이 없어요</p>
                  )}
                  <p className="mt-1 text-[10px] text-violet-900/55">탭하여 상위 1~5위</p>
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      {openModal && openPack
        ? createPortal(
            <div
              className="fixed inset-0 z-[600] flex items-center justify-center bg-black/80 p-4"
              role="presentation"
              onClick={() => setOpenModal(null)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="hof-modal-title"
                className="max-h-[min(85dvh,520px)] w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <h2
                    id="hof-modal-title"
                    className="text-base font-semibold text-slate-900"
                  >
                    {openPack.sheetName}{' '}
                    <span className="font-normal text-slate-600">
                      — {openModal.mode === 'combo' ? '무한도전' : '눈치게임'}
                    </span>
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-600">
                    상위 1~5위 (
                    {openModal.mode === 'combo'
                      ? '동일 연속은 먼저 달성한 순'
                      : '동일 레벨은 먼저 달성한 순'}
                    )
                  </p>
                </div>
                <div className="max-h-[min(60dvh,360px)] overflow-y-auto bg-white px-3 py-3">
                  {topFive.length > 0 ? (
                    <ol className="space-y-2">
                      {topFive.map((row, i) => (
                        <li
                          key={row.uid ?? row.id ?? `${openModal.packId}-${i}`}
                          className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm ${
                            i === 0
                              ? openModal.mode === 'combo'
                                ? 'bg-violet-100 text-violet-950'
                                : 'bg-amber-100 text-amber-950'
                              : 'bg-slate-50 text-slate-900'
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="inline-block w-7 font-mono font-bold text-amber-800">
                              {i + 1}.
                            </span>
                            <span className="font-medium">
                              {formatHoFDisplayName(row.displayName)}
                            </span>
                          </span>
                          <span className="shrink-0 font-mono font-semibold text-amber-900">
                            {openModal.mode === 'combo'
                              ? `${row.maxCombo ?? '—'}연속`
                              : `Lv.${row.maxLevel ?? '—'}`}
                          </span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="py-6 text-center text-sm text-slate-600">
                      아직 순위가 없어요.
                    </p>
                  )}
                </div>
                <div className="border-t border-slate-200 bg-white px-3 py-3">
                  <button
                    type="button"
                    className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
                    onClick={() => setOpenModal(null)}
                  >
                    닫기
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

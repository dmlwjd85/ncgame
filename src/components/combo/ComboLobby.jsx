import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCardPacks } from '../../contexts/CardPackContext'
import { getPracticeComboRecord } from '../../utils/hallOfFame'
import { maxLevelFromRowCount } from '../../utils/gameRules'
import { displaySheetName, isJeongeon100Pack } from '../../utils/tutorialPack'

function comboPackPlayable(p) {
  const validRows = p.rows.filter((r) => r.topic && r.explanation)
  const maxLv = maxLevelFromRowCount(validRows.length)
  return (
    maxLv >= 1 && p.missingColumns.length === 0 && validRows.length > 0
  )
}

/**
 * 무한도전 로비 — 단어팩·모드·시작하기
 * @param {{ variant?: 'page' | 'embedded', defaultPackId?: string | null, defaultMode?: 'challenge' | 'practice', onBegin: (packId: string, mode: 'challenge' | 'practice') => void }} props
 */
export function ComboLobby({
  variant = 'page',
  defaultPackId = null,
  defaultMode = 'challenge',
  onBegin,
}) {
  const { packs, loading, error } = useCardPacks()
  const [packId, setPackId] = useState(/** @type {string | null} */ (null))
  const [mode, setMode] = useState(
    /** @type {'challenge' | 'practice'} */ (
      defaultMode === 'practice' ? 'practice' : 'challenge'
    ),
  )

  useEffect(() => {
    queueMicrotask(() => {
      if (defaultPackId && packs.length > 0) {
        const exists = packs.some(
          (p) => String(p.id) === String(defaultPackId),
        )
        if (exists) setPackId(String(defaultPackId))
      }
      if (defaultMode === 'practice') setMode('practice')
      else setMode('challenge')
    })
  }, [defaultPackId, defaultMode, packs])

  const playablePacks = useMemo(
    () => packs.filter(comboPackPlayable),
    [packs],
  )

  const practiceRecord =
    packId != null ? getPracticeComboRecord(String(packId)) : null

  const inner = (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
      {variant === 'page' ? (
        <header className="flex flex-wrap items-center justify-between gap-2">
          <Link
            to="/"
            className="text-sm font-medium text-sky-300 underline underline-offset-2"
          >
            ← 홈
          </Link>
          <span className="text-xs font-medium text-zinc-300">무한도전</span>
        </header>
      ) : (
        <header className="border-b border-violet-500/25 pb-2">
          <h2 className="font-display text-base font-bold text-violet-200">
            무한도전
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-zinc-200">
            팩·모드를 고른 뒤 시작하면 플레이 화면으로 이동합니다.
          </p>
        </header>
      )}

      {variant === 'page' ? (
        <div>
          <h1 className="font-display text-xl font-bold text-violet-200">
            무한도전
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-zinc-200">
            단어팩과 모드를 고른 뒤{' '}
            <span className="font-semibold text-amber-200">시작하기</span>를 누르면
            바로 플레이 화면으로 넘어갑니다.
          </p>
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-zinc-200">불러오는 중…</p>
      ) : error ? (
        <p className="text-sm text-amber-200/90">{error}</p>
      ) : (
        <>
          <section className="rounded-2xl border border-zinc-600/80 bg-zinc-900/75 p-4 shadow-lg">
            <h2 className="text-sm font-bold text-zinc-50">1. 단어팩</h2>
            {playablePacks.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-200">
                지금 도전 가능한 팩이 없어요. 눈치게임 탭에서 엑셀 구성을 확인해 주세요.
              </p>
            ) : (
              <ul className="mt-3 max-h-[min(38dvh,18rem)] space-y-2 overflow-y-auto pr-1 [-webkit-overflow-scrolling:touch]">
                {playablePacks.map((p) => {
                  const sel = String(packId) === String(p.id)
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => setPackId(String(p.id))}
                        className={`flex w-full rounded-xl border-2 px-3 py-3 text-left text-sm font-semibold transition ${
                          sel
                            ? 'border-violet-400 bg-violet-950/50 text-zinc-50 ring-2 ring-violet-400/40'
                            : 'border-zinc-600/90 bg-zinc-950/40 text-zinc-100 hover:border-zinc-500'
                        }`}
                      >
                        <span className="block">{displaySheetName(p)}</span>
                        {isJeongeon100Pack(p) ? (
                          <span className="mt-1 block text-[11px] font-normal text-amber-200/90">
                            시간 순(엑셀 행 순) 카드팩
                          </span>
                        ) : null}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-zinc-600/80 bg-zinc-900/75 p-4 shadow-lg">
            <h2 className="text-sm font-bold text-zinc-50">2. 모드</h2>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setMode('challenge')}
                className={`flex-1 rounded-xl py-3 text-sm font-semibold ${
                  mode === 'challenge'
                    ? 'bg-violet-600 text-white ring-2 ring-violet-300/80'
                    : 'border border-zinc-600 bg-zinc-950/50 text-zinc-100 hover:bg-zinc-800/80'
                }`}
              >
                도전모드
              </button>
              <button
                type="button"
                onClick={() => setMode('practice')}
                className={`flex-1 rounded-xl py-3 text-sm font-semibold ${
                  mode === 'practice'
                    ? 'bg-emerald-600 text-white ring-2 ring-emerald-300/80'
                    : 'border border-zinc-600 bg-zinc-950/50 text-zinc-100 hover:bg-zinc-800/80'
                }`}
              >
                연습모드
              </button>
            </div>
            <ul className="mt-3 list-inside list-disc space-y-1.5 text-xs leading-relaxed text-zinc-200">
              {mode === 'challenge' ? (
                <>
                  <li>5초 제한, 명예의 전당(도전 최고 연속) 반영.</li>
                  <li>
                    로그인 시 가끔 1~5포인트 도전 팝업(튜토·동물·식물 팩 제외).
                  </li>
                </>
              ) : (
                <>
                  <li>시간 제한 없음, 포인트·보상 팝업 없음.</li>
                  <li>연습 최고 연속은 이 기기에만 저장됩니다.</li>
                </>
              )}
            </ul>
            {mode === 'practice' && practiceRecord ? (
              <p className="mt-2 text-xs font-medium text-emerald-200">
                선택한 팩 연습 최고 연속:{' '}
                <span className="font-mono">{practiceRecord.maxCombo}</span>
              </p>
            ) : null}
          </section>

          <button
            type="button"
            disabled={!packId || playablePacks.length === 0}
            className="w-full rounded-2xl bg-gradient-to-r from-amber-600 to-rose-700 py-4 text-base font-bold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-45"
            onClick={() => {
              if (!packId) return
              onBegin(packId, mode)
            }}
          >
            시작하기
          </button>
        </>
      )}
    </div>
  )

  if (variant === 'page') {
    return (
      <div className="game-shell combo-lobby min-h-dvh px-4 pb-8 pt-4 text-zinc-100">
        {inner}
      </div>
    )
  }

  return (
    <section className="card-lift-3d mx-auto mt-2 w-full rounded-2xl border border-violet-500/35 bg-slate-900/55 px-4 py-4 text-zinc-100">
      {inner}
    </section>
  )
}

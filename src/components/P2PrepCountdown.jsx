import { useEffect, useRef, useState } from 'react'
import { phase2SecondsForLevel } from '../utils/gameRules'
import { sfxTick } from '../utils/gameSfx'

/**
 * 2페이즈 직전 5초 카운트다운 — 이 동안 내 카드(이번 레벨 덱)를 미리 보여 줌
 * @param {{ level: number, playerCards: object[], onComplete: () => void }} props
 */
export default function P2PrepCountdown({ level, playerCards = [], onComplete }) {
  const [n, setN] = useState(5)
  const firedRef = useRef(false)

  useEffect(() => {
    if (n <= 0) return
    const id = window.setTimeout(() => setN((x) => x - 1), 1000)
    return () => window.clearTimeout(id)
  }, [n])

  useEffect(() => {
    if (n > 0 && n <= 5) {
      sfxTick()
    }
  }, [n])

  useEffect(() => {
    if (n > 0 || firedRef.current) return
    firedRef.current = true
    queueMicrotask(() => onComplete())
  }, [n, onComplete])

  return (
    <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-5 px-2 text-center">
      <p className="text-base font-semibold leading-relaxed text-slate-900 md:text-xl">
        국어→영어→숫자 순으로 눈치껏 카드를 내세요!
      </p>
      <p
        className="text-7xl font-black tabular-nums text-transparent md:text-8xl bg-gradient-to-br from-cyan-300 to-violet-400 bg-clip-text"
        aria-live="polite"
      >
        {n > 0 ? n : '…'}
      </p>
      <div className="w-full max-w-md rounded-2xl border border-emerald-200 bg-white/95 px-3 py-4 text-left shadow-md">
        <p className="text-center text-[11px] font-medium text-emerald-800 md:text-xs">
          이번 라운드 내 카드 ({playerCards.length}장)
        </p>
        <div className="mt-3 flex max-h-[36dvh] flex-wrap justify-center gap-2 overflow-y-auto">
          {playerCards.length === 0 ? (
            <span className="text-xs text-slate-500">카드 준비 중…</span>
          ) : (
            playerCards.map((c) => (
              <div
                key={c.id}
                className="min-w-[5rem] max-w-[9rem] rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white px-2.5 py-2 shadow-sm"
              >
                <span className="block text-xs font-semibold text-emerald-900 md:text-sm">
                  {c.topic}
                </span>
                {c.explanation ? (
                  <span className="mt-1 line-clamp-2 text-[10px] text-emerald-800/80 md:text-[11px]">
                    {c.explanation}
                  </span>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>
      <p className="max-w-xs text-xs text-slate-600 md:text-sm">
        제한 시간 {phase2SecondsForLevel(level)}초 · 천리안 사용 시 타이머가 잠시 멈춥니다
      </p>
    </div>
  )
}

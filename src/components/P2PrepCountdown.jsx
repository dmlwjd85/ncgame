import { useEffect, useRef, useState } from 'react'
import { phase2SecondsForLevel } from '../utils/gameRules'

/**
 * 2페이즈 직전 5초 카운트다운 + 안내 멘트
 */
export default function P2PrepCountdown({ level, onComplete }) {
  const [n, setN] = useState(5)
  const firedRef = useRef(false)

  useEffect(() => {
    if (n <= 0) return
    const id = window.setTimeout(() => setN((x) => x - 1), 1000)
    return () => window.clearTimeout(id)
  }, [n])

  useEffect(() => {
    if (n > 0 || firedRef.current) return
    firedRef.current = true
    queueMicrotask(() => onComplete())
  }, [n, onComplete])

  return (
    <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-6 px-2 text-center">
      <p className="text-base font-semibold leading-relaxed text-white md:text-xl">
        가나다 순으로 눈치껏 카드를 내세요!!
      </p>
      <p
        className="text-7xl font-black tabular-nums text-transparent md:text-8xl bg-gradient-to-br from-cyan-300 to-violet-400 bg-clip-text"
        aria-live="polite"
      >
        {n > 0 ? n : '…'}
      </p>
      <p className="max-w-xs text-xs text-slate-500 md:text-sm">
        제한 시간 {phase2SecondsForLevel(level)}초 · 마지막 2초는 플레이어 반응용 · 천리안
        사용 시 타이머 정지
      </p>
    </div>
  )
}

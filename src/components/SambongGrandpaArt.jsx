import { useId } from 'react'

/**
 * 삼봉당 할아버지 일러스트 — 인라인 SVG(배포 경로·번들 URL 이슈 없이 표시)
 */
export default function SambongGrandpaArt({
  className = 'h-28 w-28 object-contain drop-shadow-md sm:h-32 sm:w-32',
}) {
  const gradId = useId().replace(/:/g, '')
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 128 128"
      width={128}
      height={128}
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f5e6d3" />
          <stop offset="100%" stopColor="#e2c9a8" />
        </linearGradient>
      </defs>
      <circle cx="64" cy="72" r="46" fill={`url(#${gradId})`} stroke="#8b5a2b" strokeWidth="3" />
      <ellipse cx="64" cy="58" rx="34" ry="38" fill="#f0dcc4" stroke="#7a4a24" strokeWidth="2" />
      <path
        d="M36 54c6-10 18-16 28-16s24 6 30 16"
        fill="none"
        stroke="#6b3f1d"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <ellipse cx="48" cy="56" rx="5" ry="6" fill="#2a1a0f" />
      <ellipse cx="80" cy="56" rx="5" ry="6" fill="#2a1a0f" />
      <path
        d="M54 72c6 8 14 8 20 0"
        fill="none"
        stroke="#6b3f1d"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M58 84c8 6 16 6 24 0"
        fill="none"
        stroke="#a0703a"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <ellipse cx="64" cy="98" rx="22" ry="12" fill="#f3e1cc" stroke="#8b5a2b" strokeWidth="2" />
      <path
        d="M28 40c-4-12 4-22 14-26 6-2 12-2 18 0"
        fill="none"
        stroke="#5c3b1f"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M100 40c4-12-4-22-14-26-6-2-12-2-18 0"
        fill="none"
        stroke="#5c3b1f"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}

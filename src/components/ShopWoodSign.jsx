/**
 * 나무 간판 그래픽 — 상점명은 간판 이미지(인라인 SVG) 안에만 표시
 */
export default function ShopWoodSign() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 280 88"
      className="mx-auto h-auto w-[min(100%,280px)] drop-shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
      role="img"
      aria-label="포인트 상점"
    >
      <defs>
        <linearGradient id="shopWoodGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#7a5a3f" />
          <stop offset="40%" stopColor="#5c4033" />
          <stop offset="100%" stopColor="#3d2a20" />
        </linearGradient>
      </defs>
      <rect x="4" y="8" width="272" height="68" rx="8" fill="url(#shopWoodGrad)" />
      <rect
        x="8"
        y="12"
        width="264"
        height="60"
        rx="5"
        fill="none"
        stroke="#1f140e"
        strokeOpacity="0.35"
        strokeWidth="2"
      />
      <text
        x="140"
        y="54"
        textAnchor="middle"
        style={{
          fontFamily: "'Gowun Batang', 'Gowun Dodum', serif",
          fontSize: '22px',
          fontWeight: 700,
          fill: '#f5e6c8',
          stroke: '#1a1008',
          strokeWidth: 0.5,
        }}
      >
        포인트 상점
      </text>
    </svg>
  )
}

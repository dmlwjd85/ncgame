export const USER_RESERVE_MS = 2000

/**
 * 봇 자동 제출 타이밍 개수만큼 시각(ms) 분배. 끝부분은 플레이어 제출 여유로 비움.
 */
export function scheduleTimes(n, durationMs, reserveMs) {
  const windowMs = Math.max(0, durationMs - reserveMs)
  if (n === 0) return []
  return Array.from({ length: n }, (_, i) => ((i + 1) / (n + 1)) * windowMs)
}

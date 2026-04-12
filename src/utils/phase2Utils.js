export const USER_RESERVE_MS = 2000

/** 봇 카드 사이 사람 반응 시간(ms), 라운드 끝 여유(ms) */
export const BOT_HUMAN_GAP_MS = 1500
export const BOT_END_BUFFER_MS = 1500

/**
 * 봇 자동 제출 타이밍 개수만큼 시각(ms) 분배. 끝부분은 플레이어 제출 여유로 비움.
 * @deprecated scheduleBotFireTimes 사용 권장
 */
export function scheduleTimes(n, durationMs, reserveMs) {
  const windowMs = Math.max(0, durationMs - reserveMs)
  if (n === 0) return []
  return Array.from({ length: n }, (_, i) => ((i + 1) / (n + 1)) * windowMs)
}

/**
 * 족보 순 봇 제출 시각(k개). 봇 카드 사이 최소 BOT_HUMAN_GAP_MS, 마지막 BOT_END_BUFFER_MS는 비움.
 */
export function scheduleBotFireTimes(k, durationMs) {
  if (k <= 0) return []
  const lastLatest = Math.max(0, durationMs - BOT_END_BUFFER_MS)
  const GAP = BOT_HUMAN_GAP_MS
  if (k === 1) return [0]
  const minSpan = (k - 1) * GAP
  if (lastLatest < minSpan) {
    return Array.from({ length: k }, (_, i) =>
      Math.min(i * GAP, lastLatest),
    )
  }
  const slack = lastLatest - minSpan
  return Array.from({ length: k }, (_, i) =>
    i * GAP + (i / (k - 1)) * slack,
  )
}

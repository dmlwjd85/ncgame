export const USER_RESERVE_MS = 2000

/** 봇이 첫 카드를 내기 전 암묵적 대기(ms) — 유저가 끼워 넣을 시간 확보 */
export const BOT_PLAY_START_DELAY_MS = 2000

/** 봇 카드 사이 사람 반응 시간(ms), 라운드 끝 여유(ms) */
export const BOT_HUMAN_GAP_MS = 1500
export const BOT_END_BUFFER_MS = 1500

/** 족보 앞쪽(ㄱ에 가까운 순)일수록 빠르게, 뒤(ㅎ)일수록 늦게 보이도록 슬랙 분배 */
function easeOutQuad(t) {
  const u = Math.min(1, Math.max(0, t))
  return 1 - (1 - u) * (1 - u)
}

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
 * 족보 순 봇 제출 시각(k개, 이미 ㄱ→ㅎ 순으로 정렬된 봇 플레이 개수).
 * - 첫 봇 제출은 BOT_PLAY_START_DELAY_MS 이후(라운드가 짧으면 가능한 만큼만 지연).
 * - 봇 카드 사이 최소 BOT_HUMAN_GAP_MS, 마지막 BOT_END_BUFFER_MS는 비움.
 * - 남는 슬랙은 ease-out으로 뒤쪽(ㅎ에 가까운 순번)으로 더 몰아 유저가 앞쪽 타이밍에 끼워 넣기 쉽게 함.
 */
export function scheduleBotFireTimes(k, durationMs) {
  if (k <= 0) return []
  const GAP = BOT_HUMAN_GAP_MS
  const playWindowEnd = Math.max(0, durationMs - BOT_END_BUFFER_MS)
  const playWindowStart = Math.min(BOT_PLAY_START_DELAY_MS, playWindowEnd)
  const windowLen = Math.max(0, playWindowEnd - playWindowStart)

  if (k === 1) {
    return [playWindowStart]
  }

  const minSpan = (k - 1) * GAP
  if (windowLen < minSpan) {
    return Array.from({ length: k }, (_, i) =>
      Math.min(playWindowStart + i * GAP, playWindowEnd),
    )
  }

  const inner = windowLen - minSpan
  return Array.from({ length: k }, (_, i) => {
    const u = i / (k - 1)
    const eased = easeOutQuad(u)
    return playWindowStart + i * GAP + eased * inner
  })
}

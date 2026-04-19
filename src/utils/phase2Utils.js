/** 라운드 말미 — 플레이어 전용 구간(봇은 이 시간 안에 스케줄되지 않음). 뒤 2초. */
export const USER_RESERVE_MS = 2000

/** 족보 기계 제출: 라운드 시작 후 앞쪽에 비워 두는 시간(ms) */
export const MECHANICAL_LEAD_MS = 2000

/** 봇이 첫 카드를 내기 전 암묵적 대기(ms) — 시작 후 앞 2초는 플레이어 끼워 넣기 여유 */
export const BOT_PLAY_START_DELAY_MS = 2000

/**
 * 족보상 이 봇 카드보다 앞에 있는 '플레이어' 카드 한 장당 최소로 더하는 대기(ms).
 * (앞에 낼 사람 손이 많을수록 봇 첫 제출이 뒤로 밀림 — ㅎ 쪽만 잡혀 있어도 앞선 가나다는 플레이어 몫으로 처리)
 */
export const PLAYER_AHEAD_MS = 480

/** 봇 카드 사이 사람 반응 시간(ms) */
export const BOT_HUMAN_GAP_MS = 880

/** @deprecated USER_RESERVE_MS 사용 — 끝 비우기는 플레이어 예약과 동일 */
export const BOT_END_BUFFER_MS = USER_RESERVE_MS

/** 족보 앞쪽(ㄱ에 가까운 순)일수록 빠르게, 뒤(ㅎ)일수록 늦게 보이도록 슬랙 분배 */
function easeOutQuad(t) {
  const u = Math.min(1, Math.max(0, t))
  return 1 - (1 - u) * (1 - u)
}

/**
 * 봇 자동 제출 타이밍 개수만큼 시각(ms) 분배. 끝부분은 플레이어 제출 여유로 비움.
 * @deprecated scheduleBotFireTimesFromFloors 사용 권장
 */
export function scheduleTimes(n, durationMs, reserveMs) {
  const windowMs = Math.max(0, durationMs - reserveMs)
  if (n === 0) return []
  return Array.from({ length: n }, (_, i) => ((i + 1) / (n + 1)) * windowMs)
}

/**
 * 플레이어 선행 매수·최소 시각(minFloors)을 반영해 봇 제출 시각(ms) 배열을 만든다.
 * - minFloors[i]: i번째 봇 플레이(족보 순)가 **이 시각 이전에는** 오지 않도록 하는 하한.
 * - 봇 사이는 BOT_HUMAN_GAP_MS를 기본으로 두되, 라운드 길이에 안 맞으면 간격을 줄여 맞춘다.
 * - 끝 USER_RESERVE_MS(ms) 앞까지 ease-out으로 남는 시간을 뒤쪽 봇에 더 분배(맨 뒤 2초는 봇 미사용).
 */
export function scheduleBotFireTimesFromFloors(minFloors, durationMs) {
  const k = minFloors.length
  if (k === 0) return []
  const playEnd = Math.max(0, durationMs - USER_RESERVE_MS)
  const f = minFloors.map((m) => Math.min(Math.max(0, m), playEnd))

  let gap = BOT_HUMAN_GAP_MS
  /** @type {number[]} */
  let t = [f[0]]

  for (let attempt = 0; attempt < 24; attempt++) {
    t = [f[0]]
    for (let i = 1; i < k; i++) {
      t[i] = Math.max(f[i], t[i - 1] + gap)
    }
    if (t[k - 1] <= playEnd) break
    gap *= 0.82
  }

  if (t[k - 1] > playEnd) {
    t = [f[0]]
    for (let i = 1; i < k; i++) {
      t[i] = Math.max(f[i], t[i - 1])
    }
    if (t[k - 1] > playEnd && t[k - 1] > f[0]) {
      const s = (playEnd - f[0]) / (t[k - 1] - f[0])
      for (let i = 0; i < k; i++) {
        t[i] = f[0] + (t[i] - f[0]) * s
      }
      for (let i = 0; i < k; i++) {
        t[i] = Math.max(f[i], t[i])
      }
      for (let i = 1; i < k; i++) {
        t[i] = Math.max(t[i], t[i - 1])
      }
    }
    t[k - 1] = Math.min(t[k - 1], playEnd)
    for (let i = k - 2; i >= 0; i--) {
      t[i] = Math.min(t[i], t[i + 1])
      t[i] = Math.max(f[i], t[i])
    }
  }

  const slack = playEnd - t[k - 1]
  if (k > 1 && slack > 0) {
    for (let i = 0; i < k; i++) {
      const u = i / (k - 1)
      t[i] += easeOutQuad(u) * slack
    }
    for (let i = 1; i < k; i++) {
      t[i] = Math.max(t[i], t[i - 1])
    }
    for (let i = k - 1; i >= 0; i--) {
      t[i] = Math.min(t[i], playEnd)
    }
  }

  /** 앞쪽 족보(ㄱ~) 카드는 너무 늦게 나오지 않도록 상한 */
  const lateCap = playEnd * 0.9
  return t.map((x) => Math.round(Math.min(x, lateCap)))
}

/**
 * 선행 플레이어 수를 무시할 때(하한이 모두 동일)의 봇 제출 시각.
 * @deprecated buildBotScheduleFromHands에서 scheduleBotFireTimesFromFloors 사용 권장
 */
export function scheduleBotFireTimes(k, durationMs) {
  if (k <= 0) return []
  const f = Array.from({ length: k }, () => BOT_PLAY_START_DELAY_MS)
  return scheduleBotFireTimesFromFloors(f, durationMs)
}

/**
 * 눈치게임 2페이즈: 앞·뒤 각 2초를 제외한 가용 구간(span)을 족보 제출 횟수(n)로 **동일 폭**으로 나눕니다.
 * i번째 제출 시각은 span/n 간격으로 앞쪽부터 배치되어, 족보 앞쪽(ㄱ·ㄷ 등)이 초반에 바로 나갑니다.
 * (과거 (n-1)분모로 끝에 몰리던 문제·스케줄 카드와 globalMin 불일치 정체를 피하기 위해
 *  실제 제출은 Phase2Mind 에서 매 시각 globalMin 만 제출합니다.)
 * @param {number} cardCount 전체 손패 카드 수(플레이어+상대 전부)
 * @param {number} durationMs 라운드 길이(ms)
 * @returns {number[]} 각 제출 시각(ms, elapsed 기준)
 */
export function buildMechanicalJokboFireTimes(cardCount, durationMs) {
  const lead = MECHANICAL_LEAD_MS
  const tail = MECHANICAL_LEAD_MS
  const start = lead
  const end = Math.max(start, durationMs - tail)
  const span = Math.max(0, end - start)
  const n = Math.max(0, Math.floor(cardCount))
  if (n <= 0) return []
  if (n === 1) {
    const t = start + span / 2
    return [Math.round(Math.min(Math.max(t, start), end))]
  }
  const step = span / n
  return Array.from({ length: n }, (_, i) => {
    const t = start + i * step
    return Math.round(Math.min(Math.max(t, start), end))
  })
}

import { compareTopicOrder } from './koCompare'

export const USER_RESERVE_MS = 2000

/**
 * 봇 손패 전체를 국어 사전순으로 한 줄로 세운 족보(제출 순서)
 * @param {{ topic: string, id: string|number }[]} bot1Hand
 * @param {{ topic: string, id: string|number }[]} bot2Hand
 * @returns {Array<{ bot: 'bot1'|'bot2', card: object }>}
 */
export function mergeBotPlayOrder(bot1Hand, bot2Hand) {
  const items = []
  for (const c of bot1Hand) items.push({ bot: /** @type {'bot1'} */ ('bot1'), card: c })
  for (const c of bot2Hand) items.push({ bot: /** @type {'bot2'} */ ('bot2'), card: c })
  items.sort((a, b) => compareTopicOrder(a.card.topic, b.card.topic))
  return items
}

/**
 * 족보의 각 카드가 나올 시각(ms). 마지막 2초는 유저 반응용으로 비움.
 */
export function scheduleTimes(n, durationMs, reserveMs) {
  const windowMs = Math.max(0, durationMs - reserveMs)
  if (n === 0) return []
  return Array.from({ length: n }, (_, i) => ((i + 1) / (n + 1)) * windowMs)
}

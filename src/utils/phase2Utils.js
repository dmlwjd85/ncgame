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

/**
 * 잘못 낸 카드 직전에 끼어 있어야 했던 카드 수(생명력 감소)
 */
export function countSkippedBeforeWrong(playerHand, lastTopic, playedCard) {
  if (lastTopic == null) return 1
  const t = playedCard.topic
  if (compareTopicOrder(t, lastTopic) > 0) return 0
  const others = playerHand.filter((c) => c.id !== playedCard.id)
  const between = others.filter(
    (c) =>
      compareTopicOrder(c.topic, lastTopic) > 0 &&
      compareTopicOrder(c.topic, t) < 0,
  ).length
  if (between > 0) return between
  const stillValid = others.filter((c) => compareTopicOrder(c.topic, lastTopic) > 0)
  return Math.max(1, stillValid.length)
}

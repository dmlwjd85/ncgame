/**
 * @typedef {{ topic: string, id?: string|number }} CardLike
 */

/**
 * 2페이즈 족보 순서. 'topic': 국어→영어→숫자(가나다). 'sheet': 엑셀 행 순서(id 오름차순, 전근대사 등).
 * @param {CardLike} a
 * @param {CardLike} b
 * @param {'topic'|'sheet'} [mode]
 * @returns {number}
 */
export function comparePlayOrder(a, b, mode = 'topic') {
  if (mode === 'sheet') {
    const ia = Number(a?.id ?? 0)
    const ib = Number(b?.id ?? 0)
    if (ia !== ib) return ia - ib
  }
  return compareTopicOrder(String(a?.topic ?? ''), String(b?.topic ?? ''))
}

/**
 * 직전에 깐 카드보다 뒤 순서만 낼 수 있음
 * @param {CardLike} card
 * @param {{ id: string|number, topic: string } | null} lastPlayed
 * @param {'topic'|'sheet'} [mode]
 */
export function isPlayableAfter(card, lastPlayed, mode = 'topic') {
  if (lastPlayed == null) return true
  if (mode === 'sheet') {
    return Number(card.id) > Number(lastPlayed.id)
  }
  return compareTopicOrder(card.topic, lastPlayed.topic) > 0
}

/**
 * 주제어 순서: 한글(국어) → 영어(라틴) → 숫자
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function compareTopicOrder(a, b) {
  const sa = String(a).trim()
  const sb = String(b).trim()
  const ra = topicRank(sa)
  const rb = topicRank(sb)
  if (ra !== rb) return ra - rb
  if (ra === 0) return sa.localeCompare(sb, 'ko', { sensitivity: 'base' })
  if (ra === 1) return sa.localeCompare(sb, 'en', { sensitivity: 'base' })
  return sa.localeCompare(sb, 'en', { numeric: true, sensitivity: 'base' })
}

/** 0=한글 우선, 1=영어, 2=숫자(및 그 외) */
function topicRank(s) {
  if (!s) return 2
  const ch = s[0]
  if (/[\uAC00-\uD7A3\u3131-\u3163]/.test(ch)) return 0
  if (/[0-9]/.test(ch)) return 2
  if (/[a-zA-Z]/.test(ch)) return 1
  if (/[\u1100-\u11FF]/.test(ch)) return 0
  return 1
}

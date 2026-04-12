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

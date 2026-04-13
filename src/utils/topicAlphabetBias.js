/**
 * 주제어 첫 글자의 가나다·족보상 대략적 순위(0=앞, 1=뒤) — 2페이즈 봇 타이밍 보정용
 * @param {string} topic
 * @returns {number}
 */
export function topicAlphabetPosition01(topic) {
  const s = String(topic ?? '').trim()
  if (!s) return 0.45
  const c = s.codePointAt(0)
  if (c === undefined) return 0.45
  if (c >= 0xac00 && c <= 0xd7a3) {
    return (c - 0xac00) / (0xd7a3 - 0xac00 + 0.001)
  }
  if (/[\u3131-\u3163]/.test(s[0])) return 0.38
  if (/[a-zA-Z]/.test(s[0])) return 0.72
  if (/[0-9]/.test(s[0])) return 0.88
  return 0.52
}

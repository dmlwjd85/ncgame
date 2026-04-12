/**
 * 국어 사전식 문자열 순서 비교 (The Mind 2페이즈용)
 * @param {string} a
 * @param {string} b
 * @returns {number} 음수면 a가 앞, 양수면 b가 앞, 0이면 동일
 */
export function compareTopicOrder(a, b) {
  return String(a).localeCompare(String(b), 'ko', { sensitivity: 'base' })
}

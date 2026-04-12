/** 명예의 전당·표시용: 최대 7글자 */
export const DISPLAY_NAME_MAX_LEN = 7

/**
 * @param {string | null | undefined} name
 * @returns {string}
 */
export function formatHoFDisplayName(name) {
  const s = (name ?? '').trim()
  if (!s) return '플레이어'
  return [...s].slice(0, DISPLAY_NAME_MAX_LEN).join('')
}

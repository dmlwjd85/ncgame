/** 최대 레벨 */
export const MAX_LEVEL = 15

/** 레벨 L의 2페이즈 제한 시간(초) = 5 × L */
export function phase2SecondsForLevel(level) {
  return 5 * Math.max(1, level)
}

/**
 * 팩 행 개수로 도달 가능한 최대 레벨 (레벨마다 L장씩 1페이즈에서 소모)
 * @param {number} rowCount 유효 행 수
 */
export function maxLevelFromRowCount(rowCount) {
  if (rowCount < 1) return 0
  let used = 0
  for (let L = 1; L <= MAX_LEVEL; L++) {
    used += L
    if (used > rowCount) return L - 1
  }
  return MAX_LEVEL
}

/**
 * 1페이즈 콤보 n일 때 천리안·생명 보상 (연속 성공 시에만 n 증가)
 * @returns {{ cheonryan: number, lives: number }}
 */
export function phase1ComboRewards(comboAfterSuccess) {
  const n = comboAfterSuccess
  let cheonryan = 0
  let lives = 0
  if (n > 0 && n % 5 === 0) cheonryan += 1
  if (n === 7) lives += 1
  if (n === 10) {
    lives += 1
    cheonryan += 1
  }
  if (n === 15) {
    lives += 2
    cheonryan += 2
  }
  return { cheonryan, lives }
}

/** 생명 상한 */
export const MAX_LIVES = 3

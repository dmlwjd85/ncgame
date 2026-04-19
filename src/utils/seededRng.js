/**
 * 멀티플레이 2페이즈: 모든 클라이언트가 동일한 덱을 갖도록 시드 기반 난수
 * @param {number} seed
 * @returns {() => number} [0, 1) 균등에 가깝게
 */
export function createSeededRng(seed) {
  let s = (Math.floor(Number(seed)) >>> 0) || 0x9e3779b9
  return () => {
    s = (Math.imul(s ^ (s >>> 15), s | 1)) >>> 0
    s ^= s + Math.imul(s ^ (s >>> 7), s | 61)
    return ((s ^ (s >>> 14)) >>> 0) / 4294967296
  }
}

import { createSeededRng } from './seededRng'

/**
 * 1페이즈 덱 순서. 항상 무작위로 섞습니다(전근대사 100선도 앞쪽 행만 나오지 않게).
 * 멀티(syncSeed)일 때는 모든 기기에서 동일한 순서가 되도록 시드 기반으로 섞습니다.
 * 2페이즈 족보(시간 순 등)는 Game.jsx 의 phase2OrderMode 로 별도 처리됩니다.
 * @param {object[]} rows
 * @param {'topic'|'sheet'} _phase2OrderMode — 호환용(예전 API 유지)
 * @param {number | undefined} [syncSeed] — 멀티 방 세션 시드(있으면 결정적 셔플)
 * @returns {object[]}
 */
export function orderPhase1DeckRows(rows, _phase2OrderMode, syncSeed) {
  void _phase2OrderMode
  const a = [...rows]
  const useSeed =
    syncSeed != null &&
    syncSeed !== '' &&
    Number.isFinite(Number(syncSeed))
  const rng = useSeed
    ? createSeededRng((Number(syncSeed) ^ 0x31415927) >>> 0)
    : null
  const rnd = rng ?? Math.random
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

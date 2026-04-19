/** 마지막으로 성공한 게임 팩(새로고침 시 복구용, 유효하지 않으면 제거됨) */
export const NCGAME_LAST_PACK_KEY = 'ncgame-last-pack'

/** 홈 화면에서 고른 단어 팩(로컬에 유지) */
export const NCGAME_HOME_SELECTED_PACK_KEY = 'ncgame-home-selected-pack'

/**
 * 게임 라우트에서 packId 결정 — state(홈에서 넘긴 값) → URL 쿼리 → 세션에 남은 마지막 팩
 * @param {object | null | undefined} routeState — location.state
 * @param {URLSearchParams} searchParams
 */
export function resolveGamePackId(routeState, searchParams) {
  const fromState = routeState?.packId
  const fromQuery = searchParams.get('pack')
  if (typeof sessionStorage === 'undefined') {
    return fromState ?? fromQuery ?? null
  }
  const fromSession = sessionStorage.getItem(NCGAME_LAST_PACK_KEY)
  return fromState ?? fromQuery ?? fromSession ?? null
}

/**
 * 상대 수(1~3). 홈·방에서 넘긴 `botCount` 또는 URL bots= 를 사용합니다(최대 3).
 * @param {object | null | undefined} routeState — location.state
 * @param {URLSearchParams} searchParams
 */
export function resolveGameBotCount(routeState, searchParams) {
  const fromState = routeState?.botCount
  if (typeof fromState === 'number' && Number.isFinite(fromState)) {
    return Math.min(3, Math.max(1, Math.floor(fromState)))
  }
  const q = searchParams.get('bots')
  const n = q != null ? parseInt(q, 10) : NaN
  if (Number.isFinite(n)) return Math.min(3, Math.max(1, Math.floor(n)))
  return 1
}

/**
 * 홈에서 게임으로 이동할 때 state와 URL을 함께 넣어 새로고침해도 팩이 유지되게 함
 * @param {string} packId
 */
export function buildGameLocation(packId, botCount = 1) {
  const qs = new URLSearchParams()
  qs.set('pack', packId)
  qs.set('bots', String(Math.min(3, Math.max(1, Math.floor(botCount)))))
  return {
    pathname: '/game',
    search: `?${qs.toString()}`,
  }
}

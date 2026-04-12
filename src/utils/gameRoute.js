/** 마지막으로 성공한 게임 팩(새로고침 시 복구용, 유효하지 않으면 제거됨) */
export const NCGAME_LAST_PACK_KEY = 'ncgame-last-pack'

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
 * 가상 플레이어는 1명만 사용합니다(구 URL의 bots=2는 무시).
 */
export function resolveGameBotCount() {
  return 1
}

/**
 * 홈에서 게임으로 이동할 때 state와 URL을 함께 넣어 새로고침해도 팩이 유지되게 함
 * @param {string} packId
 */
export function buildGameLocation(packId) {
  const qs = new URLSearchParams()
  qs.set('pack', packId)
  qs.set('bots', '1')
  return {
    pathname: '/game',
    search: `?${qs.toString()}`,
  }
}

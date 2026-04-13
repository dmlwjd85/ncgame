import { SHOP } from '../utils/userProgressConstants'

/**
 * 상점 아이템 성격 — 1회성(다음 판 소모) vs 계정 영구 반영
 * TEMPORARY: disposable* 필드만 증가 (다음 `prepareGameBootstrap`에서 소모)
 * PERMANENT: perm* / nextStartLevel 등 즉시 Firebase에 반영되는 영구 스탯
 */
export const SHOP_ITEM_TYPE = {
  TEMPORARY: 'TEMPORARY',
  PERMANENT: 'PERMANENT',
}

/**
 * Firebase `purchaseShopItem` 두 번째 인자 kind와 동일한 식별자
 * @typedef {'disposableLife'|'disposableCheonryan'|'permanentLife'|'permanentCheonryan'|'skipToLevel2'|'skipToLevel3'} ShopItemKind
 */

/**
 * @typedef {{
 *   kind: ShopItemKind,
 *   type: typeof SHOP_ITEM_TYPE.TEMPORARY | typeof SHOP_ITEM_TYPE.PERMANENT,
 *   label: string,
 *   detail: string,
 *   price: number,
 * }} ShopItemDef
 */

/** @type {ShopItemDef[]} */
export const SHOP_ITEMS = [
  {
    kind: 'disposableLife',
    type: SHOP_ITEM_TYPE.TEMPORARY,
    label: '1회용 생명력',
    detail: '다음 게임 시작 시 생명 +1 (최대 5까지)',
    price: SHOP.disposableLife,
  },
  {
    kind: 'disposableCheonryan',
    type: SHOP_ITEM_TYPE.TEMPORARY,
    label: '1회용 천리안',
    detail: '다음 게임 시작 시 천리안 +1',
    price: SHOP.disposableCheonryan,
  },
  {
    kind: 'permanentLife',
    type: SHOP_ITEM_TYPE.PERMANENT,
    label: '영구 생명력',
    detail: '시작 생명 상한 +1 (최대 2회 구매, 5칸까지)',
    price: SHOP.permanentLife,
  },
  {
    kind: 'permanentCheonryan',
    type: SHOP_ITEM_TYPE.PERMANENT,
    label: '영구 천리안',
    detail: '매 판 시작 천리안 +1 (누적)',
    price: SHOP.permanentCheonryan,
  },
  {
    kind: 'skipToLevel2',
    type: SHOP_ITEM_TYPE.PERMANENT,
    label: '1레벨 건너뛰기',
    detail: '다음 판을 2레벨부터 시작',
    price: SHOP.skipToLevel2,
  },
  {
    kind: 'skipToLevel3',
    type: SHOP_ITEM_TYPE.PERMANENT,
    label: '2레벨 건너뛰기',
    detail: '다음 판을 3레벨부터 시작',
    price: SHOP.skipToLevel3,
  },
]

/** @type {Record<ShopItemKind, ShopItemDef>} */
const BY_KIND = /* @__PURE__ */ (() => {
  /** @type {Record<string, ShopItemDef>} */
  const o = {}
  for (const it of SHOP_ITEMS) o[it.kind] = it
  return /** @type {Record<ShopItemKind, ShopItemDef>} */ (o)
})()

/**
 * @param {ShopItemKind} kind
 * @returns {ShopItemDef | undefined}
 */
export function getShopItem(kind) {
  return BY_KIND[kind]
}

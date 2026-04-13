import { create } from 'zustand'
import { loadUserProgress, purchaseShopItem } from '../services/userShopService'
import { getShopItem } from '../config/shopConfig'

/**
 * Firebase와 동기화되는 영구 스탯 (누적 포인트·영구 보너스·시작 스킵 등)
 * @typedef {{
 *   points: number,
 *   permLifeBonus: number,
 *   permCheonryanBonus: number,
 *   nextStartLevel: number | null,
 * }} PermanentSlice
 */

/**
 * 다음 판에 소모되는 1회성 재고 (Firebase disposable*)
 * @typedef {{
 *   disposableLives: number,
 *   disposableCheonryan: number,
 * }} TemporaryStockSlice
 */

/**
 * 이번 판(게임 화면)에서만 의미 있는 임시 스탯 — 홈/상점과 분리
 * @typedef {{
 *   currentLives: number | null,
 * }} SessionSlice
 */

function defaultPermanent() {
  return {
    points: 0,
    permLifeBonus: 0,
    permCheonryanBonus: 0,
    nextStartLevel: null,
  }
}

function defaultTemporaryStock() {
  return {
    disposableLives: 0,
    disposableCheonryan: 0,
  }
}

function defaultSession() {
  return {
    currentLives: null,
  }
}

/**
 * @param {import('../services/userShopService').UserProgress & { uid?: string }} p
 */
function mapServerToSlices(p) {
  return {
    permanent: {
      points: Number(p.points) || 0,
      permLifeBonus: Math.min(2, Math.max(0, Number(p.permLifeBonus) || 0)),
      permCheonryanBonus: Math.max(0, Number(p.permCheonryanBonus) || 0),
      nextStartLevel:
        p.nextStartLevel == null || p.nextStartLevel === ''
          ? null
          : Number(p.nextStartLevel),
    },
    temporaryStock: {
      disposableLives: Math.max(0, Number(p.disposableLives) || 0),
      disposableCheonryan: Math.max(0, Number(p.disposableCheonryan) || 0),
    },
  }
}

export const usePlayerProgressStore = create((set, get) => ({
  loading: false,
  permanent: defaultPermanent(),
  temporaryStock: defaultTemporaryStock(),
  session: defaultSession(),

  /** 로그아웃 시 클라이언트 상태 초기화 */
  resetForLogout: () =>
    set({
      loading: false,
      permanent: defaultPermanent(),
      temporaryStock: defaultTemporaryStock(),
      session: defaultSession(),
    }),

  /**
   * Firebase에서 최신 진행도 로드 — 구매 후 PERMANENT 반영 확인에 사용
   * @param {string | undefined} uid
   */
  refreshFromServer: async (uid) => {
    if (!uid) {
      get().resetForLogout()
      return
    }
    set({ loading: true })
    try {
      const p = await loadUserProgress(uid)
      const { permanent, temporaryStock } = mapServerToSlices(p)
      set({ permanent, temporaryStock, loading: false })
    } catch {
      // 기존 동작과 같이 로드 실패 시 포인트만 0으로 (다른 필드는 유지)
      set((s) => ({
        loading: false,
        permanent: { ...s.permanent, points: 0 },
      }))
    }
  },

  /**
   * 이번 판 현재 생명력만 갱신 (게임 화면에서 호출)
   * @param {number | null} currentLives
   */
  setSessionCurrentLives: (currentLives) =>
    set((s) => ({
      session: { ...s.session, currentLives },
    })),

  /**
   * 상점 구매 — `shopConfig`의 타입에 맞춰 트랜잭션 후 서버에서 재동기화
   * PERMANENT는 Firebase `purchaseShopItem` 안에서 이미 즉시 저장됨
   * @param {string | undefined} uid
   * @param {import('../config/shopConfig').ShopItemKind} kind
   * @returns {Promise<{ ok: boolean, message?: string }>}
   */
  buyItem: async (uid, kind) => {
    if (!uid) return { ok: false, message: '로그인이 필요합니다.' }
    const item = getShopItem(kind)
    if (!item) return { ok: false, message: '알 수 없는 상품입니다.' }

    const r = await purchaseShopItem(uid, kind, item.price)
    if (!r.ok) return r

    // 트랜잭션 커밋 후 클라이언트 스토어를 서버와 일치 — TEMPORARY(disposable*)·PERMANENT(perm* 등) 모두 반영
    await get().refreshFromServer(uid)

    return { ok: true }
  },
}))

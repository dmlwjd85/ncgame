import {
  loadUserBestFromCloud,
  loadUserComboBestFromCloud,
  syncUserBestToCloud,
  syncUserComboBestToCloud,
} from '../services/hallOfFameService'
import { formatHoFDisplayName } from './displayName'

const STORAGE_KEY = 'ncgame-hall-of-fame-v1'
const STORAGE_KEY_COMBO = 'ncgame-hall-combo-v1'
/** 무한도전 연습모드 — 로컬 전용, 클라우드·명예의 전당 없음 */
const STORAGE_KEY_COMBO_PRACTICE = 'ncgame-combo-practice-v1'

/** 비로그인 플레이 기록(로컬) 전체 삭제 */
export function clearLocalGuestRecords() {
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(STORAGE_KEY_COMBO)
    localStorage.removeItem(STORAGE_KEY_COMBO_PRACTICE)
  } catch {
    /* noop */
  }
}

/**
 * @returns {Record<string, { maxLevel: number, at: string, displayName: string }>}
 */
export function loadHallOfFame() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

/**
 * @param {string} packId
 * @param {number} maxLevel
 * @param {string} displayName
 * @param {{ uid?: string | null }} auth — Firebase uid 있으면 Firestore 동기화
 */
export async function saveHallOfFameIfBetter(packId, maxLevel, displayName, auth = {}) {
  const name = formatHoFDisplayName(displayName)
  let cloudMax = 0
  if (auth?.uid) {
    try {
      const cloud = await loadUserBestFromCloud(packId, auth.uid)
      cloudMax = Number(cloud?.maxLevel) || 0
    } catch {
      /* noop */
    }
  }
  const all = loadHallOfFame()
  const prev = all[packId]
  const localMax = prev?.maxLevel ?? 0
  const best = Math.max(localMax, maxLevel, cloudMax)
  if (best < 1) return false

  const improved = !prev || best > localMax
  if (improved) {
    all[packId] = {
      maxLevel: best,
      at: new Date().toISOString(),
      displayName: name,
      /** 로그인 중 달성한 기록만 uid를 붙여 둠(게스트 기록이 로그인 후 클라우드로 섞이지 않게) */
      ...(auth?.uid ? { uid: auth.uid } : {}),
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
    } catch {
      return false
    }
  }
  if (auth?.uid) {
    await syncUserBestToCloud(packId, auth.uid, name, best)
  }
  return improved
}

/**
 * 로그인 후 클라우드 최고 기록을 로컬 명예의 전당에 합침
 * @param {string} uid
 * @param {Array<{ id: string }>} packs
 */
export async function mergeHallOfFameFromCloud(uid, packs) {
  if (!uid || !packs?.length) return
  const all = { ...loadHallOfFame() }
  let changed = false
  for (const p of packs) {
    if (!p?.id) continue
    try {
      const cloud = await loadUserBestFromCloud(p.id, uid)
      const cmax = Number(cloud?.maxLevel) || 0
      const prev = all[p.id]
      const lmax = prev?.maxLevel ?? 0

      if (cmax > lmax) {
        const u = cloud?.updatedAt
        const atStr =
          u && typeof u.toDate === 'function'
            ? u.toDate().toISOString()
            : typeof u === 'string'
              ? u
              : new Date().toISOString()
        all[p.id] = {
          maxLevel: cmax,
          at: atStr,
          displayName: formatHoFDisplayName(cloud?.displayName),
        }
        changed = true
      } else if (lmax > cmax && lmax >= 1) {
        /**
         * 로컬만 더 높을 때 클라우드로 동기화.
         * 단, "게스트(비로그인) 플레이 기록"은 로그인 계정에 섞이지 않도록 uid 태그가 있는 기록만 업로드합니다.
         */
        if (prev?.uid && String(prev.uid) === String(uid)) {
          const name = formatHoFDisplayName(prev?.displayName ?? '')
          await syncUserBestToCloud(p.id, uid, name, lmax)
        }
      }
    } catch {
      /* noop */
    }
  }
  if (!changed) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    /* noop */
  }
}

export function getPackRecord(packId) {
  return loadHallOfFame()[packId] ?? null
}

/**
 * @returns {Record<string, { maxCombo: number, at: string, displayName: string }>}
 */
export function loadHallOfFameCombo() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_COMBO)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

/**
 * @param {string} packId
 * @param {number} maxCombo
 * @param {string} displayName
 * @param {{ uid?: string | null }} auth
 */
export async function saveHallOfFameComboIfBetter(
  packId,
  maxCombo,
  displayName,
  auth = {},
) {
  const name = formatHoFDisplayName(displayName)
  const n = Math.max(0, Math.floor(Number(maxCombo)) || 0)
  if (n < 1) return false

  let cloudMax = 0
  if (auth?.uid) {
    try {
      const cloud = await loadUserComboBestFromCloud(packId, auth.uid)
      cloudMax = Number(cloud?.maxCombo) || 0
    } catch {
      /* noop */
    }
  }

  const all = loadHallOfFameCombo()
  const prev = all[packId]
  const localMax = prev?.maxCombo ?? 0
  const best = Math.max(localMax, n, cloudMax)
  const improved = !prev || best > localMax
  if (improved) {
    all[packId] = {
      maxCombo: best,
      at: new Date().toISOString(),
      displayName: name,
      ...(auth?.uid ? { uid: auth.uid } : {}),
    }
    try {
      localStorage.setItem(STORAGE_KEY_COMBO, JSON.stringify(all))
    } catch {
      return false
    }
  }
  if (auth?.uid) {
    await syncUserComboBestToCloud(packId, auth.uid, name, best)
  }
  return improved
}

/**
 * 로그인 후 클라우드 최고 기록을 로컬 명예의 전당(무한도전)과 합침
 * - 클라우드 > 로컬: 로컬 갱신
 * - 로컬 > 클라우드: 로컬 기록이 "로그인 중 달성(uid 태그)"인 경우에만 업로드
 * @param {string} uid
 * @param {Array<{ id: string }>} packs
 */
export async function mergeHallOfFameComboFromCloud(uid, packs) {
  if (!uid || !packs?.length) return
  const all = { ...loadHallOfFameCombo() }
  let changed = false
  for (const p of packs) {
    if (!p?.id) continue
    try {
      const cloud = await loadUserComboBestFromCloud(p.id, uid)
      const cmax = Number(cloud?.maxCombo) || 0
      const prev = all[p.id]
      const lmax = prev?.maxCombo ?? 0

      if (cmax > lmax) {
        const u = cloud?.updatedAt
        const atStr =
          u && typeof u.toDate === 'function'
            ? u.toDate().toISOString()
            : typeof u === 'string'
              ? u
              : new Date().toISOString()
        all[p.id] = {
          maxCombo: cmax,
          at: atStr,
          displayName: formatHoFDisplayName(cloud?.displayName),
        }
        changed = true
      } else if (lmax > cmax && lmax >= 1) {
        if (prev?.uid && String(prev.uid) === String(uid)) {
          const name = formatHoFDisplayName(prev?.displayName ?? '')
          await syncUserComboBestToCloud(p.id, uid, name, lmax)
        }
      }
    } catch {
      /* noop */
    }
  }
  if (!changed) return
  try {
    localStorage.setItem(STORAGE_KEY_COMBO, JSON.stringify(all))
  } catch {
    /* noop */
  }
}

/**
 * @returns {Record<string, { maxCombo: number, at: string }>}
 */
export function loadHallOfFameComboPractice() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_COMBO_PRACTICE)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

/**
 * 연습모드 무한도전 최고 연속 — 본인 기기 로컬만 (동기화 없음)
 * @param {string} packId
 * @param {number} maxCombo
 * @returns {boolean} 기록 갱신 여부
 */
export function savePracticeComboIfBetter(packId, maxCombo) {
  const n = Math.max(0, Math.floor(Number(maxCombo)) || 0)
  if (n < 1) return false
  const all = loadHallOfFameComboPractice()
  const prev = all[packId]
  const localMax = prev?.maxCombo ?? 0
  if (n <= localMax) return false
  all[packId] = {
    maxCombo: n,
    at: new Date().toISOString(),
  }
  try {
    localStorage.setItem(STORAGE_KEY_COMBO_PRACTICE, JSON.stringify(all))
  } catch {
    return false
  }
  return true
}

/** @param {string} packId */
export function getPracticeComboRecord(packId) {
  return loadHallOfFameComboPractice()[packId] ?? null
}

import {
  loadUserBestFromCloud,
  syncUserBestToCloud,
} from '../services/hallOfFameService'
import { formatHoFDisplayName } from './displayName'

const STORAGE_KEY = 'ncgame-hall-of-fame-v1'

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
        /** 로컬만 더 높을 때(예: 오프라인 플레이 후 로그인) 클라우드로 동기화 */
        const name = formatHoFDisplayName(prev?.displayName ?? '')
        await syncUserBestToCloud(p.id, uid, name, lmax)
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

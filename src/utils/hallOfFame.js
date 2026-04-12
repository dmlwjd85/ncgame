import { syncUserBestToCloud } from '../services/hallOfFameService'

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
  const all = loadHallOfFame()
  const prev = all[packId]
  if (prev && prev.maxLevel >= maxLevel) {
    if (auth?.uid) {
      await syncUserBestToCloud(packId, auth.uid, displayName, maxLevel)
    }
    return false
  }
  all[packId] = {
    maxLevel,
    at: new Date().toISOString(),
    displayName: displayName || '플레이어',
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    return false
  }
  if (auth?.uid) {
    await syncUserBestToCloud(packId, auth.uid, displayName, maxLevel)
  }
  return true
}

export function getPackRecord(packId) {
  return loadHallOfFame()[packId] ?? null
}

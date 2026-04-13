import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore'
import { firestoreDb } from '../config/firebase'

/**
 * ncgameHofByPack/{packId}/entries/{uid}
 */
export async function syncUserBestToCloud(packId, uid, displayName, maxLevel) {
  if (!packId || !uid) return false
  const ref = doc(firestoreDb, 'ncgameHofByPack', packId, 'entries', uid)
  try {
    const snap = await getDoc(ref)
    const prevData = snap.exists() ? snap.data() : {}
    const prevLevel = Number(prevData.maxLevel) || 0
    const best = Math.max(prevLevel, maxLevel)
    if (best <= prevLevel) return false

    const nowIso = new Date().toISOString()
    /** 동률 시 먼저 달성한 순 — 레벨이 올랐을 때만 갱신 */
    const payload = {
      packId,
      uid,
      displayName: displayName || '플레이어',
      maxLevel: best,
      updatedAt: nowIso,
    }
    if (best > prevLevel) {
      payload.achievedAt = nowIso
    }

    await setDoc(ref, payload, { merge: true })
    return true
  } catch (e) {
    console.warn('[hallOfFameService] sync 실패', e)
    return false
  }
}

export async function loadUserBestFromCloud(packId, uid) {
  if (!packId || !uid) return null
  const ref = doc(firestoreDb, 'ncgameHofByPack', packId, 'entries', uid)
  try {
    const snap = await getDoc(ref)
    if (!snap.exists()) return null
    return snap.data()
  } catch {
    return null
  }
}

/** 무한도전 개인 최고 기록 */
export async function loadUserComboBestFromCloud(packId, uid) {
  if (!packId || !uid) return null
  const ref = doc(firestoreDb, 'ncgameHofComboByPack', packId, 'entries', uid)
  try {
    const snap = await getDoc(ref)
    if (!snap.exists()) return null
    return snap.data()
  } catch {
    return null
  }
}

export async function loadPackLeaderboard(packId, maxEntries = 40) {
  if (!packId) return []
  try {
    const ref = collection(firestoreDb, 'ncgameHofByPack', packId, 'entries')
    const q = query(ref, orderBy('maxLevel', 'desc'), limit(maxEntries))
    const snap = await getDocs(q)
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  } catch (e) {
    console.warn('[hallOfFameService] 리더보드 로드 실패', e)
    return []
  }
}

/**
 * 팩별 명예의 전당 실시간 구독 (다른 플레이어 기록 반영)
 * @param {(rows: object[]) => void} onData
 * @returns {() => void} 구독 해제
 */
export function subscribePackLeaderboard(packId, maxEntries, onData, onError) {
  if (!packId) return () => {}
  const ref = collection(firestoreDb, 'ncgameHofByPack', packId, 'entries')
  const q = query(ref, orderBy('maxLevel', 'desc'), limit(maxEntries))
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    },
    onError ??
      ((e) => {
        console.warn('[hallOfFameService] 리더보드 구독 오류', e)
      }),
  )
}

/**
 * 무한도전 — ncgameHofComboByPack/{packId}/entries/{uid}
 */
export async function syncUserComboBestToCloud(packId, uid, displayName, maxCombo) {
  if (!packId || !uid) return false
  const n = Math.max(0, Math.floor(Number(maxCombo)) || 0)
  if (n < 1) return false
  const ref = doc(firestoreDb, 'ncgameHofComboByPack', packId, 'entries', uid)
  try {
    const snap = await getDoc(ref)
    const prevData = snap.exists() ? snap.data() : {}
    const prevCombo = Number(prevData.maxCombo) || 0
    const best = Math.max(prevCombo, n)
    if (best <= prevCombo) return false

    const nowIso = new Date().toISOString()
    const payload = {
      packId,
      uid,
      displayName: displayName || '플레이어',
      maxCombo: best,
      updatedAt: nowIso,
    }
    if (best > prevCombo) {
      payload.achievedAt = nowIso
    }

    await setDoc(ref, payload, { merge: true })
    return true
  } catch (e) {
    console.warn('[hallOfFameService] 무한도전 sync 실패', e)
    return false
  }
}

/**
 * 팩별 무한도전 리더보드 구독
 */
export function subscribePackComboLeaderboard(packId, maxEntries, onData, onError) {
  if (!packId) return () => {}
  const ref = collection(firestoreDb, 'ncgameHofComboByPack', packId, 'entries')
  const q = query(ref, orderBy('maxCombo', 'desc'), limit(maxEntries))
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    },
    onError ??
      ((e) => {
        console.warn('[hallOfFameService] 무한도전 리더보드 구독 오류', e)
      }),
  )
}

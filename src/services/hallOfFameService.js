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
    const prev = snap.exists() ? snap.data().maxLevel ?? 0 : 0
    if (maxLevel <= prev) return false
    await setDoc(
      ref,
      {
        packId,
        uid,
        displayName: displayName || '플레이어',
        maxLevel,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    )
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

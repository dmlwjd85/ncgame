import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore'
import { firestoreDb } from '../config/firebase'

/**
 * 로그인·가입 등 사용자 활동 기록 (마스터만 조회)
 * @param {string} uid
 * @param {string} displayName
 * @param {string} type — 'login' | 'register' | 'master_login' | 'master_setup' 등
 * @param {string} [detail]
 */
export async function logUserActivity(uid, displayName, type, detail) {
  if (!uid) return
  try {
    await addDoc(collection(firestoreDb, 'ncgameActivityLog'), {
      uid,
      displayName: displayName ?? '',
      type: String(type ?? 'event'),
      detail: String(detail ?? ''),
      createdAt: serverTimestamp(),
    })
  } catch (e) {
    console.warn('[activityService] 활동 기록 실패', e)
  }
}

/**
 * 마스터 전용: 최근 활동 목록 (시간 역순)
 * @param {number} [maxRows]
 * @returns {Promise<Array<{ id: string } & Record<string, unknown>>>}
 */
export async function listActivityForMaster(maxRows = 200) {
  const q = query(
    collection(firestoreDb, 'ncgameActivityLog'),
    orderBy('createdAt', 'desc'),
    limit(maxRows),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

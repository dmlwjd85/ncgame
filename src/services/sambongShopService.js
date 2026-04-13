import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { firestoreDb } from '../config/firebase'

const REF = doc(firestoreDb, 'system', 'sambongShop')

/** @param {(msg: string) => void} onData */
export function subscribeSambongShopMent(onData, onError) {
  return onSnapshot(
    REF,
    (snap) => {
      onData(snap.exists() ? String(snap.data()?.message ?? '') : '')
    },
    onError ??
      ((e) => {
        console.warn('[sambongShop] 구독 오류', e)
      }),
  )
}

export async function getSambongShopMent() {
  const snap = await getDoc(REF)
  return snap.exists() ? String(snap.data()?.message ?? '') : ''
}

/** @param {string} message */
export async function setSambongShopMent(message) {
  await setDoc(
    REF,
    { message: String(message ?? ''), updatedAt: serverTimestamp() },
    { merge: true },
  )
}

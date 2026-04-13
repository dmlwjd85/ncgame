import {
  doc,
  getDoc,
  increment,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { firestoreDb } from '../config/firebase'
import { INITIAL_LIVES } from '../utils/userProgressConstants'
import { MAX_LIVES } from '../utils/gameRules'

/**
 * users/{uid} 진행도 — 포인트·상점·시작 레벨
 * @typedef {{
 *   points?: number,
 *   nextStartLevel?: number | null,
 *   permLifeBonus?: number,
 *   permCheonryanBonus?: number,
 *   disposableLives?: number,
 *   disposableCheonryan?: number,
 * }} UserProgress
 */

/** @returns {UserProgress} */
export function defaultUserProgress() {
  return {
    points: 0,
    nextStartLevel: null,
    permLifeBonus: 0,
    permCheonryanBonus: 0,
    disposableLives: 0,
    disposableCheonryan: 0,
  }
}

/**
 * @param {string} uid
 * @returns {Promise<UserProgress & { uid: string }>}
 */
export async function loadUserProgress(uid) {
  if (!uid) return { uid: '', ...defaultUserProgress() }
  const ref = doc(firestoreDb, 'users', uid)
  const snap = await getDoc(ref)
  const d = snap.exists() ? snap.data() : {}
  return {
    uid,
    points: Number(d.points) || 0,
    nextStartLevel:
      d.nextStartLevel == null || d.nextStartLevel === ''
        ? null
        : Number(d.nextStartLevel),
    permLifeBonus: Math.min(2, Math.max(0, Number(d.permLifeBonus) || 0)),
    permCheonryanBonus: Math.max(0, Number(d.permCheonryanBonus) || 0),
    disposableLives: Math.max(0, Number(d.disposableLives) || 0),
    disposableCheonryan: Math.max(0, Number(d.disposableCheonryan) || 0),
  }
}

/**
 * 새 게임 진입 시 소모 반영 + 시작 레벨·라이프·천리안 계산 (트랜잭션)
 * @param {string} uid
 * @param {number} maxPackLevel 팩 최대 레벨
 * @returns {Promise<{ startLevel: number, lives: number, cheonryan: number }>}
 */
export async function prepareGameBootstrap(uid, maxPackLevel) {
  if (!uid) {
    return {
      startLevel: 1,
      lives: INITIAL_LIVES,
      cheonryan: 1,
    }
  }
  const ref = doc(firestoreDb, 'users', uid)
  const out = await runTransaction(firestoreDb, async (transaction) => {
    const snap = await transaction.get(ref)
    const raw = snap.exists() ? snap.data() : {}
    let nextStart = raw.nextStartLevel
    if (nextStart != null && nextStart !== '') {
      nextStart = Math.floor(Number(nextStart))
    } else {
      nextStart = null
    }
    let startLevel = nextStart == null || nextStart < 1 ? 1 : nextStart
    startLevel = Math.min(Math.max(1, startLevel), Math.max(1, maxPackLevel))

    const permLife = Math.min(2, Math.max(0, Number(raw.permLifeBonus) || 0))
    let dispL = Math.max(0, Number(raw.disposableLives) || 0)
    const base = Math.min(INITIAL_LIVES + permLife, MAX_LIVES)
    const room = Math.max(0, MAX_LIVES - base)
    const addL = Math.min(dispL, room)
    const lives = Math.min(MAX_LIVES, base + addL)
    dispL -= addL

    const permCh = Math.max(0, Number(raw.permCheonryanBonus) || 0)
    let dispCh = Math.max(0, Number(raw.disposableCheonryan) || 0)
    const useCh = Math.min(1, dispCh)
    dispCh -= useCh
    const cheonryan = 1 + permCh + useCh

    transaction.set(
      ref,
      {
        nextStartLevel: null,
        disposableLives: dispL,
        disposableCheonryan: dispCh,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )

    return { startLevel, lives, cheonryan }
  })
  return out
}

/**
 * 레벨 클리어 포인트 — 매 클리어 시 해당 레벨 번호만큼 가산(누적 합은 1+2+3+… 형태, 예: 3레벨까지면 6P)
 * @param {string} uid
 * @param {number} clearedLevel 방금 클리어한 레벨
 */
export async function addPointsForLevelClear(uid, clearedLevel) {
  if (!uid || clearedLevel < 1) return
  const ref = doc(firestoreDb, 'users', uid)
  try {
    await updateDoc(ref, {
      points: increment(clearedLevel),
      updatedAt: serverTimestamp(),
    })
  } catch {
    await setDoc(
      ref,
      {
        points: clearedLevel,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
  }
}

/**
 * 무한 콤보 등 보너스 포인트
 * @param {string} uid
 * @param {number} delta
 */
export async function addPointsBonus(uid, delta) {
  if (!uid || delta <= 0) return
  const ref = doc(firestoreDb, 'users', uid)
  try {
    await updateDoc(ref, {
      points: increment(delta),
      updatedAt: serverTimestamp(),
    })
  } catch {
    await setDoc(
      ref,
      {
        points: delta,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
  }
}

/**
 * @param {string} uid
 * @param {'disposableLife'|'disposableCheonryan'|'permanentLife'|'permanentCheonryan'|'skipToLevel2'|'skipToLevel3'} kind
 * @param {number} cost
 * @returns {Promise<{ ok: boolean, message?: string }>}
 */
export async function purchaseShopItem(uid, kind, cost) {
  if (!uid) return { ok: false, message: '로그인이 필요합니다.' }
  const ref = doc(firestoreDb, 'users', uid)
  try {
    await runTransaction(firestoreDb, async (transaction) => {
      const snap = await transaction.get(ref)
      const raw = snap.exists() ? snap.data() : {}
      let points = Number(raw.points) || 0
      if (points < cost) {
        throw new Error('POINTS')
      }
      points -= cost

      const permLife = Math.min(2, Math.max(0, Number(raw.permLifeBonus) || 0))
      const dispL = Math.max(0, Number(raw.disposableLives) || 0)
      const dispCh = Math.max(0, Number(raw.disposableCheonryan) || 0)
      const permCh = Math.max(0, Number(raw.permCheonryanBonus) || 0)
      let nextStart = raw.nextStartLevel
      if (nextStart != null && nextStart !== '') {
        nextStart = Math.floor(Number(nextStart))
      } else {
        nextStart = null
      }

      /** @type {Record<string, unknown>} */
      const patch = { points, updatedAt: serverTimestamp() }

      if (kind === 'disposableLife') {
        patch.disposableLives = dispL + 1
      } else if (kind === 'disposableCheonryan') {
        patch.disposableCheonryan = dispCh + 1
      } else if (kind === 'permanentLife') {
        if (permLife >= 2) throw new Error('MAX_PERM_LIFE')
        patch.permLifeBonus = permLife + 1
      } else if (kind === 'permanentCheonryan') {
        patch.permCheonryanBonus = permCh + 1
      } else if (kind === 'skipToLevel2') {
        patch.nextStartLevel = Math.max(nextStart ?? 1, 2)
      } else if (kind === 'skipToLevel3') {
        patch.nextStartLevel = 3
      }

      transaction.set(ref, patch, { merge: true })
    })
    return { ok: true }
  } catch (e) {
    if (e?.message === 'POINTS') {
      return { ok: false, message: '포인트가 부족합니다.' }
    }
    if (e?.message === 'MAX_PERM_LIFE') {
      return { ok: false, message: '영구 생명력은 이미 최대입니다.' }
    }
    return { ok: false, message: e?.message ?? '구매에 실패했습니다.' }
  }
}

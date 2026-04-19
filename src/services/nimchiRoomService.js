import {
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { firestoreDb } from '../config/firebase'
import { formatHoFDisplayName } from '../utils/displayName'

const COL = 'nimchiRooms'

/**
 * 방 이름 정규화(공백 제거, 빈 문자열 불가)
 * @param {string} raw
 */
export function normalizeRoomName(raw) {
  return String(raw ?? '')
    .trim()
    .slice(0, 24)
}

/**
 * 방 만들기 — 호스트가 문서 id를 방 이름으로 사용(같은 이름 재생성은 빈 방일 때만)
 * @param {{ name: string, packId: string, hostUid: string, hostDisplayName: string }} p
 */
export async function createNimchiRoom({ name, packId, hostUid, hostDisplayName }) {
  const n = normalizeRoomName(name)
  if (!n) throw new Error('방 이름을 입력해 주세요.')
  if (!packId) throw new Error('단어 팩이 필요합니다.')
  if (!hostUid) throw new Error('로그인 후 방을 만들 수 있어요.')

  const ref = doc(firestoreDb, COL, n)
  const snap = await getDoc(ref)
  if (snap.exists()) {
    const d = snap.data()
    const members = d?.memberUids ?? []
    if (Array.isArray(members) && members.length > 0) {
      throw new Error('이미 사용 중인 방 이름이에요. 비어 있을 때까지 기다리거나 다른 이름을 쓰세요.')
    }
    await deleteDoc(ref).catch(() => {})
  }

  await setDoc(ref, {
    name: n,
    packId: String(packId),
    hostUid,
    memberUids: [hostUid],
    members: {
      [hostUid]: {
        displayName: formatHoFDisplayName(hostDisplayName || '플레이어'),
        joinedAt: serverTimestamp(),
      },
    },
    updatedAt: serverTimestamp(),
  })
  return { roomId: n }
}

/**
 * 방 참가(최대 4인)
 * @param {string} roomId
 * @param {string} uid
 * @param {string} displayName
 */
export async function joinNimchiRoom(roomId, uid, displayName) {
  const r = normalizeRoomName(roomId)
  if (!r || !uid) throw new Error('방 정보가 올바르지 않아요.')

  const ref = doc(firestoreDb, COL, r)
  await runTransaction(firestoreDb, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new Error('방을 찾을 수 없어요.')
    const d = snap.data()
    const packId = d?.packId
    if (!packId) throw new Error('방이 올바르지 않아요.')

    let memberUids = Array.isArray(d.memberUids) ? [...d.memberUids] : []
    const members = { ...(d.members ?? {}) }

    if (memberUids.includes(uid)) {
      members[uid] = {
        displayName: formatHoFDisplayName(displayName || '플레이어'),
        joinedAt: members[uid]?.joinedAt ?? serverTimestamp(),
      }
      tx.update(ref, {
        members,
        updatedAt: serverTimestamp(),
      })
      return
    }

    if (memberUids.length >= 4) throw new Error('방이 가득 찼어요(최대 4인).')

    memberUids.push(uid)
    members[uid] = {
      displayName: formatHoFDisplayName(displayName || '플레이어'),
      joinedAt: serverTimestamp(),
    }

    tx.update(ref, {
      memberUids,
      members,
      updatedAt: serverTimestamp(),
    })
  })
}

/**
 * 방 나가기 — 인원이 0이면 문서 삭제
 * @param {string} roomId
 * @param {string} uid
 */
export async function leaveNimchiRoom(roomId, uid) {
  const r = normalizeRoomName(roomId)
  if (!r || !uid) return

  const ref = doc(firestoreDb, COL, r)
  await runTransaction(firestoreDb, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) return
    const d = snap.data()
    let memberUids = Array.isArray(d.memberUids) ? d.memberUids.filter((x) => x !== uid) : []
    const members = { ...(d.members ?? {}) }
    delete members[uid]

    if (memberUids.length === 0) {
      tx.delete(ref)
      return
    }

    tx.update(ref, {
      memberUids,
      members,
      gameSession: deleteField(),
      updatedAt: serverTimestamp(),
    })
  })
}

/**
 * 멀티 시작: 모든 클라이언트가 동일 시드로 2페이즈 덱을 맞추기 위해 방에 기록합니다.
 * @param {string} roomId
 * @param {{ packId: string, botCount: number, seed: number }} p
 */
export async function startNimchiGameSession(roomId, { packId, botCount, seed }) {
  const r = normalizeRoomName(roomId)
  if (!r) throw new Error('방 이름이 필요합니다.')
  if (!packId) throw new Error('단어 팩이 필요합니다.')
  const ref = doc(firestoreDb, COL, r)
  const bc = Math.min(3, Math.max(1, Math.floor(Number(botCount)) || 1))
  const sd = Math.floor(Number(seed)) >>> 0
  await updateDoc(ref, {
    gameSession: {
      seed: sd,
      packId: String(packId),
      botCount: bc,
      startedAt: serverTimestamp(),
    },
    updatedAt: serverTimestamp(),
  })
}

/**
 * @param {string} roomId
 * @param {(data: object | null) => void} onData
 * @param {(e: Error) => void} onError
 */
export function subscribeNimchiRoom(roomId, onData, onError) {
  const r = normalizeRoomName(roomId)
  if (!r) {
    onData(null)
    return () => {}
  }
  const ref = doc(firestoreDb, COL, r)
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData(null)
        return
      }
      onData({ id: snap.id, ...snap.data() })
    },
    (e) => onError?.(e),
  )
}

/**
 * 현재 유저 기준 상대 자리 이름(맞은편·왼쪽·오른쪽) — 최대 3
 * @param {object} room — subscribe 데이터
 * @param {string} myUid
 */
export function opponentSeatLabelsFromRoom(room, myUid) {
  if (!room?.members || !myUid) return []
  const order = Array.isArray(room.memberUids) ? [...room.memberUids] : Object.keys(room.members)
  const idx = order.indexOf(myUid)
  if (idx < 0) return []
  const others = order.filter((id) => id !== myUid).slice(0, 3)
  return others.map((id) => formatHoFDisplayName(room.members[id]?.displayName ?? '플레이어'))
}

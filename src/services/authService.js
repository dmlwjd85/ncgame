import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { firebaseAuth, firestoreDb } from '../config/firebase'

/** @param {string} name */
function reservedName(name) {
  const n = name.trim()
  const masterName = import.meta.env.VITE_MASTER_DISPLAY_NAME?.trim()
  if (masterName && n === masterName) return true
  return false
}

/**
 * Firebase Auth는 이메일 형식이 필요해, 프로젝트 도메인 하위 가상 주소를 사용합니다.
 * @param {string} displayName — 로그인에 쓰는 이름(중복 불가)
 * @param {string} password
 */
export async function signUpWithName(displayName, password) {
  const name = displayName.trim()
  if (!name) throw new Error('이름을 입력해 주세요.')
  if (reservedName(name)) throw new Error('사용할 수 없는 이름입니다.')
  if (password.length < 6) throw new Error('비밀번호는 6자 이상이어야 합니다.')

  const loginRef = doc(firestoreDb, 'loginByName', name)
  const existing = await getDoc(loginRef)
  if (existing.exists()) {
    throw new Error('이미 사용 중인 이름입니다.')
  }

  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'sambong-world-2026'
  const authEmail = `${crypto.randomUUID()}@${projectId}.firebaseapp.com`

  try {
    const cred = await createUserWithEmailAndPassword(
      firebaseAuth,
      authEmail,
      password,
    )
    await updateProfile(cred.user, { displayName: name })
    await setDoc(doc(firestoreDb, 'users', cred.user.uid), {
      displayName: name,
      createdAt: serverTimestamp(),
    })
    await setDoc(loginRef, {
      authEmail,
      uid: cred.user.uid,
    })
    return cred.user
  } catch (e) {
    const code = e?.code
    if (code === 'auth/weak-password') {
      throw new Error('비밀번호가 너무 약합니다. 더 길게 설정해 주세요.')
    }
    if (code === 'auth/email-already-in-use') {
      throw new Error('계정 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    }
    if (code === 'permission-denied') {
      throw new Error(
        'Firestore 권한이 없습니다. Firebase에 로그인한 뒤 프로젝트 루트에서 npm run deploy:rules 를 실행해 규칙을 배포했는지 확인하세요.',
      )
    }
    throw e
  }
}

/**
 * @param {string} displayName
 * @param {string} password
 */
export async function signInWithName(displayName, password) {
  const name = displayName.trim()
  if (!name) throw new Error('이름을 입력해 주세요.')

  const masterName = import.meta.env.VITE_MASTER_DISPLAY_NAME?.trim()
  const masterPass = import.meta.env.VITE_MASTER_PASSWORD
  const masterEmail = import.meta.env.VITE_MASTER_AUTH_EMAIL?.trim()

  if (
    masterName &&
    masterPass &&
    masterEmail &&
    name === masterName &&
    password === masterPass
  ) {
    try {
      await signInWithEmailAndPassword(firebaseAuth, masterEmail, masterPass)
    } catch (e) {
      const code = e?.code
      if (
        code === 'auth/wrong-password' ||
        code === 'auth/invalid-credential' ||
        code === 'auth/user-not-found'
      ) {
        throw new Error(
          '마스터 계정 로그인에 실패했습니다. Firebase Authentication에 동일 이메일 사용자가 있는지, 비밀번호가 환경 변수와 일치하는지 확인하세요.',
        )
      }
      throw e
    }
    return
  }

  const loginRef = doc(firestoreDb, 'loginByName', name)
  const snap = await getDoc(loginRef)
  if (!snap.exists()) {
    throw new Error('이름 또는 비밀번호가 올바르지 않습니다.')
  }
  const { authEmail } = snap.data()
  try {
    await signInWithEmailAndPassword(firebaseAuth, authEmail, password)
  } catch (e) {
    const code = e?.code
    if (
      code === 'auth/wrong-password' ||
      code === 'auth/invalid-credential' ||
      code === 'auth/user-not-found'
    ) {
      throw new Error('이름 또는 비밀번호가 올바르지 않습니다.')
    }
    throw e
  }
}

export async function signOutUser() {
  await firebaseSignOut(firebaseAuth)
}

/**
 * 마스터 계정으로 로그인했는지(환경 변수 이메일과 일치)
 * @param {import('firebase/auth').User | null} user
 */
export function isMasterUser(user) {
  if (!user?.email) return false
  const masterEmail = import.meta.env.VITE_MASTER_AUTH_EMAIL?.trim()
  return Boolean(masterEmail && user.email === masterEmail)
}

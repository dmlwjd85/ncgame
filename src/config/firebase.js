import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

/**
 * 삼봉 월드(2026sambong6)와 동일 Firebase 프로젝트(sambong-world-2026)를 사용합니다.
 * Vite 빌드 시 VITE_* 환경 변수로 주입됩니다.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

function assertConfig() {
  const missing = Object.entries(firebaseConfig)
    .filter(([, v]) => v == null || v === '')
    .map(([k]) => k)
  if (missing.length > 0) {
    console.warn(
      '[firebase] VITE_FIREBASE_* 환경 변수가 비어 있습니다:',
      missing.join(', '),
    )
  }
}

assertConfig()

export const firebaseApp = initializeApp(firebaseConfig)
export const firebaseAuth = getAuth(firebaseApp)
export const firestoreDb = getFirestore(firebaseApp)

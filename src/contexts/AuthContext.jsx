/* eslint-disable react-refresh/only-export-components -- Context + hook 동시 export */
import { onAuthStateChanged } from 'firebase/auth'
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { firebaseAuth } from '../config/firebase'
import {
  isMasterUser,
  signInWithName,
  signOutUser,
  signUpWithName,
  updatePlayerDisplayName,
} from '../services/authService'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(
    /** @type {import('firebase/auth').User | null} */ (null),
  )
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, (u) => {
      setUser(u)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      /** @type {boolean} */
      isMaster: isMasterUser(user),
      signIn: signInWithName,
      signUp: signUpWithName,
      signOut: signOutUser,
      /** @param {string} name */
      updateDisplayName: (name) =>
        user
          ? updatePlayerDisplayName(user, name)
          : Promise.reject(new Error('로그인이 필요합니다.')),
    }),
    [user, loading],
  )

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth는 AuthProvider 안에서만 사용하세요.')
  }
  return ctx
}

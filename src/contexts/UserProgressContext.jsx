/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react'
import { useAuth } from './AuthContext'
import { mergeHallOfFameComboFromCloud, mergeHallOfFameFromCloud } from '../utils/hallOfFame'
import { useCardPacks } from './CardPackContext'
import { usePlayerProgressStore } from '../stores/playerProgressStore'

const UserProgressContext = createContext(null)

export function UserProgressProvider({ children }) {
  const { user } = useAuth()
  const { packs } = useCardPacks()

  const points = usePlayerProgressStore((s) => s.permanent.points)
  const loading = usePlayerProgressStore((s) => s.loading)
  const refreshFromServer = usePlayerProgressStore((s) => s.refreshFromServer)
  const resetForLogout = usePlayerProgressStore((s) => s.resetForLogout)

  const refreshProgress = useCallback(async () => {
    if (!user?.uid) {
      resetForLogout()
      return
    }
    await refreshFromServer(user.uid)
  }, [user, refreshFromServer, resetForLogout])

  useEffect(() => {
    void refreshProgress()
  }, [refreshProgress])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') void refreshProgress()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [refreshProgress])

  const packIdsKey = useMemo(
    () => (packs?.length ? packs.map((p) => p.id).join('|') : ''),
    [packs],
  )
  const mergedUidRef = useRef(/** @type {string | null} */ (null))
  useEffect(() => {
    if (!user?.uid) {
      mergedUidRef.current = null
      return
    }
    if (!packs?.length || !packIdsKey) return
    const key = `${user.uid}:${packIdsKey}`
    if (mergedUidRef.current === key) return
    mergedUidRef.current = key
    void mergeHallOfFameFromCloud(user.uid, packs)
    void mergeHallOfFameComboFromCloud(user.uid, packs)
  }, [user?.uid, packs, packIdsKey])

  const value = useMemo(
    () => ({
      points,
      loading,
      refreshProgress,
    }),
    [points, loading, refreshProgress],
  )

  return (
    <UserProgressContext.Provider value={value}>
      {children}
    </UserProgressContext.Provider>
  )
}

export function useUserProgress() {
  const ctx = useContext(UserProgressContext)
  if (!ctx) {
    throw new Error('useUserProgress는 UserProgressProvider 안에서만 사용하세요.')
  }
  return ctx
}

/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useAuth } from './AuthContext'
import { loadUserProgress } from '../services/userShopService'
import { mergeHallOfFameFromCloud } from '../utils/hallOfFame'
import { useCardPacks } from './CardPackContext'

const UserProgressContext = createContext(null)

export function UserProgressProvider({ children }) {
  const { user } = useAuth()
  const { packs } = useCardPacks()
  const [points, setPoints] = useState(0)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!user?.uid) {
      setPoints(0)
      return
    }
    setLoading(true)
    try {
      const p = await loadUserProgress(user.uid)
      setPoints(p.points ?? 0)
    } catch {
      setPoints(0)
    } finally {
      setLoading(false)
    }
  }, [user?.uid])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [refresh])

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
  }, [user?.uid, packs, packIdsKey])

  const value = useMemo(
    () => ({
      points,
      loading,
      refreshProgress: refresh,
    }),
    [points, loading, refresh],
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

/* eslint-disable react-refresh/only-export-components -- Context + hook 동시 export */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { loadNcxlxsPacks } from '../services/loadNcxlxsPacks'

/**
 * @typedef {Object} CardPackMeta
 * @property {string} id
 * @property {string} sourceFile
 * @property {string} sheetName
 * @property {object[]} rows
 * @property {string[]} missingColumns
 */

const CardPackContext = createContext(null)

export function CardPackProvider({ children }) {
  const [packs, setPacks] = useState(
    /** @type {CardPackMeta[]} */ ([]),
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(/** @type {string | null} */ (null))

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await loadNcxlxsPacks()
    setPacks(result.packs)
    setError(result.error)
    setLoading(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      const result = await loadNcxlxsPacks()
      if (cancelled) return
      setPacks(result.packs)
      setError(result.error)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo(
    () => ({
      packs,
      loading,
      error,
      reloadPacks: reload,
    }),
    [packs, loading, error, reload],
  )

  return (
    <CardPackContext.Provider value={value}>
      {children}
    </CardPackContext.Provider>
  )
}

export function useCardPacks() {
  const ctx = useContext(CardPackContext)
  if (!ctx) {
    throw new Error('useCardPacks는 CardPackProvider 안에서만 사용하세요.')
  }
  return ctx
}

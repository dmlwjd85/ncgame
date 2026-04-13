import { useCallback, useEffect, useState } from 'react'
import {
  getSambongShopMent,
  setSambongShopMent,
} from '../../services/sambongShopService'

/**
 * 마스터: 삼봉당 말풍선 멘트 편집
 */
export default function AdminSambongShop() {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setMsg('')
    try {
      const m = await getSambongShopMent()
      setText(m)
    } catch (e) {
      setMsg(e?.message ?? '불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const save = async () => {
    setSaving(true)
    setMsg('')
    try {
      await setSambongShopMent(text)
      setMsg('저장했습니다.')
    } catch (e) {
      setMsg(e?.message ?? '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-100">삼봉당 멘트</h2>
      <p className="mt-2 text-sm text-slate-400">
        상점 화면 오른쪽 말풍선에 표시됩니다. 비워 두면 말풍선만 보입니다.
      </p>

      {loading ? (
        <p className="mt-6 text-slate-500">불러오는 중…</p>
      ) : (
        <>
          <label className="mt-4 block text-sm text-slate-400" htmlFor="sb-ment">
            말풍선 내용
          </label>
          <textarea
            id="sb-ment"
            rows={5}
            className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="예: 오늘도 포인트 모아 보시게…"
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
            >
              {saving ? '저장 중…' : '저장'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void load()}
              className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              다시 불러오기
            </button>
          </div>
          {msg ? (
            <p className="mt-3 text-sm text-emerald-300/90">{msg}</p>
          ) : null}
        </>
      )}
    </div>
  )
}

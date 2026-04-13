import { useCallback, useEffect, useState } from 'react'
import { listActivityForMaster } from '../../services/activityService'

/**
 * 마스터 전용: 로그인·가입 등 활동 로그
 */
export default function AdminActivity() {
  const [rows, setRows] = useState(
    /** @type {Array<{ id: string, uid?: string, displayName?: string, type?: string, detail?: string, createdAt?: import('firebase/firestore').Timestamp }>} */ (
      []
    ),
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      const list = await listActivityForMaster(300)
      setRows(list)
    } catch (e) {
      setError(e?.message ?? '목록을 불러오지 못했습니다.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const fmtDate = (ts) => {
    if (!ts?.toDate) return '—'
    try {
      return ts.toDate().toLocaleString('ko-KR')
    } catch {
      return '—'
    }
  }

  const typeLabel = (t) => {
    const m = {
      login: '로그인',
      register: '회원가입',
      master_login: '마스터 로그인',
      master_setup: '마스터 최초 설정',
    }
    return m[t] ?? t ?? '—'
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-100">활동 내역</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">
        로그인·회원가입·마스터 접속 등 최근 기록입니다. (클라이언트에서 기록하며,
        네트워크 오류 시 누락될 수 있습니다.)
      </p>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
        >
          새로고침
        </button>
      </div>

      {error ? (
        <p className="mt-4 rounded-xl border border-rose-500/40 bg-rose-950/50 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-8 text-center text-slate-500">불러오는 중…</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full min-w-[520px] text-left text-xs">
            <thead className="bg-slate-900/90 text-slate-400">
              <tr>
                <th className="px-2 py-2 font-medium">시각</th>
                <th className="px-2 py-2 font-medium">유형</th>
                <th className="px-2 py-2 font-medium">이름</th>
                <th className="px-2 py-2 font-medium">uid</th>
                <th className="px-2 py-2 font-medium">비고</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200">
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="whitespace-nowrap px-2 py-2 text-slate-400">
                    {fmtDate(r.createdAt)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-emerald-200/90">
                    {typeLabel(r.type)}
                  </td>
                  <td className="max-w-[8rem] truncate px-2 py-2">
                    {r.displayName || '—'}
                  </td>
                  <td className="max-w-[7rem] break-all px-2 py-2 text-slate-500">
                    {r.uid || '—'}
                  </td>
                  <td className="max-w-[14rem] break-words px-2 py-2 text-slate-400">
                    {r.detail || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? (
            <p className="px-3 py-6 text-center text-slate-500">기록이 없습니다.</p>
          ) : null}
        </div>
      )}
    </div>
  )
}

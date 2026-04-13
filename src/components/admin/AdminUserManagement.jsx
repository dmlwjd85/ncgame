import { useCallback, useEffect, useState } from 'react'
import {
  deleteUserAccountAsMaster,
  listUsersForMaster,
} from '../../services/authService'

/**
 * 마스터 전용: 가입자 목록(이름·비밀번호) 조회 및 계정 삭제
 */
export default function AdminUserManagement() {
  const [rows, setRows] = useState(
    /** @type {Array<{ uid: string, displayName: string, passwordPlain: string, points: number, createdAt: unknown }>} */ (
      []
    ),
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingUid, setDeletingUid] = useState(
    /** @type {string | null} */ (null),
  )

  const load = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      const list = await listUsersForMaster()
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

  const onDelete = async (uid, name) => {
    const ok = window.confirm(
      `「${name}」계정을 삭제할까요?\nFirebase 로그인·Firestore 정보가 함께 삭제됩니다.`,
    )
    if (!ok) return
    setDeletingUid(uid)
    setError('')
    try {
      await deleteUserAccountAsMaster(uid)
      await load()
    } catch (e) {
      const code = e?.code
      const msg =
        code === 'functions/not-found'
          ? 'Cloud Function이 배포되지 않았습니다. 프로젝트에서 firebase deploy --only functions 를 실행했는지 확인하세요.'
          : e?.message ?? '삭제에 실패했습니다.'
      setError(msg)
    } finally {
      setDeletingUid(null)
    }
  }

  const fmtDate = (ts) => {
    if (!ts?.toDate) return '—'
    try {
      return ts.toDate().toLocaleString('ko-KR')
    } catch {
      return '—'
    }
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-100">회원 관리</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">
        가입 시 Firestore에 보관한 비밀번호를 마스터만 조회할 수 있습니다. (가입
        이전 계정은 비밀번호가 비어 있을 수 있습니다.)
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
          <table className="w-full min-w-[480px] text-left text-xs">
            <thead className="bg-slate-900/90 text-slate-400">
              <tr>
                <th className="px-2 py-2 font-medium">이름</th>
                <th className="px-2 py-2 font-medium">비밀번호</th>
                <th className="px-2 py-2 font-medium">포인트</th>
                <th className="px-2 py-2 font-medium">가입</th>
                <th className="px-2 py-2 font-medium">uid</th>
                <th className="px-2 py-2 font-medium">삭제</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200">
              {rows.map((r) => (
                <tr key={r.uid} className="align-top">
                  <td className="px-2 py-2 font-medium">{r.displayName || '—'}</td>
                  <td className="max-w-[10rem] break-all px-2 py-2 text-amber-100/90">
                    {r.passwordPlain ? r.passwordPlain : '— (미저장)'}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 font-mono text-slate-300">
                    {r.points ?? 0}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-slate-400">
                    {fmtDate(r.createdAt)}
                  </td>
                  <td className="max-w-[8rem] break-all px-2 py-2 text-slate-500">
                    {r.uid}
                  </td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      disabled={deletingUid === r.uid}
                      onClick={() => void onDelete(r.uid, r.displayName || r.uid)}
                      className="rounded-lg border border-rose-500/50 bg-rose-950/40 px-2 py-1 text-rose-200 hover:bg-rose-900/50 disabled:opacity-50"
                    >
                      {deletingUid === r.uid ? '삭제 중…' : '삭제'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? (
            <p className="px-3 py-6 text-center text-slate-500">등록된 사용자가 없습니다.</p>
          ) : null}
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { firebaseAuth } from '../config/firebase'
import { useAuth } from '../contexts/AuthContext'
import { logUserActivity } from '../services/activityService'
import { formatHoFDisplayName } from '../utils/displayName'

/**
 * 이름 + 비밀번호 로그인 (마스터는 환경 변수로 지정한 이름·비밀번호로 동일 화면에서 처리)
 */
export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/'

  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setPending(true)
    try {
      await signIn(name, password)
      const u = firebaseAuth.currentUser
      if (u) {
        await logUserActivity(
          u.uid,
          formatHoFDisplayName(name),
          'login',
          '일반 로그인',
        )
      }
      navigate(from, { replace: true })
    } catch (err) {
      setError(err?.message ?? '로그인에 실패했습니다.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="game-shell min-h-dvh px-4 py-10 text-slate-800">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-xl font-semibold">로그인</h1>
        <p className="mt-2 text-sm text-slate-600">
          가입 시 설정한 <span className="font-medium text-slate-900">이름</span>과{' '}
          <span className="font-medium text-slate-900">비밀번호</span>를 입력하세요.
        </p>

        <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
          <div>
            <label className="block text-sm text-slate-600" htmlFor="login-name">
              이름
            </label>
            <input
              id="login-name"
              autoComplete="username"
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 outline-none focus:border-sky-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label
              className="block text-sm text-slate-600"
              htmlFor="login-password"
            >
              비밀번호
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 outline-none focus:border-sky-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="rounded-2xl bg-gradient-to-r from-sky-500 to-emerald-600 py-3 text-base font-medium text-white shadow-md transition enabled:hover:opacity-95 disabled:opacity-60"
          >
            {pending ? '처리 중…' : '로그인'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          계정이 없으면{' '}
          <Link className="text-sky-700 underline" to="/register">
            회원가입
          </Link>
          {' · '}
          <Link className="text-amber-800 underline" to="/master-login">
            마스터 로그인
          </Link>
        </p>
        <p className="mt-4 text-center">
          <Link className="text-sm text-slate-500 underline" to="/">
            홈으로
          </Link>
        </p>
      </div>
    </div>
  )
}

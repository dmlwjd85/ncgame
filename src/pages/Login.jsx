import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

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
      navigate(from, { replace: true })
    } catch (err) {
      setError(err?.message ?? '로그인에 실패했습니다.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="min-h-dvh bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-xl font-semibold">로그인</h1>
        <p className="mt-2 text-sm text-slate-400">
          가입 시 설정한 <span className="text-slate-200">이름</span>과{' '}
          <span className="text-slate-200">비밀번호</span>를 입력하세요.
        </p>

        <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
          <div>
            <label className="block text-sm text-slate-400" htmlFor="login-name">
              이름
            </label>
            <input
              id="login-name"
              autoComplete="username"
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-base text-slate-100 outline-none focus:border-emerald-500/60"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label
              className="block text-sm text-slate-400"
              htmlFor="login-password"
            >
              비밀번호
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-base text-slate-100 outline-none focus:border-emerald-500/60"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error ? (
            <p className="rounded-lg border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="rounded-2xl bg-emerald-600 py-3 text-base font-medium text-white transition enabled:hover:bg-emerald-500 disabled:opacity-60"
          >
            {pending ? '처리 중…' : '로그인'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          계정이 없으면{' '}
          <Link className="text-emerald-400 underline" to="/register">
            회원가입
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

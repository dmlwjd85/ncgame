import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { DISPLAY_NAME_MAX_LEN } from '../utils/displayName'

/**
 * 이름 + 비밀번호 회원가입 (Firebase Auth + Firestore 이름 매핑)
 */
export default function Register() {
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    if (password !== password2) {
      setError('비밀번호 확인이 일치하지 않습니다.')
      return
    }
    setPending(true)
    try {
      await signUp(name, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err?.message ?? '회원가입에 실패했습니다.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="game-shell min-h-dvh px-4 py-10 text-slate-800">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-xl font-semibold">회원가입</h1>
        <p className="mt-2 text-sm text-slate-600">
          게임에서 사용할 <span className="font-medium text-slate-900">이름</span>과{' '}
          <span className="font-medium text-slate-900">비밀번호</span>를 정합니다. 이름은
          다른 사람과 겹칠 수 없습니다.
        </p>
        <p className="mt-3 rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-xs leading-relaxed text-amber-950">
          관리 목적으로 가입 비밀번호가 서버(Firestore)에 저장되며, 마스터 계정으로만
          조회할 수 있습니다.
        </p>

        <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
          <div>
            <label className="block text-sm text-slate-600" htmlFor="reg-name">
              이름 (최대 {DISPLAY_NAME_MAX_LEN}글자, 명예의 전당에 표시)
            </label>
            <input
              id="reg-name"
              autoComplete="username"
              maxLength={DISPLAY_NAME_MAX_LEN}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 outline-none focus:border-sky-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label
              className="block text-sm text-slate-600"
              htmlFor="reg-password"
            >
              비밀번호 (6자 이상)
            </label>
            <input
              id="reg-password"
              type="password"
              autoComplete="new-password"
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 outline-none focus:border-sky-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>
          <div>
            <label
              className="block text-sm text-slate-600"
              htmlFor="reg-password2"
            >
              비밀번호 확인
            </label>
            <input
              id="reg-password2"
              type="password"
              autoComplete="new-password"
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 outline-none focus:border-sky-500"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              minLength={6}
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
            {pending ? '처리 중…' : '가입하기'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          이미 계정이 있으면{' '}
          <Link className="text-sky-700 underline" to="/login">
            로그인
          </Link>
        </p>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  completeMasterInitialSetup,
  getMasterSetupCompleted,
  signInMaster,
} from '../services/authService'

/**
 * 마스터 전용 로그인 — 일반 이름 로그인과 분리
 * 최초 1회: 설정한 비밀번호로 계정 생성, 이후 동일 비밀번호로 로그인
 */
export default function MasterLogin() {
  const navigate = useNavigate()
  const location = useLocation()
  const from =
    location.state?.from?.pathname ||
    new URLSearchParams(location.search).get('redirect') ||
    '/admin'

  const [setupLoaded, setSetupLoaded] = useState(false)
  const [setupDone, setSetupDone] = useState(false)

  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const done = await getMasterSetupCompleted()
        if (!cancelled) {
          setSetupDone(done)
          setSetupLoaded(true)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e?.message ?? '설정 상태를 불러오지 못했습니다.')
          setSetupLoaded(true)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function onSubmitSetup(e) {
    e.preventDefault()
    setError('')
    if (password !== password2) {
      setError('비밀번호 확인이 일치하지 않습니다.')
      return
    }
    setPending(true)
    try {
      await completeMasterInitialSetup(password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err?.message ?? '설정에 실패했습니다.')
    } finally {
      setPending(false)
    }
  }

  async function onSubmitLogin(e) {
    e.preventDefault()
    setError('')
    setPending(true)
    try {
      await signInMaster(password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err?.message ?? '로그인에 실패했습니다.')
    } finally {
      setPending(false)
    }
  }

  if (!setupLoaded) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-950 text-slate-400">
        불러오는 중…
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-xl font-semibold text-emerald-100">마스터 로그인</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          일반 회원과 별도로, 관리자 화면 전용 계정입니다.{' '}
          <span className="text-slate-300">
            최초 한 번만 비밀번호를 정하면 이후에는 같은 비밀번호로 들어옵니다.
          </span>
        </p>

        {!setupDone ? (
          <form onSubmit={onSubmitSetup} className="mt-8 flex flex-col gap-4">
            <p className="rounded-xl border border-amber-500/30 bg-amber-950/40 px-3 py-2 text-xs text-amber-100/90">
              이 앱이 연결된 Firebase 프로젝트 전용 주소로 마스터 계정이 만들어집니다. 별도
              설정 없이 비밀번호만 정하면 됩니다.
            </p>
            <div>
              <label className="block text-sm text-slate-400" htmlFor="ms-pw">
                비밀번호 (6자 이상)
              </label>
              <input
                id="ms-pw"
                type="password"
                autoComplete="new-password"
                className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-3 text-base text-slate-100 outline-none focus:border-emerald-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400" htmlFor="ms-pw2">
                비밀번호 확인
              </label>
              <input
                id="ms-pw2"
                type="password"
                autoComplete="new-password"
                className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-3 text-base text-slate-100 outline-none focus:border-emerald-500"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                required
                minLength={6}
              />
            </div>
            {error ? (
              <p className="rounded-lg border border-rose-500/40 bg-rose-950/50 px-3 py-2 text-sm text-rose-200">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={pending}
              className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 py-3 text-base font-medium text-white shadow-md transition enabled:hover:opacity-95 disabled:opacity-60"
            >
              {pending ? '처리 중…' : '마스터 계정 만들기'}
            </button>
          </form>
        ) : (
          <form onSubmit={onSubmitLogin} className="mt-8 flex flex-col gap-4">
            <div>
              <label className="block text-sm text-slate-400" htmlFor="ml-pw">
                마스터 비밀번호
              </label>
              <input
                id="ml-pw"
                type="password"
                autoComplete="current-password"
                className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-3 text-base text-slate-100 outline-none focus:border-emerald-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error ? (
              <p className="rounded-lg border border-rose-500/40 bg-rose-950/50 px-3 py-2 text-sm text-rose-200">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={pending}
              className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 py-3 text-base font-medium text-white shadow-md transition enabled:hover:opacity-95 disabled:opacity-60"
            >
              {pending ? '처리 중…' : '로그인'}
            </button>
          </form>
        )}

        <p className="mt-8 text-center text-sm text-slate-500">
          <Link className="text-emerald-400 underline" to="/login">
            일반 회원 로그인
          </Link>
          {' · '}
          <Link className="text-slate-400 underline" to="/">
            홈으로
          </Link>
        </p>
      </div>
    </div>
  )
}

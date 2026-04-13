import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  clearRunSave,
  clearStagedResume,
  loadRunSave,
} from '../utils/gameRunSave'
import GameRulesModal from '../components/GameRulesModal'
import JokboModal from '../components/JokboModal'
import HallOfFamePanel from '../components/HallOfFamePanel'
import ShopPanel from '../components/ShopPanel'
import { useAuth } from '../contexts/AuthContext'
import { useCardPacks } from '../contexts/CardPackContext'
import { useUserProgress } from '../contexts/UserProgressContext'
import { prepareGameBootstrap } from '../services/userShopService'
import { DISPLAY_NAME_MAX_LEN, formatHoFDisplayName } from '../utils/displayName'
import { displaySheetName } from '../utils/tutorialPack'
import { maxLevelFromRowCount } from '../utils/gameRules'
import { buildGameLocation } from '../utils/gameRoute'
import { INITIAL_LIVES } from '../utils/userProgressConstants'

/**
 * 홈 — 로그인·팩 선택·설명/족보 팝업·시작
 */
export default function Home() {
  const navigate = useNavigate()
  const { user, loading: authLoading, signOut, isMaster, updateDisplayName } =
    useAuth()
  const { packs, loading: packsLoading, error: packsError, reloadPacks } =
    useCardPacks()
  const [tab, setTab] = useState(
    /** @type {'play'|'shop'|'hof'|'combo'} */ ('play'),
  )
  const [selectedPackId, setSelectedPackId] = useState(null)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [jokboOpen, setJokboOpen] = useState(false)
  const [nameEdit, setNameEdit] = useState('')
  const [nameMsg, setNameMsg] = useState(/** @type {string} */ (''))
  const [nameSaving, setNameSaving] = useState(false)

  const { points: userPoints, refreshProgress } = useUserProgress()

  useEffect(() => {
    void refreshProgress()
  }, [tab, refreshProgress])

  useEffect(() => {
    if (user?.displayName) {
      setNameEdit(formatHoFDisplayName(user.displayName))
    } else {
      setNameEdit('')
    }
  }, [user?.displayName])

  const effectivePackId = selectedPackId ?? packs[0]?.id ?? null
  const selectedPack = packs.find((p) => p.id === effectivePackId)
  const validCount = selectedPack
    ? selectedPack.rows.filter((r) => r.topic && r.explanation).length
    : 0
  const maxLv = maxLevelFromRowCount(validCount)

  const canStart =
    user &&
    selectedPack &&
    maxLv >= 1 &&
    selectedPack.missingColumns.length === 0

  const savedRun = loadRunSave()
  const canResume =
    !!savedRun &&
    !!effectivePackId &&
    String(savedRun.packId) === String(effectivePackId)

  const goGame = async () => {
    if (!effectivePackId || !canStart) return
    clearStagedResume()
    clearRunSave()
    const loc = buildGameLocation(effectivePackId)
    let gameBootstrap = {
      startLevel: 1,
      lives: INITIAL_LIVES,
      cheonryan: 1,
    }
    if (user?.uid) {
      try {
        gameBootstrap = await prepareGameBootstrap(user.uid, maxLv)
      } catch {
        /* 폴백 */
      }
    }
    navigate(loc, {
      state: { packId: effectivePackId, botCount: 1, gameBootstrap },
    })
  }

  const continueGame = () => {
    if (!effectivePackId || !canStart || !savedRun) return
    try {
      sessionStorage.setItem(
        `ncgame-resume-${effectivePackId}`,
        JSON.stringify(savedRun),
      )
    } catch {
      /* noop */
    }
    clearRunSave()
    const loc = buildGameLocation(effectivePackId)
    navigate(loc, {
      state: { packId: effectivePackId, botCount: 1 },
    })
  }

  return (
    <div className="game-shell shell-3d relative flex h-[100dvh] max-h-[100dvh] flex-col overflow-x-hidden overflow-y-hidden text-slate-800">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_55%_at_50%_-8%,rgba(120,100,60,0.12),transparent)]"
        aria-hidden
      />

      <div className="relative mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
        {/* 상단: 로그인 · 회원가입 (게스트) / 간단 프로필 */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="min-w-0">
              <h1 className="font-display truncate text-xl font-bold text-slate-100 md:text-2xl">
                가나다 눈치게임
              </h1>
              {user ? (
                <p className="mt-0.5 text-xs font-medium text-slate-300">
                  보유 포인트{' '}
                  <span className="font-mono text-amber-300">{userPoints}</span> P
                </p>
              ) : null}
            </div>
          </div>
          {authLoading ? (
            <span className="text-xs text-slate-500">…</span>
          ) : user ? (
            <div className="flex items-center gap-2">
              <span className="max-w-[140px] truncate text-sm text-slate-200">
                {formatHoFDisplayName(user.displayName)}
              </span>
              <button
                type="button"
                className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700"
                onClick={() => void signOut()}
              >
                나가기
              </button>
            </div>
          ) : (
            <div className="flex shrink-0 gap-2">
              <Link
                className="rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-md"
                to="/login"
              >
                로그인
              </Link>
              <Link
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800"
                to="/register"
              >
                회원가입
              </Link>
            </div>
          )}
        </div>

        {user ? (
          <div className="card-lift-3d mx-auto mt-4 w-full rounded-2xl border border-amber-200/90 bg-white/95 px-3 py-3">
            <p className="text-[11px] text-slate-600">
              명예의 전당 표시 이름 (최대 {DISPLAY_NAME_MAX_LEN}글자)
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                type="text"
                maxLength={DISPLAY_NAME_MAX_LEN}
                value={nameEdit}
                onChange={(e) =>
                  setNameEdit(formatHoFDisplayName(e.target.value))
                }
                className="min-w-[8rem] flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500"
                autoComplete="nickname"
              />
              <button
                type="button"
                disabled={nameSaving}
                className="shrink-0 rounded-xl bg-gradient-to-r from-cyan-600/90 to-violet-600/80 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                onClick={async () => {
                  setNameMsg('')
                  setNameSaving(true)
                  try {
                    const trimmed = nameEdit.trim()
                    const fallback = formatHoFDisplayName(user?.displayName ?? '')
                    const toSave = trimmed || fallback
                    await updateDisplayName(toSave)
                    setNameMsg('저장했어요.')
                  } catch (e) {
                    setNameMsg(e?.message ?? '저장에 실패했습니다.')
                  } finally {
                    setNameSaving(false)
                  }
                }}
              >
                {nameSaving ? '…' : '저장'}
              </button>
            </div>
            {nameMsg ? (
              <p className="mt-2 text-xs text-slate-400">{nameMsg}</p>
            ) : null}
          </div>
        ) : null}

        <div className="tab-rail-3d mx-auto mt-4 grid w-full grid-cols-2 gap-1 rounded-2xl border border-slate-600/80 bg-gradient-to-b from-slate-800/95 to-slate-900/90 p-1 sm:grid-cols-4">
          <button
            type="button"
            className={`rounded-xl py-2.5 text-xs font-medium transition sm:text-sm ${
              tab === 'play'
                ? 'bg-gradient-to-b from-slate-600 to-slate-800 text-white shadow-[0_4px_0_rgba(15,23,42,0.35),0_8px_20px_rgba(15,23,42,0.25)]'
                : 'text-slate-400'
            }`}
            onClick={() => setTab('play')}
          >
            눈치게임
          </button>
          <button
            type="button"
            className={`rounded-xl py-2.5 text-xs font-medium transition sm:text-sm ${
              tab === 'combo'
                ? 'bg-gradient-to-b from-violet-700 to-indigo-950 text-white shadow-[0_4px_0_rgba(40,30,90,0.45),0_8px_20px_rgba(40,30,90,0.28)]'
                : 'text-slate-400'
            }`}
            onClick={() => setTab('combo')}
          >
            무한도전
          </button>
          <button
            type="button"
            className={`rounded-xl py-2.5 text-xs font-medium transition sm:text-sm ${
              tab === 'shop'
                ? 'bg-gradient-to-b from-amber-700 to-rose-900 text-white shadow-[0_4px_0_rgba(120,30,30,0.45),0_8px_20px_rgba(120,20,20,0.3)]'
                : 'text-slate-400'
            }`}
            onClick={() => setTab('shop')}
          >
            상점
          </button>
          <button
            type="button"
            className={`rounded-xl py-2.5 text-xs font-medium transition sm:text-sm ${
              tab === 'hof'
                ? 'bg-gradient-to-b from-amber-600 to-amber-950 text-white shadow-[0_4px_0_rgba(120,80,20,0.45),0_8px_20px_rgba(120,80,20,0.28)]'
                : 'text-slate-400'
            }`}
            onClick={() => setTab('hof')}
          >
            명예의 전당
          </button>
        </div>

        <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden">
        {tab === 'play' ? (
          <div className="min-h-0 flex-1 overflow-y-auto [-webkit-overflow-scrolling:touch] pr-0.5">
          <>
            <section className="card-lift-3d mx-auto mt-2 w-full rounded-2xl border border-slate-200 bg-white/95 px-4 py-4">
              <div className="mb-3 flex items-center justify-end">
                <button
                  type="button"
                  className="text-xs text-sky-700 underline underline-offset-2"
                  onClick={() => void reloadPacks()}
                >
                  새로고침
                </button>
              </div>
              {packsLoading ? (
                <p className="text-sm text-slate-500">불러오는 중…</p>
              ) : packsError ? (
                <p className="text-sm text-amber-200/90">{packsError}</p>
              ) : packs.length === 0 ? (
                <p className="text-sm text-slate-500">등록된 단어 팩이 없습니다.</p>
              ) : (
                <ul className="max-h-52 space-y-2 overflow-y-auto">
                  {packs.map((p) => {
                    const v = p.rows.filter((r) => r.topic && r.explanation).length
                    const ml = maxLevelFromRowCount(v)
                    const broken = p.missingColumns.length > 0
                    return (
                      <li key={p.id}>
                        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 transition has-[:checked]:border-sky-400 has-[:checked]:bg-sky-50">
                          <input
                            type="radio"
                            name="pack"
                            className="h-4 w-4 shrink-0"
                            checked={effectivePackId === p.id}
                            onChange={() => setSelectedPackId(p.id)}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-slate-900">
                              {displaySheetName(p)}
                            </p>
                            <p className="text-xs text-slate-500">
                              최대 {ml}단계 · 카드 {v}장
                              {broken ? ' · 설정 필요' : ''}
                            </p>
                          </div>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            {user && packs.length > 0 ? (
              selectedPack &&
              maxLv >= 1 &&
              selectedPack.missingColumns.length === 0 ? (
                <section className="card-lift-3d mx-auto mt-4 w-full space-y-3 rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-violet-50 px-4 py-5">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className="rounded-xl border border-slate-300 bg-white py-3 text-sm font-medium text-slate-800 shadow-sm"
                      onClick={() => setRulesOpen(true)}
                    >
                      게임 설명서 보기
                    </button>
                    <button
                      type="button"
                      className="rounded-xl border border-slate-300 bg-white py-3 text-sm font-medium text-slate-800 shadow-sm"
                      onClick={() => setJokboOpen(true)}
                    >
                      족보 보기
                    </button>
                  </div>
                  <p className="text-center text-xs text-slate-500">
                    가상 플레이어 1명과 대전합니다.
                  </p>
                  {canResume ? (
                    <div className="flex w-full flex-col gap-2">
                      <button
                        type="button"
                        disabled={!canStart}
                        onClick={continueGame}
                        className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 py-3.5 text-base font-semibold text-white shadow-lg disabled:opacity-40"
                      >
                        이어하기
                      </button>
                      <button
                        type="button"
                        disabled={!canStart}
                        onClick={goGame}
                        className="w-full rounded-2xl border border-slate-300 bg-white py-3 text-base font-semibold text-slate-800 shadow-sm disabled:opacity-40"
                      >
                        새로 시작
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={!canStart}
                      onClick={goGame}
                      className="w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-violet-600 py-3.5 text-base font-semibold text-white shadow-lg disabled:opacity-40"
                    >
                      시작하기
                    </button>
                  )}
                </section>
              ) : (
                <p className="mx-auto mt-6 text-center text-sm text-slate-500">
                  {selectedPack?.missingColumns?.length
                    ? '이 팩은 지금 쓸 수 없어요. 다른 팩을 골라 주세요.'
                    : maxLv < 1
                      ? '이 팩으로는 아직 시작할 수 없어요.'
                      : '단어 팩을 골라 주세요.'}
                </p>
              )
            ) : null}
            {!user ? (
              <p className="mx-auto mt-6 text-center text-sm text-slate-500">
                로그인하면 플레이할 수 있어요.
              </p>
            ) : null}
          </>
          </div>
        ) : tab === 'combo' ? (
          <div className="min-h-0 flex-1 overflow-y-auto [-webkit-overflow-scrolling:touch] pr-0.5">
            <section className="card-lift-3d mx-auto mt-2 w-full rounded-2xl border border-violet-500/35 bg-slate-900/55 px-4 py-4 text-slate-200">
              <h2 className="font-display text-base font-bold text-violet-200">
                무한도전
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                단어팩을 고른 뒤 도전모드(시간 제한·명예의 전당·가끔 포인트 도전) 또는
                연습모드(무제한·기기에만 기록)를 선택합니다. 주제는 매 판 랜덤입니다.
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <Link
                  className="block rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-800 py-3.5 text-center text-sm font-semibold text-white shadow-lg"
                  to="/combo-challenge"
                >
                  {canStart && effectivePackId
                    ? '도전 시작 (팩 선택)'
                    : '단어팩 고르고 도전'}
                </Link>
                {canStart && effectivePackId ? (
                  <Link
                    className="block rounded-2xl border border-violet-500/50 py-2.5 text-center text-xs font-medium text-violet-200"
                    to={`/combo-challenge?packId=${encodeURIComponent(String(effectivePackId))}`}
                  >
                    홈에서 고른 팩 미리 선택
                  </Link>
                ) : null}
              </div>
            </section>
          </div>
        ) : tab === 'shop' ? (
          <div className="min-h-0 flex-1 overflow-y-auto [-webkit-overflow-scrolling:touch] pr-0.5">
            <ShopPanel />
          </div>
        ) : (
          <section className="hof-temple mx-auto flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border px-4 py-4">
            <div className="shrink-0 border-b border-[var(--hof-border)] pb-3">
              <h2 className="font-display text-lg font-bold text-[var(--hof-ink)]">
                명예의 전당
              </h2>
              <p className="athens-subtitle mt-0.5 text-[12px] text-[var(--hof-muted)]">
                Hall of Fame — agōn
              </p>
              <p className="mt-1.5 text-[11px] leading-snug text-[var(--hof-muted)]">
                <span className="font-semibold text-[var(--hof-ink)]">눈치게임</span>은 팩별
                최고 레벨,{' '}
                <span className="font-semibold text-[var(--hof-ink)]">무한도전</span>은 최고
                연속 성공을 각각 올립니다. 동점이면 먼저 달성한 분이 위입니다.
              </p>
            </div>
            <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1 [-webkit-overflow-scrolling:touch]">
              {packsLoading ? (
                <p className="text-sm text-[var(--hof-muted)]">불러오는 중…</p>
              ) : (
                <HallOfFamePanel packs={packs} />
              )}
            </div>
          </section>
        )}
        </div>

        {isMaster ? (
          <nav className="mx-auto mt-2 w-full shrink-0 pb-1 pt-4">
            <Link
              to="/admin"
              className="block rounded-2xl border border-amber-300 bg-amber-50 py-3 text-center text-sm text-amber-900"
            >
              관리자
            </Link>
          </nav>
        ) : null}
      </div>

      <GameRulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
      <JokboModal
        open={jokboOpen}
        pack={selectedPack}
        onClose={() => setJokboOpen(false)}
      />
    </div>
  )
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom'
import Phase1Matching from '../components/game/Phase1Matching'
import Phase2Mind from '../components/game/Phase2Mind'
import { useAuth } from '../contexts/AuthContext'
import { useCardPacks } from '../contexts/CardPackContext'
import {
  MAX_LIVES,
  maxLevelFromRowCount,
  phase1ComboRewards,
  phase2SecondsForLevel,
} from '../utils/gameRules'
import { saveHallOfFameIfBetter } from '../utils/hallOfFame'
import { sfxCombo, sfxLevelClearFanfare } from '../utils/gameSfx'
import { resolveDisplayNameForHoF } from '../services/authService'
import { clearStagedResume, peekResumeFromSession } from '../utils/gameRunSave'
import { comparePlayOrder } from '../utils/koCompare'
import {
  NCGAME_LAST_PACK_KEY,
  resolveGameBotCount,
  resolveGamePackId,
} from '../utils/gameRoute'
import { isTutorialPack } from '../utils/tutorialPack'

function shuffleRows(rows) {
  const a = [...rows]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** 게임 오버 화면 손패 정렬 — 전근대사 팩은 엑셀(id) 순 */
function sortHandForP2Snapshot(hand, orderMode) {
  return [...hand].sort((a, b) => {
    const o = comparePlayOrder(a, b, orderMode)
    if (o !== 0) return o
    return String(a.id).localeCompare(String(b.id))
  })
}

function fieldActorLabel(from) {
  if (from === 'player') return '나'
  if (from === 'bot1') return '가상 A'
  if (from === 'bot2') return '가상 B'
  return String(from)
}

/**
 * 레벨별 1페이즈 → 2페이즈 (최대 15레벨)
 */
export default function Game() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const {
    packs,
    loading: packsLoading,
    error: packsError,
    reloadPacks,
  } = useCardPacks()

  const packId = resolveGamePackId(location.state, searchParams)
  const botCount = resolveGameBotCount()

  const resumeSnap = useMemo(() => {
    if (!packId) return null
    return peekResumeFromSession(packId)
  }, [packId])

  const pack = useMemo(
    () => packs.find((p) => p.id === packId),
    [packs, packId],
  )

  useEffect(() => {
    if (packsLoading || packsError || !packId) return
    if (pack?.id) {
      try {
        sessionStorage.setItem(NCGAME_LAST_PACK_KEY, pack.id)
      } catch {
        /* noop */
      }
      return
    }
    try {
      const s = sessionStorage.getItem(NCGAME_LAST_PACK_KEY)
      if (s === packId) sessionStorage.removeItem(NCGAME_LAST_PACK_KEY)
    } catch {
      /* noop */
    }
  }, [packsLoading, packsError, packId, pack])

  const validRows = useMemo(
    () => (pack ? pack.rows.filter((r) => r.topic && r.explanation) : []),
    [pack],
  )

  const maxLevel = useMemo(
    () => maxLevelFromRowCount(validRows.length),
    [validRows.length],
  )

  const [segment, setSegment] = useState(
    /** @type {'p1'|'p2'|'cleared'|'over'} */ ('p1'),
  )
  const [level, setLevel] = useState(() => resumeSnap?.level ?? 1)
  const [lives, setLives] = useState(() =>
    resumeSnap
      ? Math.min(MAX_LIVES, Math.max(0, resumeSnap.lives))
      : MAX_LIVES,
  )
  const [cheonryan, setCheonryan] = useState(() => resumeSnap?.cheonryan ?? 1)
  const [p1Combo, setP1Combo] = useState(() => resumeSnap?.p1Combo ?? 0)

  /** 1페이즈 현재 배치에서 이미 맞춘 실제 카드 id */
  const [p1BatchMatchedIds, setP1BatchMatchedIds] = useState(
    () => new Set(),
  )
  /** 매칭할 때마다 뜻 슬롯 3개 재구성 */
  const [p1DistractorVersion, setP1DistractorVersion] = useState(0)
  /** 이번 배치에서 이미 맞춘 뜻(해설) 문자열 — 슬롯 재구성 시 제외 */
  const [p1UsedExplanations, setP1UsedExplanations] = useState(
    /** @type {string[]} */ ([]),
  )
  /** 현재 배치에서 handleP1BatchComplete 중복 호출 방지 */
  const p1BatchCompleteFiredRef = useRef(false)

  const [queue, setQueue] = useState(/** @type {object[]} */ ([]))
  const [queueReady, setQueueReady] = useState(false)
  const [roundVersion, setRoundVersion] = useState(0)
  const [p1Collected, setP1Collected] = useState(/** @type {object[]} */ ([]))
  const [p2GameOver, setP2GameOver] = useState(/** @type {unknown} */ (null))
  const [deckNotice, setDeckNotice] = useState(/** @type {string | null} */ (null))
  /** 콤보 타격 이펙트용 키(값이 바뀔 때마다 애니메이션 재생) */
  const [comboFxKey, setComboFxKey] = useState(0)
  /** 2페이즈 연속 정답 콤보(1페이즈와 별도) */
  const [p2Combo, setP2Combo] = useState(0)
  /** 1페이즈에서 이미 꺼낸 카드 id — 부족 시 제외 덱, 전부 소진 시 초기화 */
  const usedRowIdsRef = useRef(/** @type {Set<string>} */ (new Set()))
  const prevComboRef = useRef(p1Combo)
  const prevP2ComboRef = useRef(0)
  /** 2페이즈 콤보 팝업만 2초 후 자동 숨김 */
  const p2ComboFlashTimerRef = useRef(
    /** @type {ReturnType<typeof setTimeout> | null} */ (null),
  )
  const [p2ComboOverlayVisible, setP2ComboOverlayVisible] = useState(false)

  const packKey = pack?.id ?? ''
  const tutorialMode = isTutorialPack(pack)
  /** 전근대사 100선: 2페이즈는 엑셀 행 순서(시간 순) 족보 */
  const phase2OrderMode = pack?.sheetName === '전근대사 100선' ? 'sheet' : 'topic'

  /** 레벨 클리어: 토스트·팡파레만, 2페이즈 화면 유지 */
  const [showLevelClearPopup, setShowLevelClearPopup] = useState(false)

  const refillQueueFromPool = useCallback(() => {
    const used = usedRowIdsRef.current
    const unused = validRows.filter((r) => !used.has(r.id))
    if (unused.length === 0) {
      used.clear()
      setDeckNotice(
        '단어팩에서 쓸 카드가 부족해요. 덱을 처음부터 다시 섞어 이어갑니다.',
      )
      window.setTimeout(() => setDeckNotice(null), 6000)
      return shuffleRows(validRows)
    }
    return shuffleRows(unused)
  }, [validRows])

  /* eslint-disable react-hooks/set-state-in-effect -- 덱 셔플 초기화·이어하기 복원 */
  useEffect(() => {
    if (!pack || queueReady) return
    if (resumeSnap && String(resumeSnap.packId) === String(packId)) {
      usedRowIdsRef.current = new Set(resumeSnap.usedRowIds.map(String))
      const byId = new Map(validRows.map((r) => [String(r.id), r]))
      const q = resumeSnap.queueRowIds
        .map((id) => byId.get(String(id)))
        .filter(Boolean)
      const pool = shuffleRows(
        validRows.filter((r) => !usedRowIdsRef.current.has(String(r.id))),
      )
      setQueue(q.length > 0 ? q : pool)
      clearStagedResume()
      setQueueReady(true)
      return
    }
    usedRowIdsRef.current = new Set()
    setQueue(shuffleRows(validRows))
    setQueueReady(true)
  }, [pack, queueReady, validRows, packId, resumeSnap])
  /* eslint-enable react-hooks/set-state-in-effect */

  /* eslint-disable react-hooks/set-state-in-effect -- 1페이즈 콤보 증가 시 타격감 연출 */
  useEffect(() => {
    if (segment !== 'p1') {
      prevComboRef.current = p1Combo
      return
    }
    if (p1Combo > prevComboRef.current && p1Combo >= 1) {
      setComboFxKey((k) => k + 1)
      sfxCombo(p1Combo)
    }
    prevComboRef.current = p1Combo
  }, [p1Combo, segment])
  /* eslint-enable react-hooks/set-state-in-effect */

  /* eslint-disable react-hooks/set-state-in-effect -- 2페이즈 콤보 증가 시 타격감·SFX·2초 뒤 팝업 숨김 */
  useEffect(() => {
    if (segment !== 'p2') {
      prevP2ComboRef.current = p2Combo
      if (p2ComboFlashTimerRef.current) {
        clearTimeout(p2ComboFlashTimerRef.current)
        p2ComboFlashTimerRef.current = null
      }
      setP2ComboOverlayVisible(false)
      return
    }
    if (p2Combo > prevP2ComboRef.current && p2Combo >= 1) {
      setComboFxKey((k) => k + 1)
      sfxCombo(p2Combo)
      setP2ComboOverlayVisible(true)
      if (p2ComboFlashTimerRef.current) {
        clearTimeout(p2ComboFlashTimerRef.current)
      }
      p2ComboFlashTimerRef.current = window.setTimeout(() => {
        setP2ComboOverlayVisible(false)
        p2ComboFlashTimerRef.current = null
      }, 2000)
    }
    prevP2ComboRef.current = p2Combo
  }, [p2Combo, segment])
  /* eslint-enable react-hooks/set-state-in-effect */

  /** 레벨 1~2: 초보용 드래그·탭 하이라이트 */
  const coachMode = level <= 2

  /* eslint-disable react-hooks/set-state-in-effect -- 1·기타 구간에서는 2페이즈 콤보 표기만 초기화 */
  useEffect(() => {
    if (segment !== 'p2') setP2Combo(0)
  }, [segment, level, roundVersion])
  /* eslint-enable react-hooks/set-state-in-effect */

  const cardsNeededThisLevel = level

  const need = cardsNeededThisLevel - p1Collected.length

  /**
   * 1페이즈: 위 뜻 3칸 — 아직 맞추지 않은 단어의 정답 해설 + 오답 해설, 매칭할 때마다 새로 섞음.
   * 사용된 해설은 제외하고 다른 해설로 채움.
   */
  const p1Slots = useMemo(() => {
    if (need <= 0 || queue.length === 0) return []
    const batchTake = Math.min(need, queue.length, 3)
    const batchReal = queue
      .slice(0, batchTake)
      .map((r) => ({ ...r, _p1Filler: /** @type {const} */ (false) }))
    const unmatched = batchReal.filter(
      (r) => !p1BatchMatchedIds.has(String(r.id)),
    )

    /* 배치 클리어 직전 한 프레임: 슬롯 재계산 스킵 */
    if (unmatched.length === 0 && batchReal.length > 0) {
      return []
    }

    const correctParts = unmatched.map((r) => ({
      explanation: String(r.explanation ?? '').trim(),
      correctRowId: String(r.id),
      _p1Filler: false,
    }))

    const excluded = new Set([
      ...correctParts.map((c) => c.explanation),
      ...p1UsedExplanations,
    ])

    const pool = shuffleRows(
      validRows.filter((r) => {
        const exp = String(r.explanation ?? '').trim()
        return r.topic && exp && !excluded.has(exp)
      }),
    )

    const distractors = []
    let guard = 0
    while (distractors.length < 3 - correctParts.length && guard < 500) {
      guard += 1
      const r = pool.pop()
      if (!r) break
      const exp = String(r.explanation ?? '').trim()
      if (!exp || excluded.has(exp)) continue
      excluded.add(exp)
      distractors.push({
        explanation: exp,
        correctRowId: null,
        _p1Filler: true,
      })
    }
    let fb = 0
    while (distractors.length < 3 - correctParts.length && validRows.length > 0) {
      const r = validRows[fb % validRows.length]
      fb += 1
      const exp = String(r?.explanation ?? '').trim()
      if (!exp || excluded.has(exp)) continue
      excluded.add(exp)
      distractors.push({
        explanation: exp,
        correctRowId: null,
        _p1Filler: true,
      })
    }

    const combined = shuffleRows([...correctParts, ...distractors]).slice(0, 3)
    return combined.map((item, i) => ({
      id: `p1slot-${level}-rv${roundVersion}-dv${p1DistractorVersion}-${i}`,
      explanation: item.explanation,
      correctRowId: item.correctRowId,
      _p1Filler: item._p1Filler,
    }))
  }, [
    need,
    queue,
    validRows,
    level,
    roundVersion,
    p1DistractorVersion,
    p1BatchMatchedIds,
    p1UsedExplanations,
  ])

  const p1TopicRows = useMemo(() => {
    if (need <= 0 || queue.length === 0) return []
    const batchTake = Math.min(need, queue.length, 3)
    return queue
      .slice(0, batchTake)
      .map((r) => ({ ...r, _p1Filler: false }))
      .filter((r) => !p1BatchMatchedIds.has(String(r.id)))
  }, [need, queue, p1BatchMatchedIds])

  const handleP1RealMatch = useCallback((row, explanationText) => {
    const t = String(explanationText).trim()
    setP1UsedExplanations((prev) => (prev.includes(t) ? prev : [...prev, t]))
    setP1DistractorVersion((v) => v + 1)
    setP1BatchMatchedIds((prev) => {
      const next = new Set(prev)
      next.add(String(row.id))
      return next
    })
  }, [])

  /* eslint-disable react-hooks/set-state-in-effect -- 새 배치마다 맞춤 진행·해설 풀 초기화 */
  useEffect(() => {
    setP1BatchMatchedIds(new Set())
    setP1UsedExplanations([])
    setP1DistractorVersion(0)
    p1BatchCompleteFiredRef.current = false
  }, [roundVersion])
  /* eslint-enable react-hooks/set-state-in-effect */

  const phase1Done =
    p1Collected.length >= cardsNeededThisLevel && queueReady

  const levelDeck = useMemo(
    () => p1Collected.slice(0, cardsNeededThisLevel),
    [p1Collected, cardsNeededThisLevel],
  )

  const poolRows = useMemo(() => {
    if (!pack) return []
    const ids = new Set(levelDeck.map((r) => r.id))
    return pack.rows.filter((r) => !ids.has(r.id))
  }, [pack, levelDeck])

  /* 1페이즈 배치 완료 시 — 필러 줄은 수집 대상에서 제외 */
  const handleP1BatchComplete = useCallback(
    (rows) => {
      const real = rows.filter((r) => !r._p1Filler)
      if (real.length === 0) return
      setP1Collected((c) => {
        const newC = [...c, ...real]
        const needAfter = cardsNeededThisLevel - newC.length
        setQueue((q) => {
          const next = q.slice(real.length)
          real.forEach((r) => usedRowIdsRef.current.add(r.id))
          if (next.length === 0 && needAfter > 0) {
            return refillQueueFromPool()
          }
          return next
        })
        /* 이번 레벨 1페이즈를 모두 채운 경우 roundVersion을 올리지 않음 → 황금 연출이 지워지지 않고 3초 전환 동안 유지 */
        if (newC.length < cardsNeededThisLevel) {
          setRoundVersion((v) => v + 1)
        }
        return newC
      })
    },
    [cardsNeededThisLevel, refillQueueFromPool],
  )

  useEffect(() => {
    if (segment !== 'p1' || !queueReady || need <= 0) return
    const batchTake = Math.min(need, queue.length, 3)
    if (batchTake === 0) return
    const batch = queue.slice(0, batchTake)
    if (p1BatchMatchedIds.size < batchTake) return
    const allDone = batch.every((r) => p1BatchMatchedIds.has(String(r.id)))
    if (!allDone || p1BatchCompleteFiredRef.current) return
    p1BatchCompleteFiredRef.current = true
    handleP1BatchComplete(batch.map((r) => ({ ...r, _p1Filler: false })))
  }, [
    segment,
    queueReady,
    need,
    queue,
    p1BatchMatchedIds,
    handleP1BatchComplete,
  ])

  useEffect(() => {
    if (segment !== 'p1' || !phase1Done || !queueReady) return
    const t = window.setTimeout(() => {
      setP1Combo(0)
      setSegment('p2')
    }, 3000)
    return () => window.clearTimeout(t)
  }, [segment, phase1Done, queueReady])

  /** 콤보 아이템 지급 시 튀어나오는 하이라이트(1·2페이즈 공통) */
  const [rewardPop, setRewardPop] = useState(
    /** @type {{ key: number, cheonryan: number, lives: number } | null} */ (
      null
    ),
  )

  const onItemRewardPop = useCallback((r) => {
    if (r.cheonryan > 0 || r.lives > 0) {
      setRewardPop((prev) => ({
        key: (prev?.key ?? 0) + 1,
        cheonryan: r.cheonryan,
        lives: r.lives,
      }))
    }
  }, [])

  useEffect(() => {
    if (!rewardPop) return
    const id = window.setTimeout(() => setRewardPop(null), 2400)
    return () => window.clearTimeout(id)
  }, [rewardPop])

  const onMatchAttempt = useCallback((ok) => {
    if (ok) {
      setP1Combo((c) => {
        const n = c + 1
        const { cheonryan: ch, lives: lf } = phase1ComboRewards(n)
        if (ch > 0 || lf > 0) {
          queueMicrotask(() =>
            setRewardPop((prev) => ({
              key: (prev?.key ?? 0) + 1,
              cheonryan: ch,
              lives: lf,
            })),
          )
        }
        if (ch) setCheonryan((x) => x + ch)
        if (lf) setLives((l) => Math.min(MAX_LIVES, l + lf))
        return n
      })
    } else {
      setP1Combo(0)
    }
  }, [])

  /* eslint-disable react-hooks/set-state-in-effect -- 큐가 비었는데 이번 레벨에 더 필요할 때만 리필 */
  useEffect(() => {
    if (!queueReady || segment !== 'p1') return
    if (phase1Done) return
    const need = cardsNeededThisLevel - p1Collected.length
    if (need <= 0 || queue.length > 0) return
    setQueue(refillQueueFromPool())
  }, [
    queue.length,
    queueReady,
    segment,
    phase1Done,
    cardsNeededThisLevel,
    p1Collected.length,
    refillQueueFromPool,
  ])
  /* eslint-enable react-hooks/set-state-in-effect */

  const onRoundWin = useCallback(
    ({ lives: L, cheonryan: C }) => {
      setLives(L)
      setCheonryan(C)
      if (level >= maxLevel) {
        setShowLevelClearPopup(false)
        setSegment('cleared')
      } else {
        setShowLevelClearPopup(true)
        queueMicrotask(() => sfxLevelClearFanfare())
      }
      /* 명예의 전당: 백그라운드 저장 */
      void (async () => {
        try {
          const hofName = await resolveDisplayNameForHoF(user)
          await saveHallOfFameIfBetter(packId, level, hofName, {
            uid: user?.uid ?? null,
          })
        } catch {
          /* 저장 실패해도 진행은 유지 */
        }
      })()
    },
    [packId, level, maxLevel, user],
  )

  const continueNextLevel = useCallback(() => {
    setShowLevelClearPopup(false)
    setLevel((l) => l + 1)
    setP1Collected([])
    setRoundVersion((v) => v + 1)
    setP1Combo(0)
    setSegment('p1')
  }, [])

  const onRoundLose = useCallback((detail) => {
    setP2GameOver(detail ?? null)
    setSegment('over')
  }, [])

  if (!packId) {
    return <Navigate to="/" replace />
  }

  if (packsLoading) {
    return (
      <div className="game-shell flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-slate-700">
        <p>카드팩을 불러오는 중…</p>
      </div>
    )
  }

  if (packsError) {
    return (
      <div className="game-shell flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center text-slate-700">
        <p className="text-sm leading-relaxed">{packsError}</p>
        <button
          type="button"
          className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white"
          onClick={() => void reloadPacks()}
        >
          다시 시도
        </button>
        <Link className="text-sky-700 underline" to="/">
          홈으로
        </Link>
      </div>
    )
  }

  if (!pack) {
    return (
      <div className="game-shell flex min-h-dvh flex-col items-center justify-center gap-2 px-4 text-center text-slate-700">
        <p>카드팩을 찾을 수 없습니다.</p>
        <p className="max-w-sm text-xs text-slate-500">
          팩 목록이 바뀌었거나 이전에 저장된 주소가 맞지 않을 수 있어요. 홈에서
          단어팩을 다시 선택해 주세요.
        </p>
        <Link className="mt-2 text-sky-700 underline" to="/">
          홈으로
        </Link>
      </div>
    )
  }

  if (maxLevel < 1) {
    return (
      <div className="game-shell flex min-h-dvh items-center justify-center px-4 text-amber-900">
        <p>이 팩은 유효한 행이 없어 게임을 시작할 수 없습니다.</p>
        <Link className="mt-4 block text-sky-700 underline" to="/">
          홈으로
        </Link>
      </div>
    )
  }

  const displayCombo = segment === 'p1' ? p1Combo : p2Combo

  return (
    <div className="game-shell min-h-dvh px-[max(1rem,env(safe-area-inset-left))] pb-[max(1rem,env(safe-area-inset-bottom))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(0.75rem,env(safe-area-inset-top))] text-slate-800">
      {((segment === 'p1' && comboFxKey > 0 && displayCombo >= 1) ||
        (segment === 'p2' &&
          p2ComboOverlayVisible &&
          comboFxKey > 0 &&
          displayCombo >= 1)) ? (
        <div key={comboFxKey} className="combo-hit-overlay" aria-hidden>
          <div className="combo-hit-burst">
            <span className="combo-hit-num">{displayCombo}</span>
            <span className="combo-hit-label">콤보</span>
          </div>
        </div>
      ) : null}

      {rewardPop ? (
        <div
          key={rewardPop.key}
          className="reward-item-overlay"
          aria-live="polite"
        >
          <div className="reward-item-burst">
            {rewardPop.cheonryan > 0 ? (
              <span
                className="reward-item-chip reward-item-cheonryan"
                title="천리안 획득"
              >
                <svg
                  className="reward-item-icon"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path
                    fill="currentColor"
                    d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"
                  />
                </svg>
                <span className="reward-item-label">천리안</span>
                <span className="reward-item-delta">+{rewardPop.cheonryan}</span>
              </span>
            ) : null}
            {rewardPop.lives > 0 ? (
              <span className="reward-item-chip reward-item-life" title="라이프 회복">
                <span className="reward-item-heart" aria-hidden>
                  ♥
                </span>
                <span className="reward-item-label">라이프</span>
                <span className="reward-item-delta">+{rewardPop.lives}</span>
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mx-auto w-full max-w-lg game-max-w-tablet landscape:max-w-4xl">
        <header className="mb-4 flex items-center justify-between gap-2 md:mb-6">
          <Link
            to="/"
            className="text-xs font-medium text-sky-700 underline decoration-sky-400/70 underline-offset-4 md:text-sm"
          >
            ← 홈
          </Link>
          <div className="text-right text-[10px] text-slate-600 md:text-xs">
            <p className="font-medium text-slate-800">{pack.sheetName}</p>
            <p>
              {Math.min(level, maxLevel)}단계 · {phase2SecondsForLevel(level)}초
            </p>
          </div>
        </header>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-200/80 bg-white/85 px-3 py-2.5 shadow-md shadow-amber-900/5 md:px-4 md:py-3">
          <div className="text-xs md:text-sm">
            <span className="text-slate-600">라이프 </span>
            <span className="text-rose-500">
              {'♥'.repeat(Math.min(MAX_LIVES, lives))}
            </span>
            <span className="text-rose-200">
              {'♡'.repeat(Math.max(0, MAX_LIVES - Math.min(MAX_LIVES, lives)))}
            </span>
          </div>
          <div className="text-xs md:text-sm">
            <span className="text-slate-600">천리안 </span>
            <span className="font-semibold text-amber-600">{cheonryan}</span>
          </div>
          <div className="text-xs md:text-sm">
            <span className="text-slate-600">콤보 </span>
            <span className="font-semibold text-emerald-600">{displayCombo}</span>
          </div>
        </div>

        {segment === 'p1' ? (
          <>
            <h1 className="text-lg font-semibold tracking-tight text-slate-900 md:text-xl">
              단어 맞추기
            </h1>
            <p className="mt-1 text-xs text-slate-600 md:text-sm">
              {p1Collected.length}/{cardsNeededThisLevel}장
            </p>
            {deckNotice ? (
              <p
                role="status"
                className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-center text-xs text-amber-900 md:text-sm"
              >
                {deckNotice}
              </p>
            ) : null}
            {!queueReady ? (
              <p className="mt-8 text-center text-slate-500">덱 준비 중…</p>
            ) : phase1Done ? (
              (() => {
                const last =
                  p1Collected.length > 0
                    ? p1Collected[p1Collected.length - 1]
                    : null
                return (
                  <div
                    className="fixed inset-0 z-[88] flex flex-col items-center justify-center bg-white/92 px-4 backdrop-blur-[2px]"
                    aria-live="polite"
                  >
                    {last ? (
                      <div className="p1-enhance-burst relative flex max-h-[min(72dvh,32rem)] flex-col items-center justify-center px-2">
                        <div className="p1-enhance-rays" aria-hidden />
                        <div className="p1-enhance-card pointer-events-auto max-h-[min(60dvh,26rem)] overflow-y-auto shadow-2xl">
                          <p className="p1-enhance-badge">완성!</p>
                          <p className="p1-enhance-topic">{last.topic}</p>
                          {last.explanation ? (
                            <p className="p1-enhance-exp">{last.explanation}</p>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <p className="text-slate-600">2페이즈로 이동합니다…</p>
                    )}
                    <p className="pointer-events-none mt-8 text-center text-sm font-medium text-slate-600">
                      2페이즈로 이동합니다… (약 3초)
                    </p>
                  </div>
                )
              })()
            ) : (
              <div className="mt-4 md:mt-6">
                <Phase1Matching
                  slots={p1Slots}
                  topicRows={p1TopicRows}
                  packKey={packKey}
                  roundVersion={roundVersion}
                  combo={p1Combo}
                  coachMode={coachMode || tutorialMode}
                  tutorialMode={tutorialMode}
                  onMatchAttempt={onMatchAttempt}
                  onRealMatch={handleP1RealMatch}
                />
              </div>
            )}
          </>
        ) : null}

        {segment === 'p2' ? (
          <div className="relative">
            <h1 className="text-lg font-semibold tracking-tight text-slate-900 md:text-xl">
              {phase2OrderMode === 'sheet'
                ? '2페이즈 · 사건 시간 순 눈치'
                : '2페이즈 · 국어→영어→숫자 순 눈치'}
            </h1>
            <p className="mt-1 text-xs text-slate-600 md:text-sm">
              가상 플레이어 1명 · 제한 {phase2SecondsForLevel(level)}초 (카드{' '}
              {level}장 × 6초)
            </p>
            {phase2OrderMode === 'sheet' ? (
              <p
                role="status"
                className="mt-3 rounded-xl border border-violet-300/90 bg-violet-50 px-3 py-2.5 text-center text-sm font-medium leading-snug text-violet-950 shadow-sm ring-1 ring-violet-200/70"
              >
                사건 시간 순서로 카드를 내세요.
              </p>
            ) : null}
            <div className="mt-4 md:mt-6">
              <Phase2Mind
                key={`${level}-${roundVersion}-p2`}
                level={level}
                playerCards={levelDeck}
                botCount={botCount}
                poolRows={poolRows}
                initialLives={lives}
                initialCheonryan={cheonryan}
                onRoundWin={onRoundWin}
                onRoundLose={onRoundLose}
                onLivesChange={setLives}
                onP2ComboChange={setP2Combo}
                onCheonryanChange={setCheonryan}
                onItemRewardPop={onItemRewardPop}
                overlayTimerPause={!!rewardPop}
                coachMode={coachMode || tutorialMode}
                tutorialMode={tutorialMode}
                hideTimerHud={showLevelClearPopup}
                orderMode={phase2OrderMode}
              />
            </div>
            {showLevelClearPopup ? (
              <div
                className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-[100] w-[min(92vw,20rem)] -translate-x-1/2 rounded-2xl border border-amber-300/90 bg-gradient-to-r from-amber-50 via-white to-sky-50 px-4 py-4 text-center shadow-lg shadow-amber-900/15 ring-2 ring-amber-200/60"
                role="dialog"
                aria-modal="true"
                aria-labelledby="level-clear-title"
              >
                <p
                  id="level-clear-title"
                  className="text-base font-bold text-sky-800 md:text-lg"
                >
                  레벨 {level} 클리어!
                </p>
                <p className="mt-1 text-xs text-slate-600 md:text-sm">
                  2페이즈 판을 더 보셔도 돼요.
                </p>
                <button
                  type="button"
                  className="mt-4 w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-md"
                  onClick={continueNextLevel}
                >
                  다음 레벨로
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {segment === 'cleared' ? (
          <div className="py-12 text-center md:py-16">
            <p className="bg-gradient-to-r from-sky-600 to-violet-600 bg-clip-text text-2xl font-bold text-transparent md:text-3xl">
              전체 클리어!
            </p>
            <p className="mt-3 text-sm text-slate-600">
              레벨 {maxLevel}까지 완주했습니다.
            </p>
            <button
              type="button"
              className="mt-8 rounded-2xl border border-slate-300 bg-white px-6 py-3 text-slate-800 shadow-md"
              onClick={() => navigate('/', { replace: true })}
            >
              처음으로
            </button>
          </div>
        ) : null}

        {segment === 'over' ? (
          <div className="py-8 text-center md:py-12">
            <p className="text-xl font-semibold text-rose-600 md:text-2xl">게임 오버</p>
            <p className="mt-2 text-sm text-slate-600">
              레벨 {level}
              {p2GameOver?.reason === 'time'
                ? ' — 시간이 부족했습니다.'
                : p2GameOver?.reason === 'lives'
                  ? ' — 라이프가 소진되었습니다.'
                  : p2GameOver
                    ? ' — 라이프가 소진되었거나 시간이 부족했습니다.'
                    : '.'}
            </p>

            {p2GameOver?.snapshot ? (
              <div className="mx-auto mt-6 max-w-lg space-y-6 text-left">
                {p2GameOver?.lastPenalty ? (
                  <section className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-3 text-left text-sm text-rose-950">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wide text-rose-700">
                      마지막 생명 변동
                    </h3>
                    <p className="mt-2 text-slate-800">
                      나와야 했던 카드: 「
                      {p2GameOver.lastPenalty.expectedTopic || '—'}」
                    </p>
                    <p className="mt-1 text-slate-800">
                      잘못 낸 카드: 「{p2GameOver.lastPenalty.wrongTopic}」(
                      {p2GameOver.lastPenalty.wrongFromLabel})
                    </p>
                    {p2GameOver.lastPenalty.forcedCards?.length > 0 ? (
                      <p className="mt-2 text-slate-700">
                        먼저 깔린 카드 {p2GameOver.lastPenalty.forcedCards.length}장
                        {p2GameOver.lastPenalty.forcedCards.map((row, i) => (
                          <span key={`${row.topic}-${i}`}>
                            {i === 0 ? ' — ' : ', '}
                            「{row.topic}」({row.fromLabel})
                          </span>
                        ))}
                      </p>
                    ) : null}
                  </section>
                ) : null}

                <section>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    필드에 깔린 순서
                  </h3>
                  <div className="mt-2 max-h-[38dvh] overflow-y-auto rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800 shadow-inner">
                    {p2GameOver.snapshot.center.length === 0 ? (
                      <span className="text-slate-500">—</span>
                    ) : (
                      <ol className="list-inside list-decimal space-y-2 marker:text-violet-400/90">
                        {p2GameOver.snapshot.center.map((c, i) => (
                          <li
                            key={`${c.topic}-${i}-${c.from}-${i}`}
                            className="break-words pl-1"
                          >
                            <span className="font-medium text-violet-800">
                              「{c.topic}」
                            </span>
                            <span className="text-slate-500">
                              {' '}
                              · {fieldActorLabel(c.from)}
                            </span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                </section>

                <section>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {phase2OrderMode === 'sheet'
                      ? '손에 남은 카드 (엑셀·시간 순)'
                      : '손에 남은 카드 (국어→영어→숫자 순)'}
                  </h3>
                  <div className="mt-2 space-y-4 rounded-2xl border border-amber-200/80 bg-white/90 px-3 py-4 shadow-sm">
                    {(
                      [
                        { label: '나', hand: p2GameOver.snapshot.playerHand },
                        { label: '가상 플레이어 A', hand: p2GameOver.snapshot.bot1Hand },
                      ].concat(
                        p2GameOver.snapshot.botCount >= 2
                          ? [
                              {
                                label: '가상 플레이어 B',
                                hand: p2GameOver.snapshot.bot2Hand,
                              },
                            ]
                          : [],
                      )
                    ).map(({ label, hand }) => {
                      const sorted = sortHandForP2Snapshot(hand, phase2OrderMode)
                      return (
                      <div key={label}>
                        <p className="text-[11px] text-slate-500">{label}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {sorted.length === 0 ? (
                            <span className="text-xs text-slate-600">없음</span>
                          ) : (
                            sorted.map((c) => (
                              <span
                                key={c.id}
                                className="inline-block max-w-[min(100%,14rem)] truncate rounded-lg border border-slate-400/40 bg-white px-2 py-1 text-xs text-slate-900"
                              >
                                {c.topic}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                      )
                    })}
                  </div>
                </section>
              </div>
            ) : (
              <p className="mt-4 text-xs text-slate-600">
                2페이즈 정보를 불러오지 못했습니다.
              </p>
            )}

            <button
              type="button"
              className="mt-8 rounded-2xl border border-slate-300 bg-white px-6 py-3 text-slate-800 shadow-md"
              onClick={() => navigate('/', { replace: true })}
            >
              처음으로
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  comparePlayOrder,
  compareTopicOrder,
  isPlayableAfter,
} from '../../utils/koCompare'
import {
  MAX_LIVES,
  phase1ComboRewards,
  phase2SecondsForLevel,
} from '../../utils/gameRules'
import { sfxMerge, sfxPenalty, sfxTick } from '../../utils/gameSfx'
import { buildMechanicalJokboFireTimes } from '../../utils/phase2Utils'
import { createSeededRng } from '../../utils/seededRng'

const DEFAULT_OPPONENT_LABELS = ['A봇', 'B봇', 'C봇']

/** 천리안 버튼·연출용 눈 아이콘 */
export function EyeIcon({ className = 'h-4 w-4' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

/** 천리안 연출용 돋보기 아이콘 */
export function MagnifyGlassIcon({ className = 'h-4 w-4' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </svg>
  )
}

/** 필드(타임라인) 한 장 — 팝업·해설 표시용 */
function centerEntryFromCard(card, from, extra = {}) {
  return {
    topic: String(card.topic ?? ''),
    from,
    rowId: card.id,
    explanation: String(card.explanation ?? '').trim(),
    forced: !!extra.forced,
    wrongTap: !!extra.wrongTap,
  }
}

/** @param {() => number} [rng] 0~1 미만, 없으면 Math.random */
function shuffle(arr, rng) {
  const a = [...arr]
  const rnd = rng ?? (() => Math.random())
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * 플레이어 패와 동일 id 카드는 절대 봇에게 주지 않음.
 * 풀에서 id 문자열로 한 번 더 걸러 내고, 봇1·봇2는 가능하면 서로 겹치지 않게 뽑음(부족 시에만 풀에서 반복).
 * @param {object[]} playerCards
 * @param {object[]} poolRows
 * @param {number} n
 * @param {number} botCount
 */
function dealBotsExclusive(playerCards, poolRows, n, botCount, rng) {
  const playerIds = new Set(playerCards.map((c) => String(c.id)))
  const safe = shuffle(
    poolRows.filter((r) => r && !playerIds.has(String(r.id))),
    rng,
  )
  const used = new Set()
  const take = (need) => {
    const out = []
    for (const row of safe) {
      if (out.length >= need) break
      const id = String(row.id)
      if (used.has(id)) continue
      used.add(id)
      out.push(row)
    }
    let k = 0
    while (out.length < need && safe.length > 0) {
      const row = safe[k % safe.length]
      const id = String(row.id)
      if (!playerIds.has(id)) out.push(row)
      k += 1
      if (k > need * safe.length * 4) break
    }
    return shuffle(out, rng)
  }
  return {
    bot1Hand: n > 0 ? take(n) : [],
    bot2Hand: botCount > 1 && n > 0 ? take(n) : [],
    bot3Hand: botCount > 2 && n > 0 ? take(n) : [],
  }
}

function removeFromHand(hand, card) {
  return hand.filter((c) => c.id !== card.id)
}

/** 모든 손패에서 이번에 낼 수 있는 카드 중 족보상 가장 앞(최소) 1장(소유자 포함) */
function globalMinValidEntry(state, orderMode = 'topic') {
  const last = state.lastPlayed
  const all = [
    ...state.playerHand.map((card) => ({ card, from: 'player' })),
    ...state.bot1Hand.map((card) => ({ card, from: 'bot1' })),
    ...state.bot2Hand.map((card) => ({ card, from: 'bot2' })),
    ...state.bot3Hand.map((card) => ({ card, from: 'bot3' })),
  ]
  const valid =
    last == null
      ? all
      : all.filter((x) => isPlayableAfter(x.card, last, orderMode))
  if (valid.length === 0) return null
  valid.sort((a, b) => {
    const o = comparePlayOrder(a.card, b.card, orderMode)
    if (o !== 0) return o
    return String(a.card.id).localeCompare(String(b.card.id))
  })
  return valid[0]
}

function globalMinValidCard(state, orderMode = 'topic') {
  return globalMinValidEntry(state, orderMode)?.card ?? null
}

/**
 * 잘못 낸 카드보다 족보상 앞인데 아직 깔리지 않은 카드 — 모든 손에서 강제 제출
 */
function collectForcedBeforeWrong(state, lastPlayed, wrongCard, orderMode = 'topic') {
  const parts = [
    ...state.playerHand.map((card) => ({ from: 'player', card })),
    ...state.bot1Hand.map((card) => ({ from: 'bot1', card })),
    ...state.bot2Hand.map((card) => ({ from: 'bot2', card })),
    ...state.bot3Hand.map((card) => ({ from: 'bot3', card })),
  ]
  if (orderMode === 'sheet') {
    const w = Number(wrongCard.id)
    return parts.filter(({ card }) => {
      const cid = Number(card.id)
      if (lastPlayed == null) return cid < w
      const L = Number(lastPlayed.id)
      return cid > L && cid < w
    })
  }
  const wrongTopic = wrongCard.topic
  const lastTopic = lastPlayed?.topic ?? null
  return parts.filter(({ card }) => {
    if (lastTopic == null) {
      return compareTopicOrder(card.topic, wrongTopic) < 0
    }
    return (
      compareTopicOrder(card.topic, lastTopic) > 0 &&
      compareTopicOrder(card.topic, wrongTopic) < 0
    )
  })
}

function actorLabelFrom(from, seatLabels) {
  if (from === 'player') return '나'
  const labels = seatLabels ?? DEFAULT_OPPONENT_LABELS
  if (from === 'bot1') return labels[0] ?? DEFAULT_OPPONENT_LABELS[0]
  if (from === 'bot2') return labels[1] ?? DEFAULT_OPPONENT_LABELS[1]
  return labels[2] ?? DEFAULT_OPPONENT_LABELS[2]
}

/** 타임라인 칩 색 — 나 / 봇 / 강제 / 오제출 구분 */
function fieldChipClass(entry) {
  if (entry.wrongTap) {
    return 'border-rose-400 bg-rose-100 text-rose-950 ring-2 ring-amber-400/80'
  }
  if (entry.forced) {
    return 'border-amber-400 bg-amber-50 text-amber-950 line-through decoration-amber-700/70'
  }
  if (entry.from === 'player') {
    return 'border-sky-500 bg-sky-50 text-sky-950 shadow-sm'
  }
  if (entry.from === 'bot1') {
    return 'border-slate-400 bg-slate-100 text-slate-900'
  }
  if (entry.from === 'bot2') {
    return 'border-violet-400 bg-violet-50 text-violet-950'
  }
  return 'border-fuchsia-400 bg-fuchsia-50 text-fuchsia-950'
}

function applyWrongSubmission(
  state,
  playedCard,
  playedFrom,
  orderMode = 'topic',
  seatLabels,
) {
  const expectedCard = globalMinValidCard(state, orderMode)
  const expectedTopic = expectedCard?.topic ?? ''

  const last = state.lastPlayed
  const w = playedCard.topic

  let forced = collectForcedBeforeWrong(state, last, playedCard, orderMode).filter(
    (x) => x.card.id !== playedCard.id,
  )
  forced.sort((a, b) => {
    const o = comparePlayOrder(a.card, b.card, orderMode)
    if (o !== 0) return o
    return String(a.card.id).localeCompare(String(b.card.id))
  })

  let playerHand = [...state.playerHand]
  let bot1Hand = [...state.bot1Hand]
  let bot2Hand = [...state.bot2Hand]
  let bot3Hand = [...state.bot3Hand]
  let center = [...state.center]

  for (const { from, card: c } of forced) {
    center = [...center, centerEntryFromCard(c, from, { forced: true })]
    if (from === 'player') playerHand = removeFromHand(playerHand, c)
    else if (from === 'bot1') bot1Hand = removeFromHand(bot1Hand, c)
    else if (from === 'bot2') bot2Hand = removeFromHand(bot2Hand, c)
    else bot3Hand = removeFromHand(bot3Hand, c)
  }

  const pen = forced.length

  center = [...center, centerEntryFromCard(playedCard, playedFrom, { forced: true, wrongTap: true })]
  if (playedFrom === 'player') playerHand = removeFromHand(playerHand, playedCard)
  else if (playedFrom === 'bot1') bot1Hand = removeFromHand(bot1Hand, playedCard)
  else if (playedFrom === 'bot2') bot2Hand = removeFromHand(bot2Hand, playedCard)
  else bot3Hand = removeFromHand(bot3Hand, playedCard)

  return {
    ...state,
    center,
    lastPlayed: { id: playedCard.id, topic: w },
    playerHand,
    bot1Hand,
    bot2Hand,
    bot3Hand,
    lives: Math.max(0, state.lives - pen),
    p2Combo: playedFrom === 'player' ? 0 : (state.p2Combo ?? 0),
    hintMode: false,
    revealed: new Set(),
    penaltyToast: null,
    lifePenaltyModal: {
      wrongTopic: w,
      wrongFrom: playedFrom,
      expectedTopic,
      forcedCards: forced.map(({ from: fr, card: c }) => ({
        topic: c.topic,
        from: fr,
        fromLabel: actorLabelFrom(fr, seatLabels),
      })),
      wrongFromLabel: actorLabelFrom(playedFrom, seatLabels),
      livesLost: pen,
    },
    shakeKey: (state.shakeKey ?? 0) + 1,
  }
}

/**
 * 기계 제출 타이밍만 담습니다. 앞·뒤 2초 제외 구간을 제출 횟수로 n등분한 시각(fireAt)입니다.
 * 각 시각에는 족보상 다음 한 장(globalMin)을 즉시 제출합니다(스케줄 카드 id에 묶이지 않음).
 */
function buildMechanicalAllPlaysSchedule(
  playerHand,
  bot1Hand,
  bot2Hand,
  bot3Hand,
  botCount,
  durationMs,
) {
  const total =
    playerHand.length +
    bot1Hand.length +
    (botCount > 1 ? bot2Hand.length : 0) +
    (botCount > 2 ? bot3Hand.length : 0)
  const times = buildMechanicalJokboFireTimes(total, durationMs)
  return times.map((fireAt) => ({ fireAt }))
}

function buildRoundState({
  playerCards,
  poolRows,
  botCount,
  durationMs,
  initialLives,
  initialCheonryan,
  orderMode = 'topic',
  /** 멀티 방: 모든 기기에서 동일 패가 되도록 시드(없으면 매번 다른 패) */
  shuffleSeed,
}) {
  const rng =
    shuffleSeed != null && shuffleSeed !== ''
      ? createSeededRng(Number(shuffleSeed))
      : null
  /** 손패는 족보와 무관하게 무작위 배치(전근대사 등에서 앞/뒤 id가 한쪽으로 몰리지 않게) */
  const playerHand = shuffle([...playerCards], rng)
  const n = playerCards.length
  const { bot1Hand, bot2Hand, bot3Hand } = dealBotsExclusive(
    playerCards,
    poolRows,
    n,
    botCount,
    rng,
  )
  const schedule = buildMechanicalAllPlaysSchedule(
    playerHand,
    bot1Hand,
    bot2Hand,
    bot3Hand,
    botCount,
    durationMs,
  )
  return {
    lives: initialLives,
    cheonryan: initialCheonryan,
    lastPlayed: null,
    center: [],
    playerHand,
    bot1Hand,
    bot2Hand,
    bot3Hand,
    schedule,
    elapsedMs: 0,
    durationMs,
    p2Combo: 0,
    hintMode: false,
    revealed: new Set(),
    penaltyToast: /** @type {string | null} */ (null),
    lifePenaltyModal: null,
    shakeKey: 0,
    mergeFlash: 0,
  }
}

/**
 * 전역 최소 주제어만 정답. 오답 시 그보다 앞 순서 카드는 모든 손에서 강제 제출,
 * 생명은 강제로 깔린 장수만큼만 차감(잘못 낸 한 장은 생명에 포함하지 않음).
 */
function applyPlayerPlayWithRules(state, card, orderMode = 'topic', seatLabels) {
  const hand = state.playerHand
  if (!hand.some((c) => c.id === card.id)) {
    return { ...state, penaltyToast: '손에 없는 카드예요.', lifePenaltyModal: null }
  }

  const globalMin = globalMinValidCard(state, orderMode)
  if (!globalMin) {
    return {
      ...state,
      penaltyToast: '낼 수 있는 카드가 없어요.',
      lifePenaltyModal: null,
    }
  }

  if (globalMin.id === card.id) {
    const newCombo = (state.p2Combo ?? 0) + 1
    const { cheonryan: chAdd, lives: lfAdd } = phase1ComboRewards(newCombo)
    const t = card.topic
    return {
      ...state,
      lastPlayed: { id: card.id, topic: t },
      center: [...state.center, centerEntryFromCard(card, 'player')],
      playerHand: removeFromHand(state.playerHand, card),
      hintMode: false,
      revealed: new Set(),
      penaltyToast: null,
      lifePenaltyModal: null,
      mergeFlash: state.mergeFlash + 1,
      p2Combo: newCombo,
      cheonryan: state.cheonryan + chAdd,
      lives: Math.min(MAX_LIVES, state.lives + lfAdd),
    }
  }

  return applyWrongSubmission(state, card, 'player', orderMode, seatLabels)
}

/**
 * 2페이즈: 타이머(천리안 중 정지)·족보·강제 제출 안내
 */
const Phase2Mind = forwardRef(function Phase2Mind(
  {
    level,
    playerCards,
    botCount,
    poolRows,
    initialLives,
    initialCheonryan,
    onRoundWin,
    onRoundLose,
    onLivesChange,
    onP2ComboChange,
    onCheonryanChange,
    onItemRewardPop,
    /** 부모(보상 팝업 등) 오버레이 중 타이머 정지 */
    overlayTimerPause = false,
    coachMode = false,
    /** 튜토리얼 단어팩: 내야 할 카드 강조·천리안 안내 */
    tutorialMode = false,
    /** 라운드 진입 직후 카운트다운(초). 0이면 바로 플레이. 같은 화면에서 팝업으로만 표시 */
    prepSeconds = 5,
    /** 레벨 클리어 팝업 중에는 우측 상단 타이머·카운트다운 배지 숨김 */
    hideTimerHud = false,
    /** 전근대사 100선 등: 엑셀 행 순서(id)로 족보 결정 */
    orderMode = 'topic',
    /** 상단 바에 천리안 버튼을 두고 고정 HUD에서는 숨김(타이머만 우측 상단) */
    hideFixedCheonryanButton = false,
    /** 천리안 모드 여부 — 상단 버튼 비활성·취소 표시용 */
    onHintModeChange,
    /** 상대 1·2·3번 자리 표시 이름(맞은편·왼쪽·오른쪽). 없으면 A/B/C봇 */
    opponentSeatLabels,
    /** true면 족보·타이밍에 맞춰 자동 제출(탭 비활성) */
    mechanicalAutoPlay = true,
    /** 멀티 방: 방에서 공유한 시드 — 있으면 모든 기기에서 같은 2페이즈 덱 */
    shuffleSeed,
  },
  ref,
) {
  const seatLabelsResolved = useMemo(
    () => opponentSeatLabels ?? DEFAULT_OPPONENT_LABELS,
    [opponentSeatLabels],
  )
  const seatLabelsRef = useRef(seatLabelsResolved)
  useEffect(() => {
    seatLabelsRef.current = seatLabelsResolved
  }, [seatLabelsResolved])

  const durationMs = phase2SecondsForLevel(level) * 1000
  const [prepLeft, setPrepLeft] = useState(() => prepSeconds)
  const prepFreezeRef = useRef(false)
  useEffect(() => {
    prepFreezeRef.current = prepLeft > 0
  }, [prepLeft])

  /** 천리안으로 상대 카드 확인 후 타이머 재개 전 3초 대기 */
  const [postHintResumeLeft, setPostHintResumeLeft] = useState(0)
  const postHintFreezeRef = useRef(false)

  useEffect(() => {
    postHintFreezeRef.current = postHintResumeLeft > 0
  }, [postHintResumeLeft])

  useEffect(() => {
    if (postHintResumeLeft <= 0) return
    sfxTick()
    const id = window.setTimeout(
      () => setPostHintResumeLeft((n) => Math.max(0, n - 1)),
      1000,
    )
    return () => window.clearTimeout(id)
  }, [postHintResumeLeft])

  useEffect(() => {
    if (prepLeft <= 0) return
    sfxTick()
    const id = window.setTimeout(() => setPrepLeft((n) => n - 1), 1000)
    return () => window.clearTimeout(id)
  }, [prepLeft])

  const tutorialBaseHint = useMemo(() => {
    if (!tutorialMode) return ''
    return '눈 아이콘 천리안으로 상대 패를 잠깐 확인할 수 있어요.'
  }, [tutorialMode])

  /** 천리안 탭/취소 후 안내(기본 문구 위에 덮어씀) */
  const [tutorialPhaseHint, setTutorialPhaseHint] = useState('')

  const tutorialBannerText = tutorialPhaseHint || tutorialBaseHint

  const [state, setState] = useState(() =>
    buildRoundState({
      playerCards,
      poolRows,
      botCount,
      durationMs,
      initialLives,
      initialCheonryan,
      orderMode,
      shuffleSeed,
    }),
  )

  /** 플레이어가 낸 카드(1페이즈 완성 카드) 미리보기 */
  const [playCardPop, setPlayCardPop] = useState(
    /** @type {{ topic: string, explanation: string, perfect: boolean } | null} */ (
      null
    ),
  )

  /** 필드 타임라인 카드 탭 시 상세(주제어·해설) */
  const [fieldInspect, setFieldInspect] = useState(
    /** @type {null | { topic: string, explanation: string, fromLabel: string, badges: string[] }} */ (
      null
    ),
  )

  const openFieldInspect = useCallback(
    (entry) => {
      const badges = []
      if (entry.forced) badges.push('강제 제출')
      if (entry.wrongTap) badges.push('잘못 낸 카드')
      setFieldInspect({
        topic: entry.topic,
        explanation: entry.explanation ?? '',
        fromLabel: actorLabelFrom(entry.from, seatLabelsResolved),
        badges,
      })
    },
    [seatLabelsResolved],
  )

  const endedRef = useRef(false)
  const nextScheduleIdxRef = useRef(0)
  const overlayPauseRef = useRef(false)
  const onItemRewardPopRef = useRef(onItemRewardPop)
  /** 천리안으로 잠깐 공개한 뒤 다시 가리기 위한 타이머 */
  const peekClearRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null))
  /** 5초 이하 긴급 구간에서 초 단위 틱 사운드(중복 재생 방지) */
  const urgentTickRef = useRef(/** @type {number | null} */ (null))

  useEffect(() => {
    overlayPauseRef.current = overlayTimerPause
  }, [overlayTimerPause])

  useEffect(() => {
    onItemRewardPopRef.current = onItemRewardPop
  }, [onItemRewardPop])

  useEffect(() => {
    return () => {
      if (peekClearRef.current) {
        clearTimeout(peekClearRef.current)
        peekClearRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!state.penaltyToast) return
    const id = window.setTimeout(() => {
      setState((s) => ({ ...s, penaltyToast: null }))
    }, 7000)
    return () => window.clearTimeout(id)
  }, [state.penaltyToast])

  useEffect(() => {
    if (!fieldInspect) return
    const onKey = (e) => {
      if (e.key === 'Escape') setFieldInspect(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fieldInspect])

  /** 생명 깎임 설명 모달이 떠 있는 동안 라운드 클리어를 미룸(겹침 방지) */
  const pendingRoundWinRef = useRef(/** @type {null | { lives: number, cheonryan: number, center: unknown[] }} */ (null))

  const dismissLifePenaltyModal = useCallback(() => {
    const pending = pendingRoundWinRef.current
    setState((s) => ({ ...s, lifePenaltyModal: null }))
    if (pending) {
      pendingRoundWinRef.current = null
      queueMicrotask(() => onRoundWin(pending))
    }
  }, [onRoundWin])

  /** 게임 오버 시 부모에 넘길 2페이즈 스냅샷 */
  const makeLosePayload = useCallback(
    (next, reason) => ({
      reason,
      snapshot: {
        center: next.center,
        playerHand: next.playerHand,
        bot1Hand: next.bot1Hand,
        bot2Hand: next.bot2Hand,
        bot3Hand: next.bot3Hand,
        botCount,
      },
      /** 라이프 소진 직전 패널티(모달을 띄우기 전에 화면이 바뀌는 경우 대비) */
      lastPenalty: next.lifePenaltyModal ?? null,
    }),
    [botCount],
  )

  useEffect(() => {
    onLivesChange?.(state.lives)
  }, [state.lives, onLivesChange])

  useEffect(() => {
    onP2ComboChange?.(state.p2Combo ?? 0)
  }, [state.p2Combo, onP2ComboChange])

  useEffect(() => {
    onCheonryanChange?.(state.cheonryan)
  }, [state.cheonryan, onCheonryanChange])

  useEffect(() => {
    const id = window.setInterval(() => {
      if (endedRef.current) return
      setState((s) => {
        /* 2페이즈 시작 전 카운트다운·천리안·패널티·토스트·부모 오버레이 중에는 진행 안 함 */
        if (
          prepFreezeRef.current ||
          postHintFreezeRef.current ||
          s.hintMode ||
          s.lifePenaltyModal ||
          s.penaltyToast ||
          overlayPauseRef.current
        ) {
          return s
        }
        let next = { ...s, elapsedMs: s.elapsedMs + 25 }
        const sched = s.schedule

        while (
          nextScheduleIdxRef.current < sched.length &&
          sched[nextScheduleIdxRef.current].fireAt <= next.elapsedMs
        ) {
          /* 시각마다 족보상 다음 한 장만 제출 — 스케줄 카드 id와 어긋나 멈추지 않게 함 */
          const minEntry = globalMinValidEntry(next, orderMode)
          if (!minEntry) {
            nextScheduleIdxRef.current += 1
            continue
          }
          const { card, from } = minEntry
          const comboBefore = next.p2Combo ?? 0
          if (from === 'player') {
            queueMicrotask(() => {
              setPlayCardPop({
                topic: card.topic,
                explanation: card.explanation ?? '',
                perfect: true,
              })
              window.setTimeout(() => setPlayCardPop(null), 520)
            })
            sfxMerge()
            next = applyPlayerPlayWithRules(
              next,
              card,
              orderMode,
              seatLabelsRef.current,
            )
          } else {
            sfxMerge()
            next = applyBotSuccessPlay(next, from, card)
          }
          const comboAfter = next.p2Combo ?? 0
          if (comboAfter > comboBefore) {
            const r = phase1ComboRewards(comboAfter)
            if (r.cheonryan > 0 || r.lives > 0) {
              queueMicrotask(() => onItemRewardPopRef.current?.(r))
            }
          }
          nextScheduleIdxRef.current += 1
          /* 연속 처리 시 모달 한 번에 하나만 */
          if (next.lifePenaltyModal) break
        }

        const total =
          next.playerHand.length +
          next.bot1Hand.length +
          next.bot2Hand.length +
          next.bot3Hand.length
        if (
          total === 0 &&
          next.center.length > 0 &&
          next.lives > 0
        ) {
          endedRef.current = true
          const payload = {
            lives: next.lives,
            cheonryan: next.cheonryan,
            center: next.center,
          }
          if (next.lifePenaltyModal) {
            pendingRoundWinRef.current = payload
          } else {
            queueMicrotask(() => onRoundWin(payload))
          }
        } else if (next.lives <= 0) {
          endedRef.current = true
          const payload = makeLosePayload(next, 'lives')
          queueMicrotask(() => onRoundLose(payload))
        } else if (next.elapsedMs >= next.durationMs && total > 0) {
          endedRef.current = true
          const penalty = total
          const newLives = Math.max(0, next.lives - penalty)
          if (newLives <= 0) {
            const payload = makeLosePayload({ ...next, lives: 0 }, 'time')
            queueMicrotask(() => onRoundLose(payload))
          } else {
            const payload = {
              lives: newLives,
              cheonryan: next.cheonryan,
              center: next.center,
              timeUpPenaltyCards: penalty,
            }
            if (next.lifePenaltyModal) {
              pendingRoundWinRef.current = payload
            } else {
              queueMicrotask(() => onRoundWin(payload))
            }
          }
        }

        return next
      })
    }, 25)
    return () => window.clearInterval(id)
  }, [level, onRoundWin, onRoundLose, makeLosePayload, orderMode])

  const playPlayer = useCallback(
    (card) => {
      if (mechanicalAutoPlay) return
      if (prepFreezeRef.current) return
      if (endedRef.current) return
      setState((s) => {
        const expected = globalMinValidCard(s, orderMode)
        const perfect =
          expected != null && String(expected.id) === String(card.id)
        queueMicrotask(() => {
          setPlayCardPop({
            topic: card.topic,
            explanation: card.explanation ?? '',
            perfect,
          })
          window.setTimeout(() => setPlayCardPop(null), 520)
        })
        const prevP2 = s.p2Combo ?? 0
        const next = applyPlayerPlayWithRules(
          s,
          card,
          orderMode,
          seatLabelsRef.current,
        )
        if (!next.lifePenaltyModal && !next.penaltyToast) {
          const n = next.p2Combo ?? 0
          if (n > prevP2) {
            const r = phase1ComboRewards(n)
            if (r.cheonryan > 0 || r.lives > 0) {
              queueMicrotask(() => onItemRewardPop?.(r))
            }
          }
        }
        if (next.lifePenaltyModal || next.penaltyToast) sfxPenalty()
        else sfxMerge()
        if (endedRef.current) return next
        const total =
          next.playerHand.length +
          next.bot1Hand.length +
          next.bot2Hand.length +
          next.bot3Hand.length
        if (next.lives <= 0) {
          endedRef.current = true
          queueMicrotask(() => onRoundLose(makeLosePayload(next, 'lives')))
        } else if (
          total === 0 &&
          next.center.length > 0 &&
          next.lives > 0
        ) {
          endedRef.current = true
          const payload = {
            lives: next.lives,
            cheonryan: next.cheonryan,
            center: next.center,
          }
          if (next.lifePenaltyModal) {
            pendingRoundWinRef.current = payload
          } else {
            queueMicrotask(() => onRoundWin(payload))
          }
        }
        return next
      })
    },
    [
      mechanicalAutoPlay,
      onRoundWin,
      onRoundLose,
      makeLosePayload,
      onItemRewardPop,
      orderMode,
    ],
  )

  const startCheonryan = useCallback(() => {
    if (endedRef.current) return
    if (peekClearRef.current) {
      clearTimeout(peekClearRef.current)
      peekClearRef.current = null
    }
    setState((s) => {
      if (s.cheonryan <= 0 || s.hintMode) return s
      return {
        ...s,
        cheonryan: s.cheonryan - 1,
        hintMode: true,
        revealed: new Set(),
      }
    })
    if (tutorialMode) {
      setTutorialPhaseHint(
        '상대 카드 한 장을 탭해 보세요. 뒤집은 뒤 3초 카운트다운 후 타이머가 다시 흘러요.',
      )
    }
  }, [tutorialMode])

  const reveal = useCallback((botKey, cardId) => {
    setState((s) => {
      if (!s.hintMode) return s
      const key = `${botKey}-${cardId}`
      /* 상대 카드 한 장만 확인하면 천리안 모드 종료(타이머 재개), 잠시 후 카드는 다시 가림 */
      return {
        ...s,
        revealed: new Set([key]),
        hintMode: false,
      }
    })
    if (peekClearRef.current) {
      clearTimeout(peekClearRef.current)
      peekClearRef.current = null
    }
    peekClearRef.current = window.setTimeout(() => {
      peekClearRef.current = null
      setState((s) => ({ ...s, revealed: new Set() }))
    }, 1100)
    setPostHintResumeLeft(3)
  }, [])

  const endHintMode = useCallback(() => {
    if (peekClearRef.current) {
      clearTimeout(peekClearRef.current)
      peekClearRef.current = null
    }
    setState((s) => ({ ...s, hintMode: false, revealed: new Set() }))
    if (tutorialMode) {
      setTutorialPhaseHint(
        '취소해도 이미 사용한 천리안은 돌아오지 않아요. (천리안 버튼을 눌렀을 때 1회 소모)',
      )
    }
  }, [tutorialMode])

  useImperativeHandle(
    ref,
    () => ({
      startCheonryan,
      endHintMode,
    }),
    [startCheonryan, endHintMode],
  )

  useEffect(() => {
    onHintModeChange?.(state.hintMode)
  }, [state.hintMode, onHintModeChange])

  const secLeft = Math.max(0, (durationMs - state.elapsedMs) / 1000)
  const lastFieldEntry =
    state.center.length > 0 ? state.center[state.center.length - 1] : null
  const timerPaused =
    prepLeft > 0 ||
    postHintResumeLeft > 0 ||
    state.hintMode ||
    state.lifePenaltyModal ||
    !!state.penaltyToast ||
    overlayTimerPause

  const timerPauseHint = (() => {
    if (prepLeft > 0) return ' · 시작 대기'
    if (postHintResumeLeft > 0) return ' · 재개 대기'
    if (state.lifePenaltyModal && !state.hintMode) return ' · 설명 확인 중'
    if (state.hintMode) return ' · 천리안'
    if (state.penaltyToast) return ' · 안내 확인 중'
    if (overlayTimerPause) return ' · 보상 확인 중'
    return ''
  })()
  /** 초보·튜토리얼: 전체 중 이번에 낼 수 있는 가장 앞 순서 카드 */
  const coachTargetId =
    !mechanicalAutoPlay &&
    (tutorialMode || coachMode) &&
    state.playerHand.length > 0
      ? (() => {
          const e = globalMinValidEntry(state, orderMode)
          return e?.from === 'player' ? e.card.id : null
        })()
      : null

  const tutorialGuideCard =
    tutorialMode && coachTargetId
      ? state.playerHand.find((c) => String(c.id) === String(coachTargetId))
      : null

  const urgentSec =
    !timerPaused && secLeft > 0 && secLeft <= 5 ? Math.ceil(secLeft) : null

  const gaugePct = Math.max(
    0,
    Math.min(100, (100 * (durationMs - state.elapsedMs)) / durationMs),
  )

  useEffect(() => {
    if (timerPaused || secLeft <= 0 || secLeft > 5) {
      urgentTickRef.current = null
      return
    }
    const n = Math.ceil(secLeft)
    if (urgentTickRef.current !== n) {
      urgentTickRef.current = n
      sfxTick()
    }
  }, [secLeft, timerPaused])

  return (
    <div
      className={`relative flex flex-col gap-3 text-stone-100 md:gap-4 ${
        timerPaused ? 'cheonryan-ring' : ''
      }`}
    >
      {playCardPop ? (
        <div
          className="pointer-events-none fixed bottom-[max(6rem,env(safe-area-inset-bottom))] left-1/2 z-[88] w-[min(92vw,18rem)] -translate-x-1/2"
          aria-live="polite"
          role="status"
        >
          <div
            className={`p2-card-play-pop rounded-2xl border-2 px-4 py-3 text-center shadow-2xl ${
              playCardPop.perfect
                ? 'border-amber-400 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 p2-card-play-pop-perfect'
                : 'border-slate-300 bg-white/95'
            }`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {playCardPop.perfect ? '순서 적중!' : '제출'}
            </p>
            <p className="mt-1 text-lg font-black text-slate-900">
              {playCardPop.topic}
            </p>
            {playCardPop.explanation ? (
              <p className="mt-1 line-clamp-3 text-xs leading-snug text-slate-600">
                {playCardPop.explanation}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
      {/* 우측 상단: 타이머·준비/재개 카운트다운 — 전체 화면 딤 없이 판이 보이게 */}
      {!hideTimerHud ? (
        <div
          className="pointer-events-none fixed top-[max(0.35rem,env(safe-area-inset-top))] right-[max(0.35rem,env(safe-area-inset-right))] z-[85] flex flex-col items-end gap-0.5"
          aria-live="polite"
        >
          {prepLeft > 0 ? (
            <div
              className="rounded-xl border border-sky-400/90 bg-white/95 px-2.5 py-1.5 text-right shadow-lg ring-1 ring-sky-200/80"
              role="status"
              aria-labelledby="p2-prep-title"
            >
              <p
                id="p2-prep-title"
                className="text-[9px] font-semibold leading-tight text-sky-900"
              >
                시작까지
              </p>
              <p className="text-3xl font-black tabular-nums leading-none text-sky-600 md:text-4xl">
                {prepLeft}
              </p>
              <p className="mt-0.5 max-w-[9rem] text-[9px] leading-snug text-sky-800/90">
                판을 살펴보세요
              </p>
            </div>
          ) : postHintResumeLeft > 0 ? (
            <div
              className="rounded-xl border border-amber-400/90 bg-white/95 px-2.5 py-1.5 text-right shadow-lg ring-1 ring-amber-200/80"
              role="status"
              aria-labelledby="p2-hint-resume-title"
            >
              <p
                id="p2-hint-resume-title"
                className="text-[9px] font-semibold text-amber-950"
              >
                재개까지
              </p>
              <p className="text-3xl font-black tabular-nums leading-none text-amber-600 md:text-4xl">
                {postHintResumeLeft}
              </p>
            </div>
          ) : (
            <>
              <div
                className={`pointer-events-none rounded-xl border px-2.5 py-1.5 text-right shadow-md ${
                  urgentSec != null
                    ? 'border-rose-400 bg-rose-50/95 ring-2 ring-rose-400/70 animate-pulse'
                    : 'border-slate-200/90 bg-white/92 ring-1 ring-slate-200/70'
                }`}
              >
                <p className="text-[9px] font-medium text-slate-500">남은 시간</p>
                <p className="font-mono text-lg font-bold tabular-nums leading-tight text-sky-800 md:text-xl">
                  {timerPaused ? (
                    <span className="text-amber-800">{secLeft.toFixed(1)}초</span>
                  ) : (
                    <>
                      {secLeft.toFixed(1)}
                      <span className="text-[10px] font-normal text-slate-500">
                        초
                      </span>
                    </>
                  )}
                </p>
                {timerPaused ? (
                  <p className="mt-0.5 max-w-[10rem] text-right text-[9px] leading-tight text-amber-800">
                    {timerPauseHint.trim()}
                  </p>
                ) : null}
                {urgentSec != null && !timerPaused ? (
                  <p className="mt-0.5 text-center text-[10px] font-black text-rose-600">
                    {urgentSec}
                  </p>
                ) : null}
              </div>
              <div className="pointer-events-none h-1 w-[6.75rem] overflow-hidden rounded-full bg-slate-200/95 ring-1 ring-slate-300/50">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-sky-500 to-violet-500 transition-[width] duration-100 ease-linear"
                  style={{ width: `${gaugePct}%` }}
                />
              </div>
              {!hideFixedCheonryanButton ? (
                <div className="pointer-events-auto flex max-w-[min(92vw,14rem)] flex-nowrap items-center justify-end gap-1.5">
                  <button
                    type="button"
                    disabled={state.cheonryan <= 0 || state.hintMode}
                    onClick={startCheonryan}
                    className="flex min-w-0 shrink items-center justify-center gap-1 rounded-full border border-amber-400/90 bg-gradient-to-b from-amber-100 to-amber-200/95 py-1 pl-2 pr-2.5 text-[11px] font-bold text-amber-950 shadow-md ring-1 ring-amber-500/25 disabled:opacity-40"
                  >
                    <EyeIcon className="h-3.5 w-3.5 shrink-0 text-amber-900" />
                    <span>천리안</span>
                    <span className="tabular-nums text-amber-800">{state.cheonryan}</span>
                  </button>
                  {state.hintMode ? (
                    <button
                      type="button"
                      onClick={endHintMode}
                      className="shrink-0 text-[10px] font-medium text-amber-900 underline underline-offset-2"
                    >
                      취소
                    </button>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}
      {state.hintMode ? (
        <div
          className="pointer-events-none fixed inset-0 z-40 bg-amber-400/10 cheonryan-vignette"
          aria-hidden
        />
      ) : null}
      {state.hintMode ? (
        <div
          className="pointer-events-none fixed inset-0 z-[43] flex items-start justify-center px-3 pt-[max(4.5rem,env(safe-area-inset-top))] sm:pt-[max(5rem,env(safe-area-inset-top))]"
          role="status"
          aria-live="polite"
        >
          <div className="flex max-w-[min(92vw,20rem)] items-center gap-3 rounded-2xl border border-amber-400/90 bg-gradient-to-br from-amber-50 via-white to-amber-100/95 px-3 py-2.5 shadow-lg shadow-amber-900/20 ring-2 ring-amber-300/50">
            <div className="relative shrink-0">
              <MagnifyGlassIcon className="h-9 w-9 text-amber-800/90" />
              <EyeIcon className="absolute -bottom-0.5 -right-1 h-5 w-5 text-amber-950 drop-shadow" />
            </div>
            <p className="text-left text-[12px] font-semibold leading-snug text-amber-950 sm:text-sm">
              시간이 멈춘 사이,
              <br />
              상대 패를 꿰뚫어 봅니다
            </p>
          </div>
        </div>
      ) : null}
      {state.lifePenaltyModal && !state.hintMode ? (
        <div
          className="pointer-events-none fixed inset-0 z-[35] bg-rose-400/5 cheonryan-vignette"
          aria-hidden
        />
      ) : null}

      {state.penaltyToast ? (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-relaxed text-rose-900 shadow-md"
        >
          {state.penaltyToast}
        </div>
      ) : null}

      {tutorialBannerText ? (
        <div
          role="status"
          className="rounded-2xl border border-sky-300 bg-sky-50 px-4 py-3 text-sm leading-relaxed text-sky-950 shadow-md"
        >
          {tutorialBannerText}
        </div>
      ) : null}

      {tutorialMode && tutorialGuideCard ? (
        <div
          className="pointer-events-none fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-[45] max-w-md -translate-x-1/2 rounded-2xl border-2 border-amber-400 bg-amber-50/95 px-4 py-3 text-center shadow-lg shadow-amber-900/20 ring-4 ring-amber-300/60"
          role="status"
        >
          <p className="text-xs font-semibold text-amber-900">지금 낼 카드</p>
          <p className="mt-1 text-base font-bold text-slate-900">
            {tutorialGuideCard.topic}
          </p>
          {tutorialGuideCard.explanation ? (
            <p className="mt-1 text-xs leading-relaxed text-amber-950/90">
              {tutorialGuideCard.explanation}
            </p>
          ) : null}
        </div>
      ) : null}

      {state.lifePenaltyModal ? (
        <div
          className="fixed inset-0 z-[78] flex items-end justify-center bg-black/55 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="life-penalty-title"
        >
          <div className="max-h-[min(78dvh,32rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-rose-200 bg-white p-5 shadow-2xl">
            <h2
              id="life-penalty-title"
              className="text-base font-bold text-rose-800"
            >
              {state.lifePenaltyModal.livesLost > 0
                ? `생명 ${state.lifePenaltyModal.livesLost}칸이 깎였어요`
                : '순서가 맞지 않았어요'}
            </h2>
            <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-800">
              <p>
                <span className="text-slate-500">
                  {orderMode === 'sheet'
                    ? '이번에 나와야 했던 카드(엑셀·시간 순서상 가장 앞)'
                    : '이번에 나와야 했던 카드(전체 중 가장 앞 순서)'}
                </span>
                <br />
                <span className="font-semibold text-sky-700">
                  「{state.lifePenaltyModal.expectedTopic || '—'}」
                </span>
              </p>
              <p>
                <span className="text-slate-500">잘못 낸 카드</span>
                <br />
                <span className="font-semibold text-amber-800">
                  「{state.lifePenaltyModal.wrongTopic}」
                </span>
                <span className="text-slate-500">
                  {' '}
                  ({state.lifePenaltyModal.wrongFromLabel})
                </span>
              </p>
              {state.lifePenaltyModal.forcedCards.length > 0 ? (
                <div>
                  <p className="text-slate-600">
                    그보다 앞 순서라서 먼저 깔린 카드(모든 손에서)
                  </p>
                  <ul className="mt-2 list-inside list-disc space-y-1 text-slate-800">
                    {state.lifePenaltyModal.forcedCards.map((row, i) => (
                      <li key={`${row.topic}-${i}-${row.from}`}>
                        「{row.topic}」 ({row.fromLabel})
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-slate-500">
                  강제로 깔린 카드는 없었어요. 잘못 낸 한 장은 생명에 세지 않아요.
                </p>
              )}
            </div>
            <button
              type="button"
              className="mt-6 w-full rounded-xl bg-gradient-to-r from-rose-600 to-violet-700 py-3 text-sm font-semibold text-white"
              onClick={dismissLifePenaltyModal}
            >
              확인
            </button>
          </div>
        </div>
      ) : null}

      <div className="mx-auto w-full max-w-[min(100%,28rem)]">
        {/* 상대 1=맞은편, 2=왼쪽, 3=오른쪽 · 본인 패는 화면 아래 */}
        <div className="flex justify-center pb-2">
          {botCount >= 1 ? (
            <BotStack
              name={seatLabelsResolved[0] ?? DEFAULT_OPPONENT_LABELS[0]}
              hand={state.bot1Hand}
              botKey="bot1"
              hintMode={state.hintMode}
              revealed={state.revealed}
              onReveal={reveal}
            />
          ) : null}
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-x-2 gap-y-2 md:gap-x-3">
          <div className="flex min-w-0 justify-end pr-0.5 pt-1 sm:pt-3">
            {botCount >= 2 ? (
              <BotStack
                name={seatLabelsResolved[1] ?? DEFAULT_OPPONENT_LABELS[1]}
                hand={state.bot2Hand}
                botKey="bot2"
                hintMode={state.hintMode}
                revealed={state.revealed}
                onReveal={reveal}
              />
            ) : (
              <span className="hidden w-[4.5rem] sm:block" aria-hidden />
            )}
          </div>

          <div className="p2-table-ink relative mx-auto w-full max-w-[min(100%,16.5rem)] rounded-[1.35rem] border-[5px] border-amber-800/35 p2-table-felt p-1.5 text-slate-900 shadow-[inset_0_2px_24px_rgba(120,53,15,0.08)] md:max-w-[min(100%,17.5rem)] md:p-2.5">
            <div className="flex flex-col items-center gap-1">
              <div
                key={state.shakeKey}
                className={`p2-play-slot flex w-full flex-col items-center justify-center px-0.5 py-1 ${state.shakeKey ? 'p2-shake-anim' : ''}`}
              >
                {lastFieldEntry ? (
                  <div
                    className={`w-full ${state.mergeFlash ? 'p2-merge-glow' : ''}`}
                  >
                    <div className="p2-field-golden-card text-center">
                      <p className="p1-enhance-badge mx-auto mb-0.5 !text-[0.6rem]">
                        필드
                      </p>
                      <p className="text-[9px] font-semibold text-amber-900/90">
                        {actorLabelFrom(lastFieldEntry.from, seatLabelsResolved)}
                      </p>
                      <p className="p1-enhance-topic !mt-1 !text-[clamp(0.9rem,3.8vw,1.2rem)]">
                        {lastFieldEntry.topic}
                      </p>
                      {lastFieldEntry.explanation ? (
                        <p className="p1-enhance-exp !mt-1.5 !text-[11px]">
                          {lastFieldEntry.explanation}
                        </p>
                      ) : (
                        <p className="mt-1.5 text-[11px] font-medium text-slate-600">
                          해설 없음
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex w-full flex-col items-center gap-1.5 px-0.5 py-0.5">
                    <p className="px-1 text-center text-[11px] font-semibold leading-snug text-slate-800">
                      {orderMode === 'sheet'
                        ? '시간·사건 순으로 눈치껏 내세요!'
                        : '가나다 순으로 눈치껏 내세요!'}
                    </p>
                    <p className="text-center text-[10px] font-medium leading-snug text-amber-900/90">
                      앞·뒤 2초를 제외한 시간에 족보 순으로 자동 제출됩니다.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-1.5 w-full border-t border-amber-900/25 pt-1.5">
              <div className="flex min-h-[1.5rem] w-full flex-wrap items-center justify-center gap-x-1 gap-y-0.5">
                {state.center.length === 0 ? (
                  <span className="text-[11px] font-medium text-slate-500">—</span>
                ) : (
                  state.center.map((entry, i) => (
                    <span
                      key={`${String(entry.rowId ?? '')}-${entry.topic}-${i}`}
                      className="inline-flex items-center gap-1"
                    >
                      {i > 0 ? (
                        <span className="select-none font-semibold text-slate-600" aria-hidden>
                          →
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => openFieldInspect(entry)}
                        className={`max-w-[6.5rem] truncate rounded border px-1 py-0.5 text-left text-[9px] font-medium transition hover:opacity-90 md:max-w-[8rem] md:text-[10px] ${fieldChipClass(entry)}`}
                      >
                        <span className="block truncate">{entry.topic}</span>
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="flex min-w-0 justify-start pl-0.5 pt-1 sm:pt-3">
            {botCount >= 3 ? (
              <BotStack
                name={seatLabelsResolved[2] ?? DEFAULT_OPPONENT_LABELS[2]}
                hand={state.bot3Hand}
                botKey="bot3"
                hintMode={state.hintMode}
                revealed={state.revealed}
                onReveal={reveal}
              />
            ) : (
              <span className="hidden w-[4.5rem] sm:block" aria-hidden />
            )}
          </div>
        </div>
      </div>

      {fieldInspect ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="field-inspect-title"
          onClick={() => setFieldInspect(null)}
        >
          <div
            className="pointer-events-auto max-h-[min(85dvh,32rem)] w-full max-w-md overflow-y-auto px-2 py-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p1-enhance-burst relative flex flex-col items-center">
              <div className="p1-enhance-rays" aria-hidden />
              <div className="p2-field-golden-card relative z-[1] w-full text-center shadow-2xl">
                <p className="p1-enhance-badge">1페이즈 카드</p>
                {fieldInspect.badges.length > 0 ? (
                  <p className="mt-1 text-[11px] font-medium text-amber-800">
                    {fieldInspect.badges.join(' · ')}
                  </p>
                ) : null}
                <p className="mt-1 text-[11px] text-slate-600">
                  {fieldInspect.fromLabel}
                </p>
                <h2
                  id="field-inspect-title"
                  className="p1-enhance-topic !mt-3"
                >
                  {fieldInspect.topic}
                </h2>
                <p className="p1-enhance-exp !mt-2 !text-[0.85rem]">
                  {fieldInspect.explanation || '해설이 없습니다.'}
                </p>
                <button
                  type="button"
                  className="mt-5 w-full rounded-xl bg-gradient-to-r from-amber-600 to-amber-800 py-3 text-sm font-semibold text-white shadow-md"
                  onClick={() => setFieldInspect(null)}
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div>
        <p className="mb-1.5 text-center text-sm font-semibold text-stone-100">
          내가 가진 카드
        </p>
        {tutorialMode && coachTargetId != null ? (
          <p
            className="mb-2 text-center text-xs font-medium text-amber-800 md:text-sm"
            role="status"
          >
            노란 테두리부터 탭
          </p>
        ) : coachMode && coachTargetId != null ? (
          <p
            className="mb-2 flex items-center justify-center gap-1 text-center text-xs font-medium text-amber-800 md:text-sm"
            role="status"
          >
            <span className="inline-block animate-bounce" aria-hidden>
              ↓
            </span>
            노란 테두리부터 탭
          </p>
        ) : null}
        <div className="max-h-[min(48dvh,26rem)] w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white/95 p-2 text-slate-900 shadow-inner sm:p-2.5">
          <div className="grid w-full grid-cols-3 gap-2 sm:gap-2.5">
            {state.playerHand.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={mechanicalAutoPlay}
                onClick={() => playPlayer(c)}
                className={`flex min-h-[7.5rem] flex-col rounded-xl border-2 border-slate-400/90 bg-white px-2.5 py-3 text-left shadow-[0_6px_0_0_rgba(15,23,42,0.35),0_8px_24px_rgba(0,0,0,0.25)] ring-1 ring-slate-300/80 transition md:min-h-[8.25rem] md:px-3 md:py-3.5 ${
                  mechanicalAutoPlay
                    ? 'pointer-events-none cursor-default opacity-95'
                    : 'active:translate-y-0.5 active:shadow-md'
                } ${
                  coachTargetId != null && c.id === coachTargetId
                    ? tutorialMode
                      ? 'z-10 ring-4 ring-amber-400 ring-offset-2 ring-offset-white shadow-[0_0_0_4px_rgba(251,191,36,0.45)] animate-pulse'
                      : 'ring-4 ring-amber-400 ring-offset-2 ring-offset-white'
                    : ''
                }`}
              >
                <span className="block text-[0.95rem] font-bold leading-snug text-slate-900 md:text-base">
                  {c.topic}
                </span>
                {c.explanation ? (
                  <span className="mt-2 line-clamp-4 text-[11px] leading-snug text-slate-600 md:text-xs">
                    {c.explanation}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="text-center text-[11px] text-stone-400 md:text-xs">
        Lv.{level}
      </p>
    </div>
  )
})

export default Phase2Mind
Phase2Mind.displayName = 'Phase2Mind'

/** 봇 정답 제출(호출 전에 globalMin과 일치함을 확인할 것) */
function applyBotSuccessPlay(state, bot, card) {
  const key =
    bot === 'bot1' ? 'bot1Hand' : bot === 'bot2' ? 'bot2Hand' : 'bot3Hand'
  const hand = state[key]
  if (!hand.some((c) => c.id === card.id)) return state

  const newCombo = (state.p2Combo ?? 0) + 1
  const { cheonryan: chAdd, lives: lfAdd } = phase1ComboRewards(newCombo)
  const t = card.topic
  const h2 = removeFromHand(hand, card)
  return {
    ...state,
    lastPlayed: { id: card.id, topic: t },
    center: [...state.center, centerEntryFromCard(card, bot)],
    [key]: h2,
    hintMode: false,
    revealed: new Set(),
    lifePenaltyModal: null,
    mergeFlash: state.mergeFlash + 1,
    p2Combo: newCombo,
    cheonryan: state.cheonryan + chAdd,
    lives: Math.min(MAX_LIVES, state.lives + lfAdd),
  }
}

function BotStack({ name, hand, botKey, hintMode, revealed, onReveal }) {
  return (
    <div className="w-full min-w-0 rounded-xl border border-sky-200 bg-white/95 px-2 py-2 shadow-md md:min-w-[140px] md:px-3">
      <p className="text-center text-[10px] font-medium text-slate-700 md:text-[11px]">
        {name}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {hand.map((c) => {
          const rid = `${botKey}-${c.id}`
          const show = revealed.has(rid)
          return (
            <button
              key={c.id}
              type="button"
              className={`h-12 w-10 rounded-lg border text-[9px] md:h-14 md:w-11 md:text-[10px] ${
                hintMode
                  ? 'border-amber-400 bg-amber-100 shadow-[0_0_12px_rgba(251,191,36,0.35)]'
                  : 'border-slate-300 bg-white text-slate-800'
              }`}
              onClick={() => onReveal(botKey, c.id)}
            >
              {show ? (
                <span className="line-clamp-3 px-0.5">{c.topic}</span>
              ) : (
                '?'
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

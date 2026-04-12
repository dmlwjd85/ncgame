import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { compareTopicOrder } from '../../utils/koCompare'
import {
  MAX_LIVES,
  phase1ComboRewards,
  phase2SecondsForLevel,
} from '../../utils/gameRules'
import { sfxMerge, sfxPenalty } from '../../utils/gameSfx'
import {
  BOT_PLAY_START_DELAY_MS,
  PLAYER_AHEAD_MS,
  scheduleBotFireTimesFromFloors,
} from '../../utils/phase2Utils'

const BOT_NAMES = ['가상 플레이어 A', '가상 플레이어 B']
const DISPLAY_HEARTS = 3

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function dealBot(poolRows, count, slot) {
  if (!poolRows.length || count <= 0) return []
  const p = shuffle([...poolRows])
  const out = []
  for (let i = 0; i < count; i++) {
    out.push(p[(slot * count + i) % p.length])
  }
  return shuffle(out)
}

function removeFromHand(hand, card) {
  return hand.filter((c) => c.id !== card.id)
}

/** 모든 손패에서 이번에 낼 수 있는 카드 중 주제어 최소 1장(소유자 포함) */
function globalMinValidEntry(state) {
  const last = state.lastTopic
  const all = [
    ...state.playerHand.map((card) => ({ card, from: 'player' })),
    ...state.bot1Hand.map((card) => ({ card, from: 'bot1' })),
    ...state.bot2Hand.map((card) => ({ card, from: 'bot2' })),
  ]
  const valid =
    last == null
      ? all
      : all.filter((x) => compareTopicOrder(x.card.topic, last) > 0)
  if (valid.length === 0) return null
  valid.sort((a, b) => {
    const o = compareTopicOrder(a.card.topic, b.card.topic)
    if (o !== 0) return o
    return String(a.card.id).localeCompare(String(b.card.id))
  })
  return valid[0]
}

function globalMinValidCard(state) {
  return globalMinValidEntry(state)?.card ?? null
}

/**
 * 잘못 낸 카드 W보다 앞(주제어 순서상 작음)이면서,
 * 필드 마지막보다 뒤인 카드 — 모든 플레이어 손에서 강제 제출 대상
 */
function collectForcedBeforeWrong(state, lastTopic, wrongTopic) {
  const parts = [
    ...state.playerHand.map((card) => ({ from: 'player', card })),
    ...state.bot1Hand.map((card) => ({ from: 'bot1', card })),
    ...state.bot2Hand.map((card) => ({ from: 'bot2', card })),
  ]
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

function actorLabel(from) {
  if (from === 'player') return '나'
  if (from === 'bot1') return '가상 플레이어 A'
  return '가상 플레이어 B'
}

function applyWrongSubmission(state, playedCard, playedFrom) {
  const expectedCard = globalMinValidCard(state)
  const expectedTopic = expectedCard?.topic ?? ''

  const last = state.lastTopic
  const w = playedCard.topic

  let forced = collectForcedBeforeWrong(state, last, w).filter(
    (x) => x.card.id !== playedCard.id,
  )
  forced.sort((a, b) => {
    const o = compareTopicOrder(a.card.topic, b.card.topic)
    if (o !== 0) return o
    return String(a.card.id).localeCompare(String(b.card.id))
  })

  let playerHand = [...state.playerHand]
  let bot1Hand = [...state.bot1Hand]
  let bot2Hand = [...state.bot2Hand]
  let center = [...state.center]

  for (const { from, card: c } of forced) {
    center = [...center, { topic: c.topic, from, forced: true }]
    if (from === 'player') playerHand = removeFromHand(playerHand, c)
    else if (from === 'bot1') bot1Hand = removeFromHand(bot1Hand, c)
    else bot2Hand = removeFromHand(bot2Hand, c)
  }

  const pen = forced.length

  center = [
    ...center,
    {
      topic: w,
      from: playedFrom,
      forced: true,
      wrongTap: true,
    },
  ]
  if (playedFrom === 'player') playerHand = removeFromHand(playerHand, playedCard)
  else if (playedFrom === 'bot1') bot1Hand = removeFromHand(bot1Hand, playedCard)
  else bot2Hand = removeFromHand(bot2Hand, playedCard)

  return {
    ...state,
    center,
    lastTopic: w,
    playerHand,
    bot1Hand,
    bot2Hand,
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
        fromLabel: actorLabel(fr),
      })),
      wrongFromLabel: actorLabel(playedFrom),
      livesLost: pen,
    },
    shakeKey: (state.shakeKey ?? 0) + 1,
  }
}

/**
 * 족보(전체 주제어 순)에서 봇이 내는 순서와 시각 — 해당 타이밍에 그 카드로 무조건 제출.
 * 같은 족보에서 플레이어 카드가 앞에 많을수록 봇 최소 시각을 뒤로 밀어,
 * 봇이 ㅎ 쪽만 잡혀 있어도 첫 제출이 너무 이르지 않게 한다.
 */
function buildBotScheduleFromHands(
  playerHand,
  bot1Hand,
  bot2Hand,
  botCount,
  durationMs,
) {
  const entries = [
    ...playerHand.map((card) => ({ card, bot: /** @type {'player'} */ ('player') })),
    ...bot1Hand.map((card) => ({ card, bot: /** @type {'bot1'} */ ('bot1') })),
    ...(botCount > 1
      ? bot2Hand.map((card) => ({ card, bot: /** @type {'bot2'} */ ('bot2') }))
      : []),
  ]
  entries.sort((a, b) => {
    const o = compareTopicOrder(a.card.topic, b.card.topic)
    if (o !== 0) return o
    return String(a.card.id).localeCompare(String(b.card.id))
  })

  const botPlays = []
  for (let j = 0; j < entries.length; j++) {
    const e = entries[j]
    if (e.bot === 'player') continue
    let precedingPlayers = 0
    for (let p = 0; p < j; p++) {
      if (entries[p].bot === 'player') precedingPlayers += 1
    }
    botPlays.push({ card: e.card, bot: e.bot, precedingPlayers })
  }

  const minFloors = botPlays.map(
    (bp) => BOT_PLAY_START_DELAY_MS + bp.precedingPlayers * PLAYER_AHEAD_MS,
  )
  const times = scheduleBotFireTimesFromFloors(minFloors, durationMs)
  return botPlays.map((bp, i) => ({
    fireAt: times[i],
    bot: bp.bot,
    cardId: bp.card.id,
  }))
}

function buildRoundState({
  playerCards,
  poolRows,
  botCount,
  durationMs,
  initialLives,
  initialCheonryan,
}) {
  const playerHand = shuffle(playerCards)
  const n = playerCards.length
  const bot1Hand = dealBot(poolRows, n, 0)
  const bot2Hand = botCount > 1 ? dealBot(poolRows, n, 1) : []
  const schedule = buildBotScheduleFromHands(
    playerHand,
    bot1Hand,
    bot2Hand,
    botCount,
    durationMs,
  )
  return {
    lives: initialLives,
    cheonryan: initialCheonryan,
    lastTopic: null,
    center: [],
    playerHand,
    bot1Hand,
    bot2Hand,
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
function applyPlayerPlayWithRules(state, card) {
  const hand = state.playerHand
  if (!hand.some((c) => c.id === card.id)) {
    return { ...state, penaltyToast: '손에 없는 카드예요.', lifePenaltyModal: null }
  }

  const globalMin = globalMinValidCard(state)
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
      lastTopic: t,
      center: [...state.center, { topic: t, from: 'player', forced: false }],
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

  return applyWrongSubmission(state, card, 'player')
}

/**
 * 2페이즈: 타이머(천리안 중 정지)·족보·강제 제출 안내
 */
export default function Phase2Mind({
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
}) {
  const durationMs = phase2SecondsForLevel(level) * 1000

  const tutorialBaseHint = useMemo(() => {
    if (!tutorialMode) return ''
    return '튜토리얼: 아래 「천리안」을 눌러 상대 패를 잠깐 볼 수 있어요. 시간이 멈춥니다.'
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
    }),
  )

  const endedRef = useRef(false)
  const nextBotIdxRef = useRef(0)
  const overlayPauseRef = useRef(false)
  const onItemRewardPopRef = useRef(onItemRewardPop)
  /** 천리안으로 잠깐 공개한 뒤 다시 가리기 위한 타이머 */
  const peekClearRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null))

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

  const dismissLifePenaltyModal = useCallback(() => {
    setState((s) => ({ ...s, lifePenaltyModal: null }))
  }, [])

  /** 게임 오버 시 부모에 넘길 2페이즈 스냅샷 */
  const makeLosePayload = useCallback(
    (next, reason) => ({
      reason,
      snapshot: {
        center: next.center,
        playerHand: next.playerHand,
        bot1Hand: next.bot1Hand,
        bot2Hand: next.bot2Hand,
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
        /* 천리안·패널티·토스트·부모 오버레이 중에는 시간·봇 스케줄 진행 안 함 */
        if (
          s.hintMode ||
          s.lifePenaltyModal ||
          s.penaltyToast ||
          overlayPauseRef.current
        ) {
          return s
        }
        let next = { ...s, elapsedMs: s.elapsedMs + 50 }
        const sched = s.schedule

        while (
          nextBotIdxRef.current < sched.length &&
          sched[nextBotIdxRef.current].fireAt <= next.elapsedMs
        ) {
          const slot = sched[nextBotIdxRef.current]
          const scheduledBot = slot.bot
          const hand =
            scheduledBot === 'bot1' ? next.bot1Hand : next.bot2Hand
          const card = hand.find((c) => String(c.id) === String(slot.cardId))
          if (!card) {
            nextBotIdxRef.current += 1
            continue
          }
          const globalMin = globalMinValidCard(next)
          const comboBefore = next.p2Combo ?? 0
          /* 족보상 지금 낼 수 있는 카드일 때만 제출 — 차례가 아니면 오답 처리 없이 다음 틱까지 대기 */
          if (!globalMin || globalMin.id !== card.id) {
            break
          }
          next = applyBotSuccessPlay(next, scheduledBot, card)
          const comboAfter = next.p2Combo ?? 0
          if (comboAfter > comboBefore) {
            const r = phase1ComboRewards(comboAfter)
            if (r.cheonryan > 0 || r.lives > 0) {
              queueMicrotask(() => onItemRewardPopRef.current?.(r))
            }
          }
          nextBotIdxRef.current += 1
          /* 봇 연속 처리 시 모달 한 번에 하나만 */
          if (next.lifePenaltyModal) break
        }

        const total =
          next.playerHand.length + next.bot1Hand.length + next.bot2Hand.length
        if (
          total === 0 &&
          next.center.length > 0 &&
          next.lives > 0
        ) {
          endedRef.current = true
          queueMicrotask(() =>
            onRoundWin({
              lives: next.lives,
              cheonryan: next.cheonryan,
              center: next.center,
            }),
          )
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
            queueMicrotask(() =>
              onRoundWin({
                lives: newLives,
                cheonryan: next.cheonryan,
                center: next.center,
                timeUpPenaltyCards: penalty,
              }),
            )
          }
        }

        return next
      })
    }, 50)
    return () => window.clearInterval(id)
  }, [level, onRoundWin, onRoundLose, makeLosePayload])

  const playPlayer = useCallback(
    (card) => {
      if (endedRef.current) return
      setState((s) => {
        const prevP2 = s.p2Combo ?? 0
        const next = applyPlayerPlayWithRules(s, card)
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
          next.playerHand.length + next.bot1Hand.length + next.bot2Hand.length
        if (next.lives <= 0) {
          endedRef.current = true
          queueMicrotask(() => onRoundLose(makeLosePayload(next, 'lives')))
        } else if (
          total === 0 &&
          next.center.length > 0 &&
          next.lives > 0
        ) {
          endedRef.current = true
          queueMicrotask(() =>
            onRoundWin({
              lives: next.lives,
              cheonryan: next.cheonryan,
              center: next.center,
            }),
          )
        }
        return next
      })
    },
    [onRoundWin, onRoundLose, makeLosePayload, onItemRewardPop],
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
        '상대 카드 한 장을 탭해 보세요. 탭하면 천리안이 끝나고 시간이 다시 흘러요.',
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
    }, 1600)
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

  const secLeft = Math.max(0, (durationMs - state.elapsedMs) / 1000)
  const totalCards =
    state.playerHand.length + state.bot1Hand.length + state.bot2Hand.length
  const timerPaused =
    state.hintMode ||
    state.lifePenaltyModal ||
    !!state.penaltyToast ||
    overlayTimerPause

  const timerPauseHint = (() => {
    if (state.lifePenaltyModal && !state.hintMode) return ' · 설명 확인 중'
    if (state.hintMode) return ' · 천리안'
    if (state.penaltyToast) return ' · 안내 확인 중'
    if (overlayTimerPause) return ' · 보상 확인 중'
    return ''
  })()
  /** 초보·튜토리얼: 전체 중 이번에 낼 수 있는 가장 앞 순서 카드 */
  const coachTargetId =
    (tutorialMode || coachMode) && state.playerHand.length > 0
      ? (() => {
          const e = globalMinValidEntry(state)
          return e?.from === 'player' ? e.card.id : null
        })()
      : null

  const tutorialGuideCard =
    tutorialMode && coachTargetId
      ? state.playerHand.find((c) => String(c.id) === String(coachTargetId))
      : null

  return (
    <div
      className={`relative flex flex-col gap-4 md:gap-5 ${
        timerPaused ? 'cheonryan-ring' : ''
      }`}
    >
      {state.hintMode ? (
        <div
          className="pointer-events-none fixed inset-0 z-40 bg-amber-400/10 cheonryan-vignette"
          aria-hidden
        />
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
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/55 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center"
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
                <span className="text-slate-500">이번에 나와야 했던 카드(전체 중 가장 앞 순서)</span>
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

      <div className="relative overflow-hidden rounded-2xl border border-amber-200/90 bg-gradient-to-br from-white via-amber-50/80 to-sky-50/90 px-3 py-3 shadow-md md:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs md:text-sm">
          <div className="flex items-center gap-2 md:gap-3">
            <span className="text-slate-600">라이프</span>
            <span className="text-base tracking-widest text-rose-500 md:text-lg">
              {(() => {
                const d = Math.min(DISPLAY_HEARTS, Math.max(0, state.lives))
                return (
                  <>
                    {'♥'.repeat(d)}
                    {'♡'.repeat(DISPLAY_HEARTS - d)}
                  </>
                )
              })()}
            </span>
          </div>
          <div>
            <span className="text-slate-600">천리안 </span>
            <span className="font-semibold text-amber-600">{state.cheonryan}</span>
          </div>
          <div>
            <span className="text-slate-600">콤보 </span>
            <span className="font-semibold text-emerald-600">
              {state.p2Combo ?? 0}
            </span>
          </div>
          <div className="font-mono text-sky-700 tabular-nums">
            {timerPaused ? (
              <span className="text-amber-700">
                일시정지 {secLeft.toFixed(1)}초{timerPauseHint}
              </span>
            ) : (
              <>{secLeft.toFixed(1)}초</>
            )}
          </div>
        </div>
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1 origin-left bg-gradient-to-r from-cyan-500/0 via-cyan-400/60 to-violet-500/0 transition-transform"
          style={{
            transform: `scaleX(${Math.max(0, 1 - state.elapsedMs / durationMs)})`,
          }}
        />
        {state.lastTopic ? (
          <p className="mt-2 text-center text-[11px] text-slate-600 md:text-xs">
            필드 끝 주제어{' '}
            <span className="font-medium text-slate-900">{state.lastTopic}</span>
          </p>
        ) : (
          <p className="mt-2 text-center text-[11px] text-slate-600 md:text-xs">
            첫 카드는 아무거나 낼 수 있어요. 이후는 국어→영어→숫자 순으로 앞보다
            뒤만 낼 수 있어요.
          </p>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-2 md:gap-3 landscape:grid landscape:grid-cols-2 landscape:items-start landscape:gap-4">
        {botCount >= 1 ? (
          <BotStack
            name={BOT_NAMES[0]}
            hand={state.bot1Hand}
            botKey="bot1"
            hintMode={state.hintMode}
            revealed={state.revealed}
            onReveal={reveal}
          />
        ) : null}
        {botCount >= 2 ? (
          <BotStack
            name={BOT_NAMES[1]}
            hand={state.bot2Hand}
            botKey="bot2"
            hintMode={state.hintMode}
            revealed={state.revealed}
            onReveal={reveal}
          />
        ) : null}
      </div>

      <div
        key={state.shakeKey}
        className={`min-h-[72px] rounded-2xl border border-violet-200 bg-gradient-to-b from-violet-50 to-white px-2 py-3 text-center shadow-inner md:min-h-[88px] md:px-3 md:py-4 ${state.shakeKey ? 'p2-shake-anim' : ''} ${state.mergeFlash ? 'p2-merge-glow' : ''}`}
      >
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-violet-700 md:text-[11px]">
          필드 · 국어→영어→숫자 순
        </p>
        <p className="mt-2 text-xs leading-relaxed text-slate-800 md:text-sm">
          {state.center.length === 0
            ? '—'
            : state.center.map((c, i) => (
                <span key={`${c.topic}-${i}-${c.forced ? 'f' : 'n'}-${c.wrongTap ? 'w' : ''}`}>
                  {i > 0 ? <span className="text-slate-400"> → </span> : null}
                  <span
                    className={`rounded-md px-1.5 py-0.5 transition ${
                      c.wrongTap
                        ? 'bg-rose-200 text-rose-900 ring-2 ring-amber-400'
                        : c.forced
                          ? 'bg-amber-100 text-amber-900 line-through decoration-amber-600/60'
                          : 'bg-violet-100 text-violet-900'
                    }`}
                  >
                    {c.topic}
                  </span>
                </span>
              ))}
        </p>
      </div>

      <div>
        <p className="mb-2 text-center text-[11px] text-slate-600 md:text-xs">
          내 카드 — 탭하면 바로 제출 · 이번에 낼 수 있는 가장 앞 순서(전체)와 같아야
          해요
        </p>
        {tutorialMode && coachTargetId != null ? (
          <p
            className="mb-2 text-center text-xs font-medium text-amber-800 md:text-sm"
            role="status"
          >
            노란 테두리 카드를 탭해 제출하세요.
          </p>
        ) : coachMode && coachTargetId != null ? (
          <p
            className="mb-2 flex items-center justify-center gap-1 text-center text-xs font-medium text-amber-800 md:text-sm"
            role="status"
          >
            <span className="inline-block animate-bounce" aria-hidden>
              ↓
            </span>
            노란 테두리 카드를 먼저 내 보세요 (순서가 맞을 때 콤보·보상이 쌓여요)
          </p>
        ) : null}
        <div className="max-h-[min(52dvh,28rem)] w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-inner sm:p-3">
          <div className="grid w-full grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
            {state.playerHand.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => playPlayer(c)}
                className={`flex min-h-[7.5rem] flex-col rounded-xl border-2 border-slate-400/90 bg-white px-2.5 py-3 text-left shadow-[0_6px_0_0_rgba(15,23,42,0.35),0_8px_24px_rgba(0,0,0,0.25)] ring-1 ring-slate-300/80 transition active:translate-y-0.5 active:shadow-md md:min-h-[8.25rem] md:px-3 md:py-3.5 ${
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

      <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3">
        <button
          type="button"
          disabled={state.cheonryan <= 0 || state.hintMode}
          onClick={startCheonryan}
          className="rounded-xl border border-amber-300 bg-amber-100 px-3 py-2 text-xs font-medium text-amber-900 shadow-md disabled:opacity-40 md:px-4 md:text-sm"
        >
          천리안 {state.hintMode ? '· 상대 카드 탭' : `×${state.cheonryan}`}
        </button>
        {state.hintMode ? (
          <button
            type="button"
            onClick={endHintMode}
            className="text-[11px] text-slate-600 underline md:text-xs"
          >
            취소(탭 없이 닫기)
          </button>
        ) : null}
        <p className="text-[11px] text-slate-600 md:text-xs">
          남은 {totalCards}장 · Lv.{level}
        </p>
      </div>
    </div>
  )
}

/** 봇 정답 제출(호출 전에 globalMin과 일치함을 확인할 것) */
function applyBotSuccessPlay(state, bot, card) {
  const hand = bot === 'bot1' ? state.bot1Hand : state.bot2Hand
  if (!hand.some((c) => c.id === card.id)) return state

  const newCombo = (state.p2Combo ?? 0) + 1
  const { cheonryan: chAdd, lives: lfAdd } = phase1ComboRewards(newCombo)
  const t = card.topic
  const h2 = removeFromHand(hand, card)
  return {
    ...state,
    lastTopic: t,
    center: [...state.center, { topic: t, from: bot, forced: false }],
    [bot === 'bot1' ? 'bot1Hand' : 'bot2Hand']: h2,
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
      <p className="text-center text-[9px] text-slate-500 md:text-[10px]">족보 자동</p>
      <div className="mt-2 flex flex-wrap gap-1">
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

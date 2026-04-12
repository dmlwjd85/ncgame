import { useCallback, useEffect, useRef, useState } from 'react'
import { compareTopicOrder } from '../../utils/koCompare'
import {
  USER_RESERVE_MS,
  mergeBotPlayOrder,
  scheduleTimes,
  countSkippedBeforeWrong,
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

/**
 * 레벨 시작 시 손패·봇 족보·제출 시각表를 한 번에 생성
 */
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
  const order = mergeBotPlayOrder(bot1Hand, bot2Hand)
  const times = scheduleTimes(order.length, durationMs, USER_RESERVE_MS)
  const schedule = order.map((item, i) => ({
    bot: item.bot,
    card: item.card,
    fireAt: times[i] ?? 0,
  }))
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
    hintMode: false,
    revealed: new Set(),
  }
}

/**
 * 2페이즈: 타이머·족보 스케줄·천리안·사전순 벌칙
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
}) {
  const durationMs = 5000 * Math.max(1, level)

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

  useEffect(() => {
    const id = window.setInterval(() => {
      if (endedRef.current) return
      setState((s) => {
        let next = { ...s, elapsedMs: s.elapsedMs + 50 }
        const sched = s.schedule

        while (
          nextBotIdxRef.current < sched.length &&
          sched[nextBotIdxRef.current].fireAt <= next.elapsedMs
        ) {
          const ev = sched[nextBotIdxRef.current]
          nextBotIdxRef.current += 1
          next = applyBotScheduledPlay(next, ev.bot, ev.card)
        }

        const total =
          next.playerHand.length + next.bot1Hand.length + next.bot2Hand.length
        if (total === 0 && next.center.length > 0) {
          endedRef.current = true
          queueMicrotask(() =>
            onRoundWin({ lives: next.lives, cheonryan: next.cheonryan }),
          )
        } else if (next.lives <= 0) {
          endedRef.current = true
          queueMicrotask(() => onRoundLose())
        } else if (next.elapsedMs >= next.durationMs && total > 0) {
          endedRef.current = true
          queueMicrotask(() => onRoundLose())
        }

        return next
      })
    }, 50)
    return () => window.clearInterval(id)
  }, [level, onRoundWin, onRoundLose])

  const playPlayer = useCallback(
    (card) => {
      if (endedRef.current) return
      setState((s) => {
        const next = applyPlayerPlay(s, card)
        if (endedRef.current) return next
        const total =
          next.playerHand.length + next.bot1Hand.length + next.bot2Hand.length
        if (next.lives <= 0) {
          endedRef.current = true
          queueMicrotask(() => onRoundLose())
        } else if (total === 0 && next.center.length > 0) {
          endedRef.current = true
          queueMicrotask(() =>
            onRoundWin({ lives: next.lives, cheonryan: next.cheonryan }),
          )
        }
        return next
      })
    },
    [onRoundWin, onRoundLose],
  )

  const startCheonryan = useCallback(() => {
    if (endedRef.current) return
    setState((s) => {
      if (s.cheonryan <= 0 || s.hintMode) return s
      return {
        ...s,
        cheonryan: s.cheonryan - 1,
        hintMode: true,
        revealed: new Set(),
      }
    })
  }, [])

  const reveal = useCallback((botKey, cardId) => {
    setState((s) => {
      if (!s.hintMode) return s
      const key = `${botKey}-${cardId}`
      return { ...s, revealed: new Set(s.revealed).add(key) }
    })
  }, [])

  const endHintMode = useCallback(() => {
    setState((s) => ({ ...s, hintMode: false }))
  }, [])

  const secLeft = Math.max(0, (durationMs - state.elapsedMs) / 1000)
  const totalCards =
    state.playerHand.length + state.bot1Hand.length + state.bot2Hand.length

  return (
    <div className="flex flex-col gap-5">
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-violet-950/40 px-4 py-3 shadow-lg shadow-violet-900/20">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-3">
            <span className="text-slate-400">라이프</span>
            <span className="text-lg tracking-widest text-rose-300 drop-shadow">
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
            <span className="text-slate-400">천리안 </span>
            <span className="font-semibold text-amber-200">{state.cheonryan}</span>
          </div>
          <div className="font-mono text-cyan-300 tabular-nums">
            {secLeft.toFixed(1)}초
          </div>
        </div>
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1 origin-left bg-gradient-to-r from-cyan-500/0 via-cyan-400/60 to-violet-500/0 transition-transform"
          style={{
            transform: `scaleX(${Math.max(0, 1 - state.elapsedMs / durationMs)})`,
          }}
        />
        {state.lastTopic ? (
          <p className="mt-2 text-center text-xs text-slate-400">
            필드 끝 주제어{' '}
            <span className="text-slate-100">{state.lastTopic}</span>
          </p>
        ) : (
          <p className="mt-2 text-center text-xs text-slate-500">
            첫 카드는 사전에서 뒤쪽으로만 이어지면 됩니다.
          </p>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-3">
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

      <div className="min-h-[88px] rounded-2xl border border-violet-400/25 bg-gradient-to-b from-violet-950/50 to-slate-950/80 px-3 py-4 text-center shadow-inner">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-violet-300/80">
          필드 · 국어 사전순
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-100">
          {state.center.length === 0
            ? '—'
            : state.center.map((c, i) => (
                <span key={`${c.topic}-${i}`}>
                  {i > 0 ? <span className="text-slate-600"> → </span> : null}
                  <span className="rounded-md bg-violet-500/15 px-1.5 py-0.5 text-violet-100">
                    {c.topic}
                  </span>
                </span>
              ))}
        </p>
      </div>

      <div>
        <p className="mb-3 text-center text-xs text-slate-500">
          내 카드 — 사전에서 앞 카드보다 뒤에 오는 주제어만 낼 수 있습니다.
        </p>
        <div className="flex gap-2 overflow-x-auto pb-2 [-webkit-overflow-scrolling:touch]">
          {state.playerHand.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => playPlayer(c)}
              className="min-w-[6.5rem] shrink-0 rounded-xl border border-emerald-400/35 bg-gradient-to-br from-emerald-950/80 to-slate-900/90 px-3 py-3 text-left shadow-md transition active:scale-[0.98]"
            >
              <span className="block text-sm font-semibold text-emerald-100">
                {c.topic}
              </span>
              {c.explanation ? (
                <span className="mt-1 line-clamp-2 text-[11px] text-emerald-200/60">
                  {c.explanation}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          disabled={state.cheonryan <= 0 || state.hintMode}
          onClick={startCheonryan}
          className="rounded-xl border border-amber-400/40 bg-amber-950/40 px-4 py-2.5 text-sm font-medium text-amber-100 shadow-md disabled:opacity-40"
        >
          천리안 {state.hintMode ? '· 카드 탭' : `×${state.cheonryan}`}
        </button>
        {state.hintMode ? (
          <button
            type="button"
            onClick={endHintMode}
            className="text-xs text-slate-400 underline"
          >
            닫기
          </button>
        ) : null}
        <p className="text-xs text-slate-500">
          남은 카드 {totalCards}장 · 레벨 {level}
        </p>
      </div>
    </div>
  )
}

function applyBotScheduledPlay(state, bot, card) {
  const hand = bot === 'bot1' ? state.bot1Hand : state.bot2Hand
  const still = hand.some((c) => c.id === card.id)
  if (!still) return state

  const t = card.topic
  const invalid =
    state.lastTopic != null && compareTopicOrder(t, state.lastTopic) <= 0
  if (invalid) {
    const pen = botPenalty(hand, state.lastTopic, card)
    const h2 = removeFromHand(hand, card)
    return {
      ...state,
      lives: Math.max(0, state.lives - pen),
      [bot === 'bot1' ? 'bot1Hand' : 'bot2Hand']: h2,
      hintMode: false,
      revealed: new Set(),
    }
  }

  const h2 = removeFromHand(hand, card)
  return {
    ...state,
    lastTopic: t,
    center: [...state.center, { topic: t, from: bot }],
    [bot === 'bot1' ? 'bot1Hand' : 'bot2Hand']: h2,
    hintMode: false,
    revealed: new Set(),
  }
}

function botPenalty(hand, lastTopic, playedCard) {
  if (lastTopic == null) return 1
  const t = playedCard.topic
  if (compareTopicOrder(t, lastTopic) > 0) return 0
  const others = hand.filter((c) => c.id !== playedCard.id)
  const between = others.filter(
    (c) =>
      compareTopicOrder(c.topic, lastTopic) > 0 &&
      compareTopicOrder(c.topic, t) < 0,
  ).length
  if (between > 0) return between
  const after = others.filter((c) => compareTopicOrder(c.topic, lastTopic) > 0).length
  return Math.max(1, after)
}

function applyPlayerPlay(state, card) {
  const t = card.topic
  const invalid =
    state.lastTopic != null && compareTopicOrder(t, state.lastTopic) <= 0
  if (invalid) {
    const pen = countSkippedBeforeWrong(state.playerHand, state.lastTopic, card)
    return {
      ...state,
      lives: Math.max(0, state.lives - pen),
      hintMode: false,
      revealed: new Set(),
    }
  }
  return {
    ...state,
    lastTopic: t,
    center: [...state.center, { topic: t, from: 'player' }],
    playerHand: removeFromHand(state.playerHand, card),
    hintMode: false,
    revealed: new Set(),
  }
}

function BotStack({ name, hand, botKey, hintMode, revealed, onReveal }) {
  return (
    <div className="min-w-[140px] rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 shadow-md">
      <p className="text-center text-[11px] font-medium text-slate-400">{name}</p>
      <p className="text-center text-[10px] text-slate-600">족보 순서로 자동 제출</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {hand.map((c) => {
          const rid = `${botKey}-${c.id}`
          const show = revealed.has(rid)
          return (
            <button
              key={c.id}
              type="button"
              className={`h-14 w-11 rounded-lg border text-[10px] transition ${
                hintMode
                  ? 'border-amber-400/80 bg-amber-950/50 shadow-[0_0_12px_rgba(251,191,36,0.25)]'
                  : 'border-slate-600 bg-slate-800/90'
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

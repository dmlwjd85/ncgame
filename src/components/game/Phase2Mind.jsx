import { useCallback, useEffect, useRef, useState } from 'react'
import { compareTopicOrder } from '../../utils/koCompare'
import { phase2SecondsForLevel } from '../../utils/gameRules'
import { sfxMerge, sfxPenalty } from '../../utils/gameSfx'
import {
  USER_RESERVE_MS,
  mergeBotPlayOrder,
  scheduleTimes,
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
    penaltyToast: /** @type {string | null} */ (null),
    shakeKey: 0,
    mergeFlash: 0,
  }
}

/**
 * 순서 오류: 제출한 카드까지 앞순번을 강제 제출.
 * 생명은 잘못 낸 카드(마지막 한 장)를 제외한 강제 제출 장수만큼 차감.
 */
function applyPlayerPlayWithRules(state, card) {
  const lastTopic = state.lastTopic
  const hand = state.playerHand

  const valid = hand.filter(
    (c) =>
      lastTopic == null || compareTopicOrder(c.topic, lastTopic) > 0,
  )
  const sortedValid = [...valid].sort((a, b) =>
    compareTopicOrder(a.topic, b.topic),
  )

  if (sortedValid.length === 0) {
    return {
      ...state,
      penaltyToast:
        '낼 수 있는 카드가 없습니다. 필드 순서를 다시 확인해 주세요.',
    }
  }

  if (sortedValid[0].id === card.id) {
    const t = card.topic
    return {
      ...state,
      lastTopic: t,
      center: [...state.center, { topic: t, from: 'player', forced: false }],
      playerHand: removeFromHand(state.playerHand, card),
      hintMode: false,
      revealed: new Set(),
      penaltyToast: null,
      mergeFlash: state.mergeFlash + 1,
    }
  }

  const idx = sortedValid.findIndex((c) => c.id === card.id)

  if (idx > 0) {
    const chain = sortedValid.slice(0, idx + 1)
    let center = [...state.center]
    let playerHand = [...state.playerHand]
    let last = lastTopic
    for (let i = 0; i < chain.length; i++) {
      const c = chain[i]
      const isWrongTap = i === idx
      center = [
        ...center,
        {
          topic: c.topic,
          from: 'player',
          forced: true,
          wrongTap: isWrongTap,
        },
      ]
      last = c.topic
      playerHand = playerHand.filter((x) => x.id !== c.id)
    }
    const pen = idx
    const autoNames = chain
      .slice(0, idx)
      .map((c) => `「${c.topic}」`)
      .join(', ')
    const reason =
      pen > 0
        ? `먼저 나와야 할 카드 ${pen}장(${autoNames})이 깔렸어요. 잘못 낸 카드는 생명에 세지 않아요. 생명 ${pen}칸이 깎였어요.`
        : '순서가 맞지 않아요.'

    return {
      ...state,
      center,
      lastTopic: last,
      playerHand,
      lives: Math.max(0, state.lives - pen),
      hintMode: false,
      revealed: new Set(),
      penaltyToast: reason,
      shakeKey: (state.shakeKey ?? 0) + 1,
    }
  }

  const beforeW = sortedValid.filter(
    (c) => compareTopicOrder(c.topic, card.topic) < 0,
  )
  beforeW.sort((a, b) => compareTopicOrder(a.topic, b.topic))
  const mustForce = beforeW.length > 0 ? beforeW : [...sortedValid]

  let center = [...state.center]
  let playerHand = [...state.playerHand]
  let last = lastTopic
  for (const f of mustForce) {
    center = [...center, { topic: f.topic, from: 'player', forced: true }]
    last = f.topic
    playerHand = playerHand.filter((c) => c.id !== f.id)
  }
  center = [
    ...center,
    {
      topic: card.topic,
      from: 'player',
      forced: true,
      wrongTap: true,
    },
  ]
  last = card.topic
  playerHand = playerHand.filter((c) => c.id !== card.id)

  const pen = mustForce.length
  const names = mustForce.map((c) => `「${c.topic}」`).join(', ')
  const reason =
    pen > 0
      ? `이 카드 순서가 아니에요. 먼저 ${pen}장(${names})이 깔렸고, 잘못 낸 한 장은 생명에 안 세요. 생명 ${pen}칸이 깎였어요.`
      : '낼 수 없는 카드를 골랐어요. 생명 1칸이 깎였어요.'

  const lifeCost = pen > 0 ? pen : 1

  return {
    ...state,
    center,
    lastTopic: last,
    playerHand,
    lives: Math.max(0, state.lives - lifeCost),
    hintMode: false,
    revealed: new Set(),
    penaltyToast: reason,
    shakeKey: (state.shakeKey ?? 0) + 1,
  }
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
}) {
  const durationMs = phase2SecondsForLevel(level) * 1000

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
    if (!state.penaltyToast) return
    const id = window.setTimeout(() => {
      setState((s) => ({ ...s, penaltyToast: null }))
    }, 7000)
    return () => window.clearTimeout(id)
  }, [state.penaltyToast])

  useEffect(() => {
    const id = window.setInterval(() => {
      if (endedRef.current) return
      setState((s) => {
        if (s.hintMode) return s
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
        const next = applyPlayerPlayWithRules(s, card)
        if (next.penaltyToast) sfxPenalty()
        else sfxMerge()
        if (endedRef.current) return next
        const total =
          next.playerHand.length + next.bot1Hand.length + next.bot2Hand.length
        if (next.lives <= 0) {
          endedRef.current = true
          queueMicrotask(() => onRoundLose())
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
  const timerPaused = state.hintMode

  return (
    <div
      className={`relative flex flex-col gap-4 md:gap-5 ${
        state.hintMode ? 'cheonryan-ring' : ''
      }`}
    >
      {state.hintMode ? (
        <div
          className="pointer-events-none fixed inset-0 z-40 bg-amber-400/10 cheonryan-vignette"
          aria-hidden
        />
      ) : null}

      {state.penaltyToast ? (
        <div
          role="alert"
          className="rounded-2xl border border-rose-500/40 bg-rose-950/80 px-4 py-3 text-sm leading-relaxed text-rose-100 shadow-lg shadow-rose-900/30"
        >
          {state.penaltyToast}
        </div>
      ) : null}

      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-violet-950/40 px-3 py-3 shadow-lg shadow-violet-900/20 md:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs md:text-sm">
          <div className="flex items-center gap-2 md:gap-3">
            <span className="text-slate-400">라이프</span>
            <span className="text-base tracking-widest text-rose-300 md:text-lg">
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
            {timerPaused ? (
              <span className="text-amber-200">일시정지 {secLeft.toFixed(1)}초</span>
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
          <p className="mt-2 text-center text-[11px] text-slate-400 md:text-xs">
            필드 끝 주제어{' '}
            <span className="text-slate-100">{state.lastTopic}</span>
          </p>
        ) : (
          <p className="mt-2 text-center text-[11px] text-slate-500 md:text-xs">
            첫 카드는 사전에서 뒤쪽으로만 이어지면 됩니다.
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
        className={`min-h-[72px] rounded-2xl border border-violet-400/25 bg-gradient-to-b from-violet-950/50 to-slate-950/80 px-2 py-3 text-center shadow-inner md:min-h-[88px] md:px-3 md:py-4 ${state.shakeKey ? 'p2-shake-anim' : ''} ${state.mergeFlash ? 'p2-merge-glow' : ''}`}
      >
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-violet-300/80 md:text-[11px]">
          필드 · 국어 사전순
        </p>
        <p className="mt-2 text-xs leading-relaxed text-slate-100 md:text-sm">
          {state.center.length === 0
            ? '—'
            : state.center.map((c, i) => (
                <span key={`${c.topic}-${i}-${c.forced ? 'f' : 'n'}-${c.wrongTap ? 'w' : ''}`}>
                  {i > 0 ? <span className="text-slate-600"> → </span> : null}
                  <span
                    className={`rounded-md px-1.5 py-0.5 transition ${
                      c.wrongTap
                        ? 'bg-rose-600/35 text-rose-50 ring-2 ring-amber-300/70'
                        : c.forced
                          ? 'bg-amber-500/25 text-amber-100 line-through decoration-amber-200/50'
                          : 'bg-violet-500/15 text-violet-100'
                    }`}
                  >
                    {c.topic}
                  </span>
                </span>
              ))}
        </p>
      </div>

      <div>
        <p className="mb-2 text-center text-[11px] text-slate-500 md:text-xs">
          내 카드 — 사전에서 앞 카드보다 뒤에 오는 주제어만 낼 수 있습니다.
        </p>
        <div className="flex max-w-full gap-2 overflow-x-auto pb-2 [-webkit-overflow-scrolling:touch] landscape:max-h-[40vh] landscape:flex-wrap landscape:overflow-y-auto">
          {state.playerHand.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => playPlayer(c)}
              className="min-w-[5.5rem] max-w-[9rem] shrink-0 rounded-xl border border-emerald-400/35 bg-gradient-to-br from-emerald-950/80 to-slate-900/90 px-2.5 py-2.5 text-left shadow-md transition active:scale-[0.98] md:min-w-[6.5rem] md:px-3 md:py-3"
            >
              <span className="block text-xs font-semibold text-emerald-100 md:text-sm">
                {c.topic}
              </span>
              {c.explanation ? (
                <span className="mt-1 line-clamp-2 text-[10px] text-emerald-200/60 md:text-[11px]">
                  {c.explanation}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3">
        <button
          type="button"
          disabled={state.cheonryan <= 0 || state.hintMode}
          onClick={startCheonryan}
          className="rounded-xl border border-amber-400/40 bg-amber-950/40 px-3 py-2 text-xs font-medium text-amber-100 shadow-md disabled:opacity-40 md:px-4 md:text-sm"
        >
          천리안 {state.hintMode ? '· 카드 탭' : `×${state.cheonryan}`}
        </button>
        {state.hintMode ? (
          <button
            type="button"
            onClick={endHintMode}
            className="text-[11px] text-slate-400 underline md:text-xs"
          >
            닫기 · 타이머 재개
          </button>
        ) : null}
        <p className="text-[11px] text-slate-500 md:text-xs">
          남은 {totalCards}장 · Lv.{level}
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
    center: [...state.center, { topic: t, from: bot, forced: false }],
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

function BotStack({ name, hand, botKey, hintMode, revealed, onReveal }) {
  return (
    <div className="w-full min-w-0 rounded-xl border border-white/10 bg-slate-900/70 px-2 py-2 shadow-md md:min-w-[140px] md:px-3">
      <p className="text-center text-[10px] font-medium text-slate-400 md:text-[11px]">
        {name}
      </p>
      <p className="text-center text-[9px] text-slate-600 md:text-[10px]">족보 자동</p>
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

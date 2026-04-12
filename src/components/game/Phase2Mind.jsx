import { useEffect, useReducer, useRef, useMemo } from 'react'
import { compareTopicOrder } from '../../utils/koCompare'

const BOT_NAMES = ['가상 플레이어 A', '가상 플레이어 B']

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function dealBot(poolRows, count, slot) {
  if (!poolRows.length) return []
  const p = shuffle([...poolRows])
  const out = []
  for (let i = 0; i < count; i++) {
    out.push(p[(slot * count + i) % p.length])
  }
  return shuffle(out)
}

function pickBotCard(hand, lastTopic) {
  const sorted = [...hand].sort((a, b) =>
    compareTopicOrder(a.topic, b.topic),
  )
  if (lastTopic == null) return sorted[0]
  const ok = sorted.filter((c) => compareTopicOrder(c.topic, lastTopic) > 0)
  if (ok.length) return ok[0]
  return sorted[0]
}

function reducer(state, action) {
  switch (action.type) {
    case 'PLAY': {
      const { card, from } = action
      const t = card.topic
      const invalid =
        state.lastTopic != null && compareTopicOrder(t, state.lastTopic) <= 0
      if (invalid) {
        return { ...state, lives: Math.max(0, state.lives - 1) }
      }
      const center = [...state.center, { topic: t, from }]
      let playerHand = state.playerHand
      let bot1Hand = state.bot1Hand
      let bot2Hand = state.bot2Hand
      if (from === 'player') playerHand = playerHand.filter((c) => c.id !== card.id)
      else if (from === 'bot1') bot1Hand = bot1Hand.filter((c) => c.id !== card.id)
      else bot2Hand = bot2Hand.filter((c) => c.id !== card.id)
      return {
        ...state,
        lastTopic: t,
        center,
        playerHand,
        bot1Hand,
        bot2Hand,
        turn: state.turn + 1,
        hintMode: false,
        revealed: new Set(),
      }
    }
    case 'SKIP_TURN':
      return { ...state, turn: state.turn + 1, hintMode: false, revealed: new Set() }
    case 'HINT_START':
      return {
        ...state,
        hints: Math.max(0, state.hints - 1),
        hintMode: true,
      }
    case 'REVEAL':
      return {
        ...state,
        revealed: new Set(state.revealed).add(action.key),
      }
    default:
      return state
  }
}

/**
 * 2페이즈: 국어 사전순 눈치 (더마인드 유사)
 */
export default function Phase2Mind({
  playerCards,
  botCount,
  poolRows,
  initialHints,
  onEnd,
}) {
  const turnOrder = useMemo(() => {
    const o = ['player']
    if (botCount >= 1) o.push('bot1')
    if (botCount >= 2) o.push('bot2')
    return o
  }, [botCount])

  const [state, dispatch] = useReducer(reducer, {
    lives: 3,
    lastTopic: null,
    center: [],
    playerHand: shuffle(playerCards),
    bot1Hand: dealBot(poolRows, playerCards.length, 0),
    bot2Hand: botCount > 1 ? dealBot(poolRows, playerCards.length, 1) : [],
    turn: 0,
    hints: initialHints,
    hintMode: false,
    revealed: new Set(),
  })

  const endedRef = useRef(false)
  const stateRef = useRef(state)

  useEffect(() => {
    stateRef.current = state
  })

  const actor = useMemo(
    () => turnOrder[state.turn % turnOrder.length],
    [state.turn, turnOrder],
  )

  const total =
    state.playerHand.length + state.bot1Hand.length + state.bot2Hand.length

  useEffect(() => {
    if (endedRef.current) return
    if (state.lives <= 0) {
      endedRef.current = true
      onEnd('lose')
      return
    }
    if (total === 0 && state.center.length > 0) {
      endedRef.current = true
      onEnd('win')
    }
  }, [state.lives, total, state.center.length, onEnd])

  useEffect(() => {
    if (actor === 'player') return
    const id = window.setTimeout(() => {
      const s = stateRef.current
      const a = turnOrder[s.turn % turnOrder.length]
      if (a === 'player') return
      const hand = a === 'bot1' ? s.bot1Hand : s.bot2Hand
      if (hand.length === 0) {
        dispatch({ type: 'SKIP_TURN' })
        return
      }
      const card = pickBotCard(hand, s.lastTopic)
      dispatch({ type: 'PLAY', card, from: a })
    }, 550)
    return () => window.clearTimeout(id)
  }, [actor, state.turn, turnOrder])

  const playPlayer = (card) => {
    if (actor !== 'player') return
    dispatch({ type: 'PLAY', card, from: 'player' })
  }

  const useHint = () => {
    if (state.hints <= 0 || state.hintMode) return
    dispatch({ type: 'HINT_START' })
  }

  const reveal = (botKey, cardId) => {
    if (!state.hintMode) return
    dispatch({ type: 'REVEAL', key: `${botKey}-${cardId}` })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-center text-sm">
        <span className="text-slate-400">라이프 </span>
        <span className="text-rose-300">{'♥'.repeat(Math.max(0, state.lives))}</span>
        <span className="ml-3 text-slate-400">힌트 </span>
        <span className="text-amber-200">{state.hints}</span>
        {state.lastTopic ? (
          <p className="mt-1 text-xs text-slate-500">
            마지막 주제어:{' '}
            <span className="text-slate-200">{state.lastTopic}</span>
          </p>
        ) : (
          <p className="mt-1 text-xs text-slate-500">
            첫 카드는 어떤 주제어로 시작해도 됩니다.
          </p>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
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

      <div className="min-h-[72px] rounded-xl border border-violet-500/30 bg-violet-950/20 px-2 py-3 text-center">
        <p className="text-xs text-violet-300/80">필드 (사전순 진행)</p>
        <p className="mt-1 text-sm text-slate-200">
          {state.center.length === 0
            ? '—'
            : state.center.map((c, i) => (
                <span key={`${c.topic}-${i}`}>
                  {i > 0 ? ' → ' : ''}
                  <span className="text-violet-200">{c.topic}</span>
                </span>
              ))}
        </p>
      </div>

      <div>
        <p className="mb-2 text-center text-xs text-slate-500">
          내 손패 — 이전보다 사전에서 뒤에 오는 주제어만 낼 수 있습니다.
        </p>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {state.playerHand.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={actor !== 'player'}
              onClick={() => playPlayer(c)}
              className="min-w-[5.5rem] shrink-0 rounded-lg border border-emerald-500/50 bg-emerald-900/30 px-3 py-3 text-left text-sm text-emerald-100 disabled:opacity-40"
            >
              <span className="font-medium">{c.topic}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          disabled={state.hints <= 0 || state.hintMode}
          onClick={useHint}
          className="rounded-lg border border-amber-500/50 bg-amber-900/30 px-4 py-2 text-sm text-amber-100 disabled:opacity-40"
        >
          비밀 돋보기 {state.hintMode ? '(카드 탭해 공개)' : `×${state.hints}`}
        </button>
        <p className="text-xs text-slate-500">
          {actor === 'player' ? '당신 차례' : '가상 플레이어 차례'}
        </p>
      </div>
    </div>
  )
}

function BotStack({ name, hand, botKey, hintMode, revealed, onReveal }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2">
      <p className="text-center text-xs text-slate-400">{name}</p>
      <div className="mt-2 flex gap-1">
        {hand.map((c) => {
          const rid = `${botKey}-${c.id}`
          const show = revealed.has(rid)
          return (
            <button
              key={c.id}
              type="button"
              className={`h-14 w-10 rounded border text-xs ${
                hintMode
                  ? 'border-amber-400 bg-amber-950/50'
                  : 'border-slate-600 bg-slate-800'
              }`}
              onClick={() => onReveal(botKey, c.id)}
            >
              {show ? c.topic : '?'}
            </button>
          )
        })}
      </div>
    </div>
  )
}

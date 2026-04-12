/**
 * Web Audio 기반 효과음 (외부 파일 없음 — 라이선스 이슈 최소화)
 * 하스스톤 느낌: 짧은 타격·종소리·저음 페널티
 */

let audioCtx = /** @type {AudioContext | null} */ (null)

function ctx() {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return null
    audioCtx = new Ctx()
  }
  return audioCtx
}

/** 사용자 제스처 후 첫 재생에서 AudioContext resume */
async function ensureRunning(c) {
  if (c && c.state === 'suspended') {
    try {
      await c.resume()
    } catch {
      /* noop */
    }
  }
}

/**
 * @param {number} freq
 * @param {number} dur
 * @param {'sine'|'triangle'|'square'} type
 * @param {number} vol 0~0.3
 */
function beep(freq, dur, type, vol) {
  const c = ctx()
  if (!c) return
  void ensureRunning(c)
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, c.currentTime)
  g.gain.setValueAtTime(0, c.currentTime)
  g.gain.linearRampToValueAtTime(vol, c.currentTime + 0.02)
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur)
  o.connect(g)
  g.connect(c.destination)
  o.start(c.currentTime)
  o.stop(c.currentTime + dur + 0.05)
}

/** 카드 합쳐짐 / 정답 제출 */
export function sfxMerge() {
  beep(523.25, 0.12, 'sine', 0.12)
  window.setTimeout(() => beep(659.25, 0.1, 'sine', 0.1), 40)
  window.setTimeout(() => beep(783.99, 0.14, 'triangle', 0.08), 85)
}

/** 페널티·흔들림 */
export function sfxPenalty() {
  beep(120, 0.22, 'square', 0.06)
  window.setTimeout(() => beep(90, 0.25, 'square', 0.05), 60)
}

/** 카운트다운 틱 */
export function sfxTick() {
  beep(880, 0.06, 'sine', 0.09)
}

/** 짧은 승리 팡 */
export function sfxVictoryBlip() {
  beep(392, 0.08, 'triangle', 0.07)
  window.setTimeout(() => beep(523.25, 0.12, 'sine', 0.08), 70)
}

/** 1페이즈 콤보 — 단계가 올라갈수록 살짝 높은 음으로 타격감 */
export function sfxCombo(combo) {
  const n = Math.max(1, Math.min(combo, 30))
  const base = 380 + n * 14
  beep(base, 0.055, 'triangle', 0.11)
  window.setTimeout(() => beep(base * 1.22, 0.065, 'sine', 0.1), 38)
  window.setTimeout(() => beep(base * 1.48, 0.08, 'sine', 0.085), 88)
  if (n >= 5) {
    window.setTimeout(() => beep(base * 1.75, 0.1, 'triangle', 0.06), 140)
  }
}

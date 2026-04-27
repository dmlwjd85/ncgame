/** @typedef {1} RunSaveVersion */
const STORAGE_KEY = 'ncgame-run-save-v1'
/** 이어하기 직후 세션에만 잠깐 두는 스냅샷(Strict Mode 이중 마운트 대비) */
let stagedResume = null

/**
 * @typedef {{
 *   v: RunSaveVersion,
 *   packId: string,
 *   botCount: number,
 *   level: number,
 *   lives: number,
 *   cheonryan: number,
 *   p1Combo: number,
 *   usedRowIds: (string|number)[],
 *   queueRowIds: (string|number)[],
 * }} GameRunSave
 */

/**
 * @returns {GameRunSave | null}
 */
export function loadRunSave() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const o = JSON.parse(raw)
    if (o?.v !== 1 || !o.packId) return null
    return o
  } catch {
    return null
  }
}

/** @param {GameRunSave} data */
export function saveRunSave(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    /* noop */
  }
}

export function clearRunSave() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* noop */
  }
}

/** 비로그인 플레이가 남긴 sessionStorage 스냅샷(이어하기) 정리 */
export function clearAllResumeFromSession() {
  try {
    const prefix = 'ncgame-resume-'
    const keys = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i)
      if (k && k.startsWith(prefix)) keys.push(k)
    }
    for (const k of keys) sessionStorage.removeItem(k)
  } catch {
    /* noop */
  }
}

/**
 * 홈에서 이어하기로 넘길 때 sessionStorage에 넣은 뒤, 게임 첫 진입에서 한 번 읽음.
 * @param {string} packId
 * @returns {GameRunSave | null}
 */
export function peekResumeFromSession(packId) {
  if (!packId) return null
  if (stagedResume && String(stagedResume.packId) === String(packId)) {
    return stagedResume
  }
  try {
    const key = `ncgame-resume-${packId}`
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const o = JSON.parse(raw)
    if (o?.v !== 1 || String(o.packId) !== String(packId)) return null
    sessionStorage.removeItem(key)
    stagedResume = o
    return o
  } catch {
    return null
  }
}

/** 새 게임 시작 시 이전 스테이징 무효화 */
export function clearStagedResume() {
  stagedResume = null
}

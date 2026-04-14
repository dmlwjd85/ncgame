/** 비로그인 기록 안내 — 세션당 1회 확인 저장 */
const KEY = 'ncgame-guest-record-warn'

export function hasGuestRecordWarningAck() {
  try {
    return sessionStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function setGuestRecordWarningAck() {
  try {
    sessionStorage.setItem(KEY, '1')
  } catch {
    /* noop */
  }
}

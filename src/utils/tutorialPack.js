/**
 * 단어팩 시트명이 튜토리얼인지
 * @param {{ sheetName?: string } | null | undefined} pack
 */
export function isTutorialPack(pack) {
  return String(pack?.sheetName ?? '').trim() === '튜토리얼'
}

/**
 * 목록·라벨용 표시 이름 — 엑셀 시트명 '튜토리얼'은 UI에서 '따라하기'
 * @param {{ sheetName?: string } | null | undefined} pack
 */
export function displaySheetName(pack) {
  const sn = String(pack?.sheetName ?? '').trim()
  if (sn === '튜토리얼') return '따라하기'
  return sn || '—'
}

/**
 * 무한도전 도전모드 — 랜덤 포인트 도전 팝업에 포함할 수 있는 팩인지(시트명 기준).
 * 튜토리얼·동물·식물 시트는 제외.
 * @param {{ sheetName?: string } | null | undefined} pack
 */
export function isComboPointEligiblePack(pack) {
  const sn = String(pack?.sheetName ?? '').trim()
  if (sn === '튜토리얼' || sn === '동물' || sn === '식물') return false
  return true
}

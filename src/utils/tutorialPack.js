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

/**
 * 단어팩 시트명이 튜토리얼인지
 * @param {{ sheetName?: string } | null | undefined} pack
 */
export function isTutorialPack(pack) {
  return String(pack?.sheetName ?? '').trim() === '튜토리얼'
}

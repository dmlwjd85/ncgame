/**
 * 1페이즈 덱 순서. 전근대사 100선 등은 엑셀 행(id) 순, 그 외는 무작위.
 * parseExcelCardPack 의 id는 시트 위에서부터 1,2,3… (행 순서).
 * @param {object[]} rows
 * @param {'topic'|'sheet'} phase2OrderMode — Game.jsx 의 phase2OrderMode 와 동일
 * @returns {object[]}
 */
export function orderPhase1DeckRows(rows, phase2OrderMode) {
  if (phase2OrderMode === 'sheet') {
    return [...rows].sort(
      (a, b) => Number(a?.id ?? 0) - Number(b?.id ?? 0),
    )
  }
  const a = [...rows]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

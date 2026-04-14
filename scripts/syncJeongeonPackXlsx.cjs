/**
 * 소스 카드 데이터(jeongeon100Cards.cjs)를 그대로 반영해
 * ncxlxs/pack__ncxlsx__전근대사_100선.xlsx 를 덮어씁니다.
 * (appendJeongeonSheet.cjs 가 넣는 ncxlsx.xlsx 시트와 동일 데이터)
 */
const XLSX = require('xlsx')
const path = require('path')

const CARDS = require('./jeongeon100Cards.cjs')
const SHEET = '전근대사 100선'
const OUT = path.join(__dirname, '..', 'ncxlxs', 'pack__ncxlsx__전근대사_100선.xlsx')

if (!Array.isArray(CARDS) || CARDS.length !== 100) {
  throw new Error(`jeongeon100Cards.cjs 는 100개 항목이어야 합니다. (현재 ${CARDS?.length})`)
}

const rows = CARDS.map(([주제어, 해설]) => ({
  주제어,
  해설,
  난이도: '중',
  '학년/팩이름': '전근대사 100선',
}))
const ws = XLSX.utils.json_to_sheet(rows)
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, SHEET)
XLSX.writeFile(wb, OUT)
console.log('OK:', OUT, '→', SHEET, CARDS.length, '행')

/**
 * ncxlsx.xlsx에 「전근대사 100선」 시트 추가(이미 있으면 제거 후 다시 추가)
 * 주제어·해설 본문은 scripts/jeongeon100Cards.cjs 에서 관리합니다.
 */
const XLSX = require('xlsx')
const path = require('path')

const CARDS = require('./jeongeon100Cards.cjs')

const files = [
  path.join(__dirname, '..', 'ncxlxs', 'ncxlsx.xlsx'),
  path.join(__dirname, '..', 'ncxlxs', '_sources', 'ncxlsx.xlsx'),
]

const SHEET = '전근대사 100선'

function appendToFile(filePath) {
  if (!Array.isArray(CARDS) || CARDS.length !== 100) {
    throw new Error(`jeongeon100Cards.cjs 는 100개 항목이어야 합니다. (현재 ${CARDS?.length})`)
  }
  const wb = XLSX.readFile(filePath)
  if (wb.SheetNames.includes(SHEET)) {
    delete wb.Sheets[SHEET]
    wb.SheetNames = wb.SheetNames.filter((n) => n !== SHEET)
  }
  const rows = CARDS.map(([주제어, 해설]) => ({
    주제어,
    해설,
    난이도: '중',
    '학년/팩이름': '전근대사 100선',
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, SHEET)
  XLSX.writeFile(wb, filePath)
  console.log('OK:', filePath, '→ 시트', SHEET)
}

for (const f of files) {
  appendToFile(f)
}

/**
 * ncxlsx.xlsx에 「전근대사 100선」 시트 추가(이미 있으면 제거 후 다시 추가)
 */
const XLSX = require('xlsx')
const path = require('path')

const files = [
  path.join(__dirname, '..', 'ncxlxs', 'ncxlsx.xlsx'),
  path.join(__dirname, '..', 'ncxlxs', '_sources', 'ncxlsx.xlsx'),
]

const SHEET = '전근대사 100선'

function appendToFile(filePath) {
  const wb = XLSX.readFile(filePath)
  if (wb.SheetNames.includes(SHEET)) {
    delete wb.Sheets[SHEET]
    wb.SheetNames = wb.SheetNames.filter((n) => n !== SHEET)
  }
  const rows = []
  for (let i = 1; i <= 100; i++) {
    rows.push({
      주제어: `전근대사 ${i}`,
      해설: `근·현대 한국사 인물·사건·구호 등 발췌 ${i}번 (내용을 수정해 사용하세요)`,
      난이도: '중',
      '학년/팩이름': '전근대사 100선',
    })
  }
  const ws = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, SHEET)
  XLSX.writeFile(wb, filePath)
  console.log('OK:', filePath, '→ 시트', SHEET)
}

for (const f of files) {
  appendToFile(f)
}

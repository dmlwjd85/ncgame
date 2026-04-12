import * as XLSX from 'xlsx'

/**
 * 엑셀 첫 시트를 파싱하여 카드팩 행 배열로 변환합니다.
 * 필수 컬럼: 주제어, 해설, 학년/팩이름, 난이도
 *
 * @param {ArrayBuffer} arrayBuffer - .xlsx 파일의 ArrayBuffer
 * @returns {{ rows: object[], sheetName: string, missingColumns: string[] }}
 */
export function parseExcelCardPack(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true })
  const sheetName = workbook.SheetNames[0] ?? ''
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) {
    return { rows: [], sheetName, missingColumns: ['시트 없음'] }
  }

  const rawRows = XLSX.utils.sheet_to_json(sheet, {
    defval: '',
    raw: false,
    blankrows: false,
  })

  const required = ['주제어', '해설', '학년/팩이름', '난이도']
  const headerSample = rawRows[0] ?? {}
  const keys = Object.keys(headerSample).map((k) => String(k).trim())
  const missingColumns = required.filter((col) => !keys.includes(col))

  const rows = rawRows.map((row, index) => ({
    id: index + 1,
    topic: String(row['주제어'] ?? '').trim(),
    explanation: String(row['해설'] ?? '').trim(),
    packLabel: String(row['학년/팩이름'] ?? '').trim(),
    difficulty: String(row['난이도'] ?? '').trim(),
  }))

  return { rows, sheetName, missingColumns }
}

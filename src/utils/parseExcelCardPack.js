import * as XLSX from 'xlsx'

const REQUIRED_CORE = ['주제어', '해설', '난이도']

function packLabelFromRow(row) {
  return String(row['학년/팩이름'] ?? row['팩이름'] ?? '').trim()
}

function rowsFromSheet(sheet) {
  const rawRows = XLSX.utils.sheet_to_json(sheet, {
    defval: '',
    raw: false,
    blankrows: false,
  })
  const headerSample = rawRows[0] ?? {}
  const keys = Object.keys(headerSample).map((k) => String(k).trim())
  const hasPackCol =
    keys.includes('학년/팩이름') || keys.includes('팩이름')
  const missingColumns = REQUIRED_CORE.filter((col) => !keys.includes(col))
  if (!hasPackCol) {
    missingColumns.push('학년/팩이름 또는 팩이름')
  }
  const rows = rawRows.map((row, index) => ({
    id: index + 1,
    topic: String(row['주제어'] ?? '').trim(),
    explanation: String(row['해설'] ?? '').trim(),
    packLabel: packLabelFromRow(row),
    difficulty: String(row['난이도'] ?? '').trim(),
  }))
  return { rows, missingColumns }
}

/**
 * 엑셀 첫 시트를 파싱하여 카드팩 행 배열로 변환합니다.
 * 필수 컬럼: 주제어, 해설, 난이도, 학년/팩이름 또는 팩이름
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
  const { rows, missingColumns } = rowsFromSheet(sheet)
  return { rows, sheetName, missingColumns }
}

/**
 * 통합 문서의 시트마다 별도 카드팩으로 파싱합니다.
 * @param {ArrayBuffer} arrayBuffer
 * @param {string} [sourceFileName] - 로그용 파일명
 * @returns {{ packs: { sheetName: string, rows: object[], missingColumns: string[] }[], sourceFileName: string }}
 */
export function parseWorkbookAllSheets(arrayBuffer, sourceFileName = '') {
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true })
  const packs = []
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) continue
    const { rows, missingColumns } = rowsFromSheet(sheet)
    packs.push({ sheetName, rows, missingColumns })
  }
  return { packs, sourceFileName }
}

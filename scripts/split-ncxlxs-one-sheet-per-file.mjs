/**
 * 통합 .xlsx를 시트마다 별도 파일(각 파일에 시트 1개)로 나누고 manifest.json을 갱신합니다.
 * 원본은 ncxlxs/_sources/에 두고 유지합니다(삭제하지 않음).
 * 실행: node scripts/split-ncxlxs-one-sheet-per-file.mjs
 */
import * as XLSX from 'xlsx'
import {
  existsSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ncxlxsRoot = join(__dirname, '..', 'ncxlxs')
const sourcesDir = join(ncxlxsRoot, '_sources')

/** 이 스크립트가 한 번에 나누는 통합 엑셀 목록(파일명 기준, _sources 기준) */
const SOURCE_FILES = ['ncxlsx.xlsx', 'pack_extra_elementary.xlsx']

function slugifySheetName(name) {
  return String(name)
    .trim()
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '_')
}

function parentSlug(filename) {
  return filename.replace(/\.xlsx$/i, '').replace(/[^a-zA-Z0-9_가-힣]/g, '_')
}

function main() {
  const outNames = []

  for (const src of SOURCE_FILES) {
    const srcPath = join(sourcesDir, src)
    if (!existsSync(srcPath)) {
      console.warn('건너뜀 (파일 없음):', src)
      continue
    }
    const buf = readFileSync(srcPath)
    const wb = XLSX.read(buf, { type: 'buffer' })
    const pslug = parentSlug(src)
    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName]
      if (!sheet) continue
      const newWb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(newWb, sheet, sheetName)
      const outBase = `pack__${pslug}__${slugifySheetName(sheetName)}.xlsx`
      outNames.push(outBase)
      writeFileSync(
        join(ncxlxsRoot, outBase),
        XLSX.write(newWb, { bookType: 'xlsx', type: 'buffer' }),
      )
      console.log('작성:', outBase, '← 시트:', sheetName)
    }
  }

  if (outNames.length === 0) {
    console.error(
      '분할할 소스 엑셀이 없습니다. ncxlxs/_sources에',
      SOURCE_FILES.join(', '),
      '를 두세요.',
    )
    process.exit(1)
  }

  for (const name of readdirSync(ncxlxsRoot)) {
    if (!name.endsWith('.xlsx')) continue
    if (name.startsWith('_')) continue
    if (name.startsWith('pack__') && !outNames.includes(name)) {
      unlinkSync(join(ncxlxsRoot, name))
      console.log('삭제(이전 분할본):', name)
    }
  }

  outNames.sort()
  writeFileSync(
    join(ncxlxsRoot, 'manifest.json'),
    `${JSON.stringify({ files: outNames }, null, 2)}\n`,
    'utf8',
  )
  console.log('manifest.json 갱신 완료 · 단어팩', outNames.length, '개(시트당 1파일)')
}

main()

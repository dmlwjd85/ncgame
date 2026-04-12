/**
 * 통합 .xlsx를 시트마다 별도 파일(각 파일에 시트 1개)로 나누고 manifest.json을 갱신합니다.
 *
 * 정본 엑셀 위치(우선순위):
 * 1) ncxlxs/_sources/ncxlsx.xlsx — 있으면 최우선(시트명 = 단어팩 이름)
 * 2) 없으면 ncxlxs/ncxlsx.xlsx
 * 3) 그 외 ncxlxs/_sources/*.xlsx
 * 분할 전에 정본끼리 서로 미러 복사해 두어 루트·소스 경로를 맞춥니다.
 *
 * 실행: node scripts/split-ncxlxs-one-sheet-per-file.mjs
 */
import * as XLSX from 'xlsx'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from 'fs'
import { basename, join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ncxlxsRoot = join(__dirname, '..', 'ncxlxs')
const sourcesDir = join(ncxlxsRoot, '_sources')
const rootNcxlsx = join(ncxlxsRoot, 'ncxlsx.xlsx')
const sourcesNcxlsx = join(sourcesDir, 'ncxlsx.xlsx')

/** 루트·_sources 정본 엑셀 동기화(한쪽만 있으면 다른 쪽으로 복사) */
function syncNcxlsxMirrors() {
  const hasSources = existsSync(sourcesNcxlsx)
  const hasRoot = existsSync(rootNcxlsx)
  if (hasSources) {
    mkdirSync(ncxlxsRoot, { recursive: true })
    copyFileSync(sourcesNcxlsx, rootNcxlsx)
    console.log('미러:', rootNcxlsx, '←', sourcesNcxlsx)
    return
  }
  if (hasRoot) {
    mkdirSync(sourcesDir, { recursive: true })
    copyFileSync(rootNcxlsx, sourcesNcxlsx)
    console.log('미러:', sourcesNcxlsx, '←', rootNcxlsx)
  }
}

/**
 * 분할할 통합 엑셀 경로 목록(파일 단위)
 */
function listSourceWorkbookPaths() {
  const paths = []
  const hasSourcesMain = existsSync(sourcesNcxlsx)
  const hasRootMain = existsSync(rootNcxlsx)

  if (hasSourcesMain) {
    paths.push(sourcesNcxlsx)
  } else if (hasRootMain) {
    paths.push(rootNcxlsx)
  }

  if (existsSync(sourcesDir)) {
    const names = readdirSync(sourcesDir)
      .filter(
        (n) =>
          n.endsWith('.xlsx') &&
          !n.startsWith('~$') &&
          !n.startsWith('.'),
      )
      .sort()
    for (const n of names) {
      if (n === 'ncxlsx.xlsx') continue
      paths.push(join(sourcesDir, n))
    }
  }

  return paths
}

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
  syncNcxlsxMirrors()
  const sourcePaths = listSourceWorkbookPaths()

  for (const srcPath of sourcePaths) {
    const src = basename(srcPath)
    if (!existsSync(srcPath)) {
      console.warn('건너뜀 (파일 없음):', srcPath)
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
      '분할할 소스 엑셀이 없습니다. ncxlxs/_sources/ncxlsx.xlsx 또는 ncxlxs/ncxlsx.xlsx 를 두세요.',
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

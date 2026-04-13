import { parseWorkbookAllSheets } from '../utils/parseExcelCardPack'
import { publicUrl } from '../utils/publicUrl'

/**
 * manifest.json과 엑셀들을 불러와 시트 단위 카드팩 목록을 만듭니다.
 * @returns {Promise<{ packs: Array<{ id: string, sourceFile: string, sheetName: string, rows: object[], missingColumns: string[] }>, error: string | null }>}
 */
export async function loadNcxlxsPacks() {
  try {
    const manifestRes = await fetch(publicUrl('ncxlxs/manifest.json'), {
      cache: 'no-store',
    })
    if (!manifestRes.ok) {
      return {
        packs: [],
        error: `manifest.json을 불러올 수 없습니다 (${manifestRes.status}). ncxlxs/manifest.json을 확인하세요.`,
      }
    }
    const manifest = await manifestRes.json()
    const files = Array.isArray(manifest.files) ? manifest.files : []

    /** @type {import('../contexts/CardPackContext').CardPackMeta[]} */
    const packs = []

    for (const file of files) {
      if (!file || typeof file !== 'string' || !file.endsWith('.xlsx')) continue
      const url = publicUrl(`ncxlxs/${encodeURIComponent(file)}`)
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) {
        return {
          packs,
          error: `파일을 불러올 수 없습니다: ${file} (${res.status})`,
        }
      }
      const buf = await res.arrayBuffer()
      const { packs: sheetPacks, sourceFileName } = parseWorkbookAllSheets(
        buf,
        file,
      )
      for (const sp of sheetPacks) {
        const sn = String(sp.sheetName ?? '').trim()
        if (sn === '침묵의 가나다' || sn.includes('침묵의 가나다')) continue
        const id = `${file}::${sp.sheetName}`
        packs.push({
          id,
          sourceFile: sourceFileName || file,
          sheetName: sp.sheetName,
          rows: sp.rows,
          missingColumns: sp.missingColumns,
        })
      }
    }

    return { packs, error: null }
  } catch (e) {
    return {
      packs: [],
      error: e?.message ?? 'ncxlxs 카드팩 로드 중 오류가 발생했습니다.',
    }
  }
}

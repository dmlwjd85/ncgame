import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { parseWorkbookAllSheets } from '../../utils/parseExcelCardPack'

const PREVIEW_LIMIT = 30

/**
 * 마스터 전용: .xlsx 업로드 → 시트별 파싱 미리보기
 */
export default function AdminExcelUpload() {
  const [fileName, setFileName] = useState('')
  /** @type {Array<{ sheetName: string, rows: object[], missingColumns: string[] }>} */
  const [sheetPacks, setSheetPacks] = useState([])
  const [sheetIndex, setSheetIndex] = useState(0)
  const [parseError, setParseError] = useState(null)

  const reset = useCallback(() => {
    setFileName('')
    setSheetPacks([])
    setSheetIndex(0)
    setParseError(null)
  }, [])

  const onFile = useCallback(async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    reset()
    setFileName(file.name)

    if (!/\.xlsx$/i.test(file.name)) {
      setParseError('.xlsx 파일만 업로드할 수 있습니다.')
      return
    }

    try {
      const buffer = await file.arrayBuffer()
      const { packs } = parseWorkbookAllSheets(buffer, file.name)
      setSheetPacks(packs)
      setSheetIndex(0)
    } catch (e) {
      setParseError(e?.message ?? '파일을 읽는 중 오류가 발생했습니다.')
    }
  }, [reset])

  const current = sheetPacks[sheetIndex]
  const rows = current?.rows ?? []
  const sheetName = current?.sheetName ?? ''
  const missingColumns = current?.missingColumns ?? []
  const previewRows = rows.slice(0, PREVIEW_LIMIT)
  const hasMore = rows.length > PREVIEW_LIMIT

  return (
    <div className="min-h-dvh bg-slate-950 px-4 py-6 text-slate-100">
      <div className="mx-auto w-full max-w-lg">
        <p className="text-xs text-slate-500">
          <Link className="text-emerald-400 underline" to="/">
            ← 홈
          </Link>
        </p>
        <h1 className="mt-2 text-xl font-semibold">카드팩 엑셀 미리보기</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          파일 내 <span className="text-emerald-300/90">시트마다</span> 하나의
          팩으로 처리됩니다. 각 시트 첫 행에 컬럼명:{' '}
          <span className="text-slate-300">
            주제어 · 해설 · 학년/팩이름 또는 팩이름 · 난이도
          </span>
        </p>

        <label className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-600 bg-slate-900/80 px-4 py-10 transition hover:border-emerald-500/60 hover:bg-slate-900">
          <span className="text-sm font-medium text-slate-200">
            탭하여 .xlsx 선택
          </span>
          <span className="mt-1 text-xs text-slate-500">
            업로드 즉시 브라우저에서만 파싱됩니다.
          </span>
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={onFile}
          />
        </label>

        {fileName ? (
          <p className="mt-4 text-xs text-slate-500">선택한 파일: {fileName}</p>
        ) : null}

        {parseError ? (
          <p className="mt-4 rounded-xl border border-rose-500/40 bg-rose-950/50 px-3 py-2 text-sm text-rose-200">
            {parseError}
          </p>
        ) : null}

        {sheetPacks.length > 1 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {sheetPacks.map((p, i) => (
              <button
                key={`${p.sheetName}-${i}`}
                type="button"
                className={`rounded-lg border px-3 py-1.5 text-xs ${
                  i === sheetIndex
                    ? 'border-emerald-500/60 bg-emerald-900/30 text-emerald-100'
                    : 'border-slate-600 text-slate-400'
                }`}
                onClick={() => setSheetIndex(i)}
              >
                {p.sheetName}
              </button>
            ))}
          </div>
        ) : null}

        {missingColumns.length > 0 ? (
          <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-950/40 px-3 py-2 text-sm text-amber-100">
            <p className="font-medium">필수 컬럼 누락 (현재 시트)</p>
            <ul className="mt-1 list-inside list-disc text-amber-200/90">
              {missingColumns.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {rows.length > 0 ? (
          <>
            <p className="mt-6 text-sm text-slate-400">
              시트: <span className="text-slate-200">{sheetName || '—'}</span>{' '}
              · 총{' '}
              <span className="font-medium text-emerald-300">{rows.length}</span>
              행
            </p>

            <div className="mt-3 overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full min-w-[320px] text-left text-xs">
                <thead className="bg-slate-900/90 text-slate-400">
                  <tr>
                    <th className="px-2 py-2 font-medium">#</th>
                    <th className="px-2 py-2 font-medium">주제어</th>
                    <th className="px-2 py-2 font-medium">해설</th>
                    <th className="px-2 py-2 font-medium">학년/팩</th>
                    <th className="px-2 py-2 font-medium">난이도</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-200">
                  {previewRows.map((r) => (
                    <tr key={r.id} className="align-top">
                      <td className="px-2 py-2 text-slate-500">{r.id}</td>
                      <td className="max-w-[5rem] px-2 py-2 break-words">
                        {r.topic || '—'}
                      </td>
                      <td className="max-w-[10rem] px-2 py-2 break-words text-slate-300">
                        {r.explanation || '—'}
                      </td>
                      <td className="max-w-[5rem] px-2 py-2 break-words">
                        {r.packLabel || '—'}
                      </td>
                      <td className="px-2 py-2">{r.difficulty || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {hasMore ? (
              <p className="mt-2 text-center text-xs text-slate-500">
                미리보기는 상위 {PREVIEW_LIMIT}행만 표시합니다.
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  )
}

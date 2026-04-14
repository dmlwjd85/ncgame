/**
 * 비로그인 플레이 시 기록 미저장 안내 (세션당 최초 1회)
 */
export default function GuestRecordWarningModal({
  open,
  onClose,
  onPlayAnyway,
  onGoLogin,
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guest-warn-title"
    >
      <div className="w-full max-w-sm rounded-2xl border border-amber-200/90 bg-gradient-to-b from-amber-50 to-white px-5 py-5 shadow-xl">
        <h2
          id="guest-warn-title"
          className="text-lg font-bold text-slate-900"
        >
          안내
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-700">
          로그인하지 않으면 명예의 전당·포인트·무한도전 도전 기록 등이{' '}
          <span className="font-semibold text-amber-900">저장되지 않습니다</span>.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            className="w-full rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 py-3 text-sm font-semibold text-white shadow-md"
            onClick={onGoLogin}
          >
            로그인하러 가기
          </button>
          <button
            type="button"
            className="w-full rounded-xl border border-slate-300 bg-white py-3 text-sm font-medium text-slate-800"
            onClick={onPlayAnyway}
          >
            그래도 시작
          </button>
          <button
            type="button"
            className="w-full py-2 text-xs text-slate-500 underline underline-offset-2"
            onClick={onClose}
          >
            취소
          </button>
        </div>
      </div>
    </div>
  )
}

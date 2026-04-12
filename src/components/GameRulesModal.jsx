/**
 * 초등 저학년도 읽기 쉬운 게임 설명 (팝업)
 */
export default function GameRulesModal({ open, onClose }) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/35 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rules-title"
      onClick={onClose}
    >
      <div
        className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-3xl border border-amber-200 bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="rules-title" className="text-lg font-bold text-slate-900">
          게임 설명서
        </h2>
        <ul className="mt-4 space-y-3 text-sm leading-relaxed text-slate-700">
          <li>
            <span className="font-semibold text-sky-600">① 맞추기</span>
            <br />
            위에 뜻, 아래에 단어가 있어요. 아래 단어를 잠깐 누른 뒤, 맞는 뜻으로
            위로 끌어 올려요. 맞추면 단어와 뜻이 한 장이 돼요.
            <br />
            <span className="text-slate-500">
              (맨 위에서 아래로 쓸면 새로고침이 될 수 있어, 단어는 아래에
              두었어요.)
            </span>
          </li>
          <li>
            <span className="font-semibold text-violet-700">② 순서 맞추기</span>
            <br />
            국어(한글) → 영어 → 숫자 순으로, 앞선 카드보다 뒤에 오는 주제어만 낼 수
            있어요. 타이밍이 중요해요.
          </li>
          <li>
            <span className="font-semibold text-rose-600">하트</span>가 모두
            없어지면 끝이에요.
          </li>
          <li>
            <span className="font-semibold text-amber-700">천리안</span>을 쓰면
            상대 카드 한 장만 탭해서 잠깐 볼 수 있어요. 그 순간부터 시간이 다시
            흘러요.
          </li>
          <li>
            단계가 올라갈수록 카드가 많아지고, 주어진 시간도 조금씩 늘어나요.
          </li>
        </ul>
        <button
          type="button"
          className="mt-6 w-full rounded-2xl border border-slate-300 bg-amber-50 py-3 text-sm font-medium text-slate-800"
          onClick={onClose}
        >
          닫기
        </button>
      </div>
    </div>
  )
}

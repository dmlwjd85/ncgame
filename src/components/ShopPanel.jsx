import { useState } from 'react'
import { purchaseShopItem } from '../services/userShopService'
import { SHOP } from '../utils/userProgressConstants'
import { useUserProgress } from '../contexts/UserProgressContext'
import { useAuth } from '../contexts/AuthContext'

/**
 * 포인트 상점 — 생명·천리안·시작 레벨 스킵
 */
export default function ShopPanel() {
  const { user } = useAuth()
  const { points, refreshProgress } = useUserProgress()
  const [msg, setMsg] = useState('')
  const [pending, setPending] = useState(/** @type {string | null} */ (null))

  const buy = async (kind, cost) => {
    if (!user?.uid) {
      setMsg('로그인 후 이용할 수 있어요.')
      return
    }
    setMsg('')
    setPending(kind)
    try {
      const r = await purchaseShopItem(user.uid, kind, cost)
      if (r.ok) {
        setMsg('구매했어요.')
        await refreshProgress()
      } else {
        setMsg(r.message ?? '구매에 실패했습니다.')
      }
    } catch (e) {
      setMsg(e?.message ?? '오류가 났습니다.')
    } finally {
      setPending(null)
    }
  }

  if (!user) {
    return (
      <p className="text-sm text-slate-500">상점은 로그인한 뒤 이용할 수 있어요.</p>
    )
  }

  const row = (label, detail, price, kind) => (
    <div
      key={kind}
      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/90 bg-white/90 px-3 py-2.5"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-800">{label}</p>
        <p className="text-[11px] text-slate-500">{detail}</p>
      </div>
      <button
        type="button"
        disabled={pending != null || points < price}
        onClick={() => void buy(kind, price)}
        className="shrink-0 rounded-lg bg-gradient-to-r from-amber-600 to-rose-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
      >
        {pending === kind ? '…' : `${price} P`}
      </button>
    </div>
  )

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        레벨을 클리어할 때마다 그 레벨 번호만큼 포인트가 쌓입니다. (예: 3단계 클리어
        시 +3P)
      </p>
      {msg ? (
        <p className="rounded-lg border border-sky-200/80 bg-sky-50/90 px-3 py-2 text-xs text-sky-900">
          {msg}
        </p>
      ) : null}

      <div className="space-y-2">
        {row('1회용 생명력', '다음 게임 시작 시 생명 +1 (최대 5까지)', SHOP.disposableLife, 'disposableLife')}
        {row('1회용 천리안', '다음 게임 시작 시 천리안 +1', SHOP.disposableCheonryan, 'disposableCheonryan')}
        {row('영구 생명력', '시작 생명 상한 +1 (최대 2회 구매, 5칸까지)', SHOP.permanentLife, 'permanentLife')}
        {row('영구 천리안', '매 판 시작 천리안 +1 (누적)', SHOP.permanentCheonryan, 'permanentCheonryan')}
        {row('1레벨 건너뛰기', '다음 판을 2레벨부터 시작', SHOP.skipToLevel2, 'skipToLevel2')}
        {row('2레벨 건너뛰기', '다음 판을 3레벨부터 시작', SHOP.skipToLevel3, 'skipToLevel3')}
      </div>
    </div>
  )
}

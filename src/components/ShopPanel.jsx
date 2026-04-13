import { useState } from 'react'
import { SHOP_ITEMS } from '../config/shopConfig'
import { usePlayerProgressStore } from '../stores/playerProgressStore'
import { useAuth } from '../contexts/AuthContext'

/**
 * 포인트 상점 — 생명·천리안·시작 레벨 스킵
 * TEMPORARY / PERMANENT 타입은 `shopConfig` 기준으로 `buyItem`에서 처리
 */
export default function ShopPanel() {
  const { user } = useAuth()
  const points = usePlayerProgressStore((s) => s.permanent.points)
  const buyItem = usePlayerProgressStore((s) => s.buyItem)
  const [msg, setMsg] = useState('')
  const [pending, setPending] = useState(/** @type {string | null} */ (null))

  const buy = async (kind) => {
    if (!user?.uid) {
      setMsg('로그인 후 이용할 수 있어요.')
      return
    }
    setMsg('')
    setPending(kind)
    try {
      const r = await buyItem(user.uid, kind)
      if (r.ok) {
        setMsg('구매했어요.')
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
        {SHOP_ITEMS.map((item) => (
          <div
            key={item.kind}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/90 bg-white/90 px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800">{item.label}</p>
              <p className="text-[11px] text-slate-500">{item.detail}</p>
            </div>
            <button
              type="button"
              disabled={pending != null || points < item.price}
              onClick={() => void buy(item.kind)}
              className="shrink-0 rounded-lg bg-gradient-to-r from-amber-600 to-rose-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            >
              {pending === item.kind ? '…' : `${item.price} P`}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

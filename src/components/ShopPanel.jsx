import { useState } from 'react'
import { SHOP_ITEMS } from '../config/shopConfig'
import { usePlayerProgressStore } from '../stores/playerProgressStore'
import { useAuth } from '../contexts/AuthContext'
import ShopWoodSign from './ShopWoodSign'

/**
 * 포인트 상점 — 나무 간판 + 진열
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
      <p className="text-sm text-slate-600">
        상점은 로그인한 뒤 이용할 수 있어요.
      </p>
    )
  }

  return (
    <div className="shop-storefront rounded-2xl px-3 pb-5 pt-9 text-amber-50">
      <div className="px-2">
        <ShopWoodSign />
      </div>

      <p className="mx-auto mt-5 max-w-md text-center text-[13px] leading-relaxed text-amber-100/95">
        레벨을 클리어할 때마다
        <br />
        그 레벨 번호만큼
        <br />
        포인트가 쌓입니다.
        <span className="mt-2 block text-[11px] text-amber-200/95">
          (예: 3단계 클리어 시 +3P)
        </span>
      </p>

      {msg ? (
        <p className="mx-auto mt-3 max-w-md rounded-lg border border-amber-400/40 bg-black/20 px-3 py-2 text-center text-xs text-amber-50">
          {msg}
        </p>
      ) : null}

      <div className="mt-5 space-y-3">
        {SHOP_ITEMS.map((item) => (
          <div
            key={item.kind}
            className="shop-shelf-row flex flex-wrap items-center justify-between gap-3 px-3 py-3 text-slate-800"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{item.label}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-slate-600">
                {item.detail}
              </p>
            </div>
            <button
              type="button"
              disabled={pending != null || points < item.price}
              onClick={() => void buy(item.kind)}
              className="shop-buy-btn shrink-0 rounded-lg bg-gradient-to-b from-rose-600 to-rose-900 px-3 py-2 text-xs font-bold text-white transition disabled:opacity-40"
            >
              {pending === item.kind ? '…' : `${item.price} P`}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { SHOP_ITEMS } from '../config/shopConfig'
import { subscribeSambongShopMent } from '../services/sambongShopService'
import { usePlayerProgressStore } from '../stores/playerProgressStore'
import { useAuth } from '../contexts/AuthContext'
import { publicUrl } from '../utils/publicUrl'
import ShopWoodSign from './ShopWoodSign'

/**
 * 삼봉당 — 할아버지 + 말풍선(마스터 멘트)
 */
export default function ShopPanel() {
  const { user } = useAuth()
  const points = usePlayerProgressStore((s) => s.permanent.points)
  const buyItem = usePlayerProgressStore((s) => s.buyItem)
  const [msg, setMsg] = useState('')
  const [pending, setPending] = useState(/** @type {string | null} */ (null))
  const [bubbleMent, setBubbleMent] = useState('')

  useEffect(() => {
    const unsub = subscribeSambongShopMent(
      (m) => setBubbleMent(m),
      () => {},
    )
    return () => unsub()
  }, [])

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
    <div className="shop-storefront rounded-2xl px-3 pb-5 pt-6 text-amber-50">
      <div className="px-2">
        <ShopWoodSign />
      </div>

      <div className="mx-auto mt-6 flex max-w-lg flex-col gap-4 sm:flex-row sm:items-stretch">
        <div className="flex shrink-0 justify-center sm:w-[7.5rem]">
          <img
            src={publicUrl('images/sambong-grandpa.svg')}
            alt=""
            className="h-28 w-28 object-contain drop-shadow-md sm:h-32 sm:w-32"
            width={128}
            height={128}
          />
        </div>
        <div className="relative min-h-[5rem] flex-1 rounded-2xl border-2 border-amber-800/50 bg-amber-50 px-3 py-3 text-slate-900 shadow-inner">
          <div
            className="absolute -left-1.5 top-6 hidden h-4 w-4 rotate-45 border-b-0 border-l-2 border-t-2 border-amber-800/40 bg-amber-50 sm:block"
            aria-hidden
          />
          <p className="text-[13px] leading-relaxed whitespace-pre-wrap">
            {bubbleMent.trim() ? bubbleMent : '\u00a0'}
          </p>
        </div>
      </div>

      {msg ? (
        <p className="mx-auto mt-4 max-w-md rounded-lg border border-amber-400/40 bg-black/20 px-3 py-2 text-center text-xs text-amber-50">
          {msg}
        </p>
      ) : null}

      <div className="mt-6 space-y-3">
        {SHOP_ITEMS.map((item) => (
          <div
            key={item.kind}
            className="shop-shelf-row flex flex-wrap items-center justify-between gap-3 px-3 py-3 text-slate-800"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{item.label}</p>
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

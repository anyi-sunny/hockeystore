import { Link } from 'react-router-dom'
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../contexts/AuthContext'
import { useData } from '../contexts/DataContext'
import { formatMoney, lineItemUnitPrice, summarize } from '../utils/calculations'

export default function OrderSummaryPage() {
  const { session } = useAuth()
  const { orders, items, roster, settings, updateOrder, removeOrder } = useData()

  const player = roster.find((p) => p.id === session.playerId)
  const playerName = player?.name ?? 'your player'

  const ordersForPlayer = orders.filter((o) => o.playerId === session.playerId)
  const myOrders = ordersForPlayer.filter((o) => o.buyerName === session.buyerName)
  const othersOrders = ordersForPlayer.filter((o) => o.buyerName !== session.buyerName)

  const shippingKnown = settings.shippingTotal > 0

  // Most a single line for itemId+size may hold, given everything else already ordered
  // for that variant across all orders (so the totals can never exceed the admin's stock).
  function maxForLine(itemId, size, thisLineQty) {
    const item = items.find((i) => i.id === itemId)
    if (!item?.stock || Object.keys(item.stock).length === 0) return Infinity
    const stock = item.stock[size] ?? 0
    let total = 0
    for (const o of orders) for (const li of o.items) {
      if (li.itemId === itemId && li.size === size) total += li.quantity
    }
    return stock - (total - thisLineQty)
  }

  async function changeLine(order, idx, patch) {
    const cur = order.items[idx]
    if (patch.quantity != null) {
      if (patch.quantity < 1) return
      const max = maxForLine(cur.itemId, cur.size, cur.quantity)
      if (patch.quantity > max) {
        toast.error(`Only ${max} of size ${cur.size} available.`)
        return
      }
    }
    const next = order.items.map((li, i) => (i === idx ? { ...cur, ...patch } : li))
    try { await updateOrder(order.id, next) }
    catch (e) { toast.error(e.message || 'Could not update item.') }
  }

  async function removeLine(order, idx) {
    const next = order.items.filter((_, i) => i !== idx)
    try {
      if (next.length === 0) { await removeOrder(order.id); toast.success('Removed from your order') }
      else { await updateOrder(order.id, next); toast.success('Item removed') }
    } catch (e) {
      toast.error(e.message || 'Could not remove item.')
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
        <h1 className="text-2xl font-bold">My Order</h1>
        <Link to="/shop" className="btn btn-primary btn-sm"><Plus size={16} /> Add more items</Link>
      </div>
      <p className="text-stone-500 text-sm mb-6">
        Picking up under <span className="font-medium">{playerName}</span>
        {session.buyerName !== playerName && <> · ordered by {session.buyerName}</>}.
        This is your selection for the team order — no payment is taken here, and the admin
        places the real Lululemon order later.
      </p>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Your items</h2>
        {myOrders.length === 0 ? (
          <p className="text-stone-500 text-sm">
            You haven't added anything yet. <Link to="/shop" className="link">Go to the shop</Link>.
          </p>
        ) : (
          <div className="card p-4">
            <ul className="divide-y divide-stone-100">
              {myOrders.flatMap((order) =>
                order.items.map((li, idx) => {
                  const item = items.find((it) => it.id === li.itemId)
                  const unit = lineItemUnitPrice(li, item)
                  const atMax = li.quantity >= maxForLine(li.itemId, li.size, li.quantity)
                  return (
                    <li key={`${order.id}-${idx}`} className="py-3 flex items-center gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{item?.name ?? 'Item'} · size {li.size}</p>
                        {item?.embroideryAvailable && (
                          <label className="flex items-center gap-1.5 text-xs text-stone-500 mt-0.5 cursor-pointer select-none">
                            <input type="checkbox" checked={!!li.embroidery}
                              onChange={(e) => changeLine(order, idx, { embroidery: e.target.checked })}
                              className="accent-brand-600 w-3.5 h-3.5 cursor-pointer" />
                            Embroidered (+{formatMoney(item.embroideryCost)})
                          </label>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => changeLine(order, idx, { quantity: li.quantity - 1 })}
                          disabled={li.quantity <= 1}
                          className="btn btn-ghost btn-sm !px-2" title="Decrease"><Minus size={14} /></button>
                        <span className="w-7 text-center text-sm tabular-nums">{li.quantity}</span>
                        <button onClick={() => changeLine(order, idx, { quantity: li.quantity + 1 })}
                          disabled={atMax}
                          className="btn btn-ghost btn-sm !px-2" title={atMax ? 'No more left in this size' : 'Increase'}><Plus size={14} /></button>
                      </div>
                      <span className="w-16 text-right text-sm whitespace-nowrap">{formatMoney(unit * li.quantity)}</span>
                      <button onClick={() => removeLine(order, idx)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded p-1 transition-colors cursor-pointer" title="Remove">
                        <Trash2 size={15} />
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
            <CombinedTotals orders={myOrders} allOrders={orders} items={items}
              settings={settings} shippingKnown={shippingKnown} />
          </div>
        )}
      </section>

      {othersOrders.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-1">Others ordering under {playerName}</h2>
          <p className="text-stone-500 text-sm mb-3">
            These will be picked up under your name too. Only the person who added them (or an
            admin) can change them.
          </p>
          {Object.entries(groupByBuyer(othersOrders)).map(([buyer, buyerOrders]) => (
            <div key={buyer} className="mb-4">
              <h3 className="font-medium text-sm mb-2">{buyer}</h3>
              <ReadOnlyGroup orders={buyerOrders} allOrders={orders} items={items}
                settings={settings} shippingKnown={shippingKnown} />
            </div>
          ))}

          <div className="mt-6 bg-brand-50 border border-brand-100 rounded-xl p-4">
            <CombinedTotals
              label={`Combined total for ${playerName}`}
              orders={ordersForPlayer}
              allOrders={orders}
              items={items}
              settings={settings}
              shippingKnown={shippingKnown}
            />
          </div>
        </section>
      )}
    </div>
  )
}

function groupByBuyer(orders) {
  return orders.reduce((acc, o) => {
    ;(acc[o.buyerName] ??= []).push(o)
    return acc
  }, {})
}

function ReadOnlyGroup({ orders, allOrders, items, settings, shippingKnown }) {
  const lines = orders.flatMap((o) => o.items.map((li) => ({ ...li, orderId: o.id })))
  return (
    <div className="card p-4">
      <ul className="divide-y divide-stone-100">
        {lines.map((li, i) => {
          const item = items.find((it) => it.id === li.itemId)
          const unit = lineItemUnitPrice(li, item)
          return (
            <li key={i} className="py-2 flex items-center justify-between text-sm gap-2">
              <span>
                {li.quantity}× {item?.name ?? 'Item'} · size {li.size}
                {li.embroidery && <span className="text-stone-500"> · embroidered</span>}
              </span>
              <span className="whitespace-nowrap">{formatMoney(unit * li.quantity)}</span>
            </li>
          )
        })}
      </ul>
      <CombinedTotals orders={orders} allOrders={allOrders} items={items}
        settings={settings} shippingKnown={shippingKnown} />
    </div>
  )
}

function CombinedTotals({ label, orders, allOrders, items, settings, shippingKnown }) {
  const { subtotal, tax, shipping, total } = summarize(orders, allOrders, items, settings)
  return (
    <div className={`text-sm space-y-1 ${label ? '' : 'mt-3 pt-3 border-t border-stone-200'}`}>
      {label && <p className="font-medium mb-1">{label}</p>}
      <Row label="Subtotal" value={formatMoney(subtotal)} />
      <Row label={`Tax (${((settings.taxRate ?? 0) * 100).toFixed(0)}%)`} value={formatMoney(tax)} />
      {shippingKnown ? (
        <Row label="Shipping (your share)" value={formatMoney(shipping)} />
      ) : (
        <Row label="Shipping" value="+ TBD" muted />
      )}
      <div className="flex justify-between font-semibold pt-1 border-t border-stone-200 mt-1 text-brand-800">
        <span>Total{shippingKnown ? '' : ' (before shipping)'}</span>
        <span>{formatMoney(total)}{shippingKnown ? '' : ' + shipping'}</span>
      </div>
    </div>
  )
}

function Row({ label, value, muted }) {
  return (
    <div className="flex justify-between">
      <span className="text-stone-500">{label}</span>
      <span className={muted ? 'text-stone-400' : ''}>{value}</span>
    </div>
  )
}

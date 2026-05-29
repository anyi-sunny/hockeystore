import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useData } from '../contexts/DataContext'
import { formatMoney, lineItemUnitPrice, orderSubtotal, summarize } from '../utils/calculations'

export default function OrderSummaryPage() {
  const { session } = useAuth()
  const { orders, items, roster, settings } = useData()

  const player = roster.find((p) => p.id === session.playerId)
  const playerName = player?.name ?? 'your player'

  const ordersForPlayer = orders.filter((o) => o.playerId === session.playerId)
  const myOrders = ordersForPlayer.filter((o) => o.buyerName === session.buyerName)
  const othersOrders = ordersForPlayer.filter((o) => o.buyerName !== session.buyerName)

  const shippingKnown = settings.shippingTotal > 0

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Order Summary</h1>
      <p className="text-stone-500 text-sm mb-6">
        Picking up under <span className="font-medium">{playerName}</span>
        {session.buyerName !== playerName && <> · ordered by {session.buyerName}</>}
      </p>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Your order</h2>
        {myOrders.length === 0 ? (
          <p className="text-stone-500 text-sm">
            You haven't placed an order yet. <Link to="/shop" className="link">Go to the shop</Link>.
          </p>
        ) : (
          <OrderGroup orders={myOrders} allOrders={orders} items={items} settings={settings}
            shippingKnown={shippingKnown} />
        )}
      </section>

      {othersOrders.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-1">Others ordering under {playerName}</h2>
          <p className="text-stone-500 text-sm mb-3">
            These orders will be picked up under your name too.
          </p>
          {Object.entries(groupByBuyer(othersOrders)).map(([buyer, buyerOrders]) => (
            <div key={buyer} className="mb-4">
              <h3 className="font-medium text-sm mb-2">{buyer}</h3>
              <OrderGroup orders={buyerOrders} allOrders={orders} items={items} settings={settings}
                shippingKnown={shippingKnown} />
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

function OrderGroup({ orders, allOrders, items, settings, shippingKnown }) {
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

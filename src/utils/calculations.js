export function orderItemCount(order) {
  return order.items.reduce((sum, li) => sum + li.quantity, 0)
}

export function lineItemUnitPrice(li, item) {
  if (!item) return 0
  const embCost = li.embroidery ? (item.embroideryCost ?? 0) : 0
  return item.price + embCost
}

export function orderSubtotal(order, items) {
  return order.items.reduce((sum, li) => {
    const item = items.find(i => i.id === li.itemId)
    return sum + lineItemUnitPrice(li, item) * li.quantity
  }, 0)
}

export function shippingShareForOrders(subsetOrders, allOrders, shippingTotal) {
  if (!shippingTotal || shippingTotal <= 0) return 0
  const totalCount = allOrders.reduce((s, o) => s + orderItemCount(o), 0)
  if (totalCount === 0) return 0
  const myCount = subsetOrders.reduce((s, o) => s + orderItemCount(o), 0)
  return (myCount / totalCount) * shippingTotal
}

export function summarize(subsetOrders, allOrders, items, settings) {
  const subtotal = subsetOrders.reduce((s, o) => s + orderSubtotal(o, items), 0)
  const tax = subtotal * (settings.taxRate ?? 0)
  const shipping = shippingShareForOrders(subsetOrders, allOrders, settings.shippingTotal)
  return { subtotal, tax, shipping, total: subtotal + tax + shipping }
}

export function formatMoney(n) {
  if (typeof n !== 'number' || isNaN(n)) return '$0.00'
  return `$${n.toFixed(2)}`
}

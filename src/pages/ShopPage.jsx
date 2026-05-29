import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, ShoppingBag, X } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../contexts/AuthContext'
import { useData } from '../contexts/DataContext'
import { formatMoney, lineItemUnitPrice } from '../utils/calculations'
import ItemEditorModal from '../components/ItemEditorModal'

export default function ShopPage() {
  const { session } = useAuth()
  const { items, orders, addItem, updateItem, removeItem, submitOrder, settings } = useData()
  const isAdmin = session?.role === 'admin'
  const nav = useNavigate()

  const [editing, setEditing] = useState(null) // item being edited, or 'new'
  const [cart, setCart] = useState([]) // { itemId, size, embroidery, quantity }
  const [placing, setPlacing] = useState(false)

  // Units of a given item+size already locked in by placed orders (embroidered or not —
  // it's the same physical garment, so both draw down the same stock).
  function orderedQty(itemId, size) {
    let q = 0
    for (const o of orders) for (const li of o.items) {
      if (li.itemId === itemId && li.size === size) q += li.quantity
    }
    return q
  }
  // Units of an item+size sitting in this buyer's cart but not yet submitted.
  function cartQty(itemId, size) {
    return cart.reduce((s, l) => (l.itemId === itemId && l.size === size ? s + l.quantity : s), 0)
  }

  function addToCart(line) {
    const item = items.find((i) => i.id === line.itemId)
    const tracksStock = item?.stock && Object.keys(item.stock).length > 0
    let note = 'Added to your order'
    if (tracksStock) {
      const stock = item.stock[line.size] ?? 0
      const remaining = stock - orderedQty(line.itemId, line.size) - cartQty(line.itemId, line.size)
      if (remaining <= 0) {
        toast.error(`Size ${line.size} of ${item.name} is sold out.`)
        return
      }
      if (line.quantity > remaining) {
        line = { ...line, quantity: remaining }
        note = `Only ${remaining} left in size ${line.size} — added ${remaining}.`
      }
    }
    setCart((prev) => {
      const idx = prev.findIndex(
        (l) => l.itemId === line.itemId && l.size === line.size && l.embroidery === line.embroidery
      )
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], quantity: next[idx].quantity + line.quantity }
        return next
      }
      return [...prev, line]
    })
    toast.success(note)
  }

  function removeFromCart(idx) {
    setCart((prev) => prev.filter((_, i) => i !== idx))
  }

  async function placeOrder() {
    if (cart.length === 0) return
    setPlacing(true)
    try {
      await submitOrder(session.playerId, session.buyerName, cart)
      setCart([])
      toast.success('Order placed!', {
        description: 'View it any time under “My Order”.',
        action: { label: 'View order', onClick: () => nav('/summary') },
      })
    } catch (e) {
      toast.error(e.message || 'Could not place order.')
    } finally {
      setPlacing(false)
    }
  }

  async function saveItem(data) {
    try {
      if (editing === 'new') { await addItem(data); toast.success('Item added') }
      else { await updateItem(editing.id, data); toast.success('Item updated') }
    } catch (e) {
      toast.error(e.message || 'Could not save item.')
    }
  }

  async function deleteItem(item) {
    if (!confirm(`Delete "${item.name}"?`)) return
    try { await removeItem(item.id); toast.success('Item deleted') }
    catch (e) { toast.error(e.message || 'Could not delete item.') }
  }

  const cartTotal = cart.reduce((sum, l) => {
    const item = items.find((i) => i.id === l.itemId)
    return sum + lineItemUnitPrice(l, item) * l.quantity
  }, 0)

  return (
    <div className={!isAdmin && cart.length > 0 ? 'pb-40' : ''}>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Team Shop</h1>
          <p className="text-stone-500 text-sm">
            {isAdmin
              ? 'Add and edit items below. Players see this same catalog without edit controls.'
              : 'Pick your items, sizes, and embroidery, then place your order.'}
          </p>
        </div>
        {isAdmin && (
          <button onClick={() => setEditing('new')} className="btn btn-primary">
            <Plus size={18} /> Add item
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-stone-500">No items yet.{isAdmin ? ' Click "Add item" to create one.' : ' Check back soon.'}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              isAdmin={isAdmin}
              ordered={(size) => orderedQty(item.id, size)}
              onEdit={() => setEditing(item)}
              onDelete={() => deleteItem(item)}
              onAddToCart={addToCart}
            />
          ))}
        </div>
      )}

      {!isAdmin && cart.length > 0 && (
        <Cart cart={cart} items={items} total={cartTotal} taxRate={settings.taxRate}
          placing={placing} onRemove={removeFromCart} onPlace={placeOrder} />
      )}

      {editing && (
        <ItemEditorModal
          item={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={saveItem}
        />
      )}
    </div>
  )
}

function ItemCard({ item, isAdmin, ordered, onEdit, onDelete, onAddToCart }) {
  const tracksStock = item.stock && Object.keys(item.stock).length > 0
  // Units left for a size = admin's stock minus what's already been ordered.
  const remaining = (s) => (tracksStock ? (item.stock[s] ?? 0) - ordered(s) : null)
  const isOut = (s) => remaining(s) !== null && remaining(s) <= 0

  const [size, setSize] = useState(() => item.sizes.find((s) => !isOut(s)) ?? item.sizes[0] ?? '')
  const [embroidery, setEmbroidery] = useState(false)
  const [quantity, setQuantity] = useState(1)

  const unit = lineItemUnitPrice({ embroidery }, item)
  const selectedOut = isOut(size)
  const allOut = tracksStock && item.sizes.length > 0 && item.sizes.every((s) => isOut(s))

  function add() {
    if (!size || selectedOut) return
    onAddToCart({ itemId: item.id, size, embroidery, quantity: Number(quantity) || 1 })
  }

  return (
    <div className="card overflow-hidden flex flex-col">
      <div className="aspect-square bg-stone-100 flex items-center justify-center overflow-hidden">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-stone-300 text-sm">No image</span>
        )}
      </div>
      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium leading-tight">{item.name}</h3>
          <span className="font-semibold whitespace-nowrap text-brand-700">{formatMoney(item.price)}</span>
        </div>

        {item.embroideryAvailable && (
          <p className="text-xs text-stone-500 mt-0.5">+{formatMoney(item.embroideryCost)} embroidery</p>
        )}

        <div className="flex-1" />

        {isAdmin ? (
          <div className="mt-3 space-y-1">
            <p className="text-xs text-stone-500">Sizes: {item.sizes.join(', ') || '—'}</p>
            {tracksStock && (
              <p className="text-xs text-stone-500">
                Left: {item.sizes.map((s) => `${s} ${Math.max(0, remaining(s))}/${item.stock[s] ?? 0}`).join('  ')}
              </p>
            )}
            <div className="flex gap-2 pt-2">
              <button onClick={onEdit} className="btn btn-ghost btn-sm flex-1"><Pencil size={14} /> Edit</button>
              <button onClick={onDelete} className="btn btn-danger btn-sm"><Trash2 size={14} /> Delete</button>
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            <div className="flex gap-2">
              <select value={size} onChange={(e) => setSize(e.target.value)} className="select flex-1 text-sm py-1.5">
                {item.sizes.length === 0 && <option value="">No sizes</option>}
                {item.sizes.map((s) => {
                  const rem = remaining(s)
                  const out = rem !== null && rem <= 0
                  const low = rem !== null && rem > 0 && rem <= 3
                  const label = out ? `${s} — sold out` : low ? `${s} (${rem} left)` : s
                  return <option key={s} value={s} disabled={out}>{label}</option>
                })}
              </select>
              <input type="number" min="1" value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="input w-16 text-sm py-1.5" />
            </div>
            {item.embroideryAvailable && (
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input type="checkbox" checked={embroidery} onChange={(e) => setEmbroidery(e.target.checked)}
                  className="accent-brand-600 w-4 h-4 cursor-pointer" />
                Add embroidery (+{formatMoney(item.embroideryCost)})
              </label>
            )}
            <button onClick={add} disabled={!size || selectedOut} className="btn btn-primary w-full">
              {allOut ? 'Sold out' : selectedOut ? `Size ${size} sold out` : <><Plus size={16} /> Add to order · {formatMoney(unit)}</>}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function Cart({ cart, items, total, taxRate, placing, onRemove, onPlace }) {
  const tax = total * (taxRate ?? 0)
  return (
    <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-stone-200 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
      <div className="mx-auto max-w-6xl px-4 py-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm mb-1 flex items-center gap-1.5">
              <ShoppingBag size={15} className="text-brand-600" />
              Your cart ({cart.length} {cart.length === 1 ? 'line' : 'lines'})
            </p>
            <ul className="text-sm text-stone-600 space-y-0.5 max-h-28 overflow-y-auto">
              {cart.map((l, i) => {
                const item = items.find((it) => it.id === l.itemId)
                return (
                  <li key={i} className="flex items-center gap-2">
                    <span>{l.quantity}× {item?.name ?? 'Item'} · {l.size}{l.embroidery ? ' · embroidered' : ''}</span>
                    <button onClick={() => onRemove(i)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded p-0.5 transition-colors cursor-pointer"
                      title="Remove">
                      <X size={14} />
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
          <div className="text-right">
            <p className="text-sm text-stone-500">Subtotal {formatMoney(total)} · tax {formatMoney(tax)}</p>
            <p className="text-xs text-stone-400 mb-1">+ shipping (TBD)</p>
            <button onClick={onPlace} disabled={placing} className="btn btn-success btn-lg">
              <ShoppingBag size={18} />
              {placing ? 'Placing…' : `Place order · ${formatMoney(total + tax)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

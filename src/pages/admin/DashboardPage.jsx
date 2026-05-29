import { useEffect, useState } from 'react'
import { Store, Sparkles, ArrowLeftRight, Trash2, Lock, Unlock } from 'lucide-react'
import { toast } from 'sonner'
import { useData } from '../../contexts/DataContext'
import { api } from '../../api'
import {
  formatMoney, lineItemUnitPrice, orderItemCount, orderSubtotal, summarize,
} from '../../utils/calculations'

export default function DashboardPage() {
  const {
    orders, items, roster, settings, setSettings, removeOrder, activeStore,
  } = useData()
  const [view, setView] = useState('players') // 'players' | 'combined' | 'history'

  const grand = summarize(orders, orders, items, settings)

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-stone-500 text-sm">
            {activeStore?.name ?? 'Current store'} · {orders.length} order{orders.length === 1 ? '' : 's'} ·{' '}
            {orders.reduce((s, o) => s + orderItemCount(o), 0)} items
          </p>
        </div>
        <div className="flex rounded-lg border border-stone-300 overflow-hidden text-sm">
          <ViewBtn active={view === 'players'} onClick={() => setView('players')}>By team member</ViewBtn>
          <ViewBtn active={view === 'combined'} onClick={() => setView('combined')}>Combined order</ViewBtn>
          <ViewBtn active={view === 'history'} onClick={() => setView('history')}>Past orders</ViewBtn>
        </div>
      </div>

      <StoreManager />
      <LockToggle />

      {view === 'history' ? (
        <HistoryView />
      ) : (
        <>
          <SettingsBar settings={settings} setSettings={setSettings} grand={grand} orders={orders} />
          {orders.length === 0 ? (
            <p className="text-stone-500 mt-6">No orders placed yet for this store.</p>
          ) : view === 'players' ? (
            <PlayersView roster={roster} orders={orders} items={items} settings={settings} removeOrder={removeOrder} />
          ) : (
            <CombinedView orders={orders} items={items} settings={settings} grand={grand} />
          )}
        </>
      )}
    </div>
  )
}

// Lock/unlock ordering for everyone. When locked, buyers can view their orders
// and totals but can't add, edit, or remove anything (enforced by the API too).
function LockToggle() {
  const { settings, setSettings } = useData()
  const [busy, setBusy] = useState(false)
  const locked = !!settings.locked

  async function toggle() {
    setBusy(true)
    try {
      await setSettings({ locked: !locked })
      toast.success(locked ? 'Ordering re-opened' : 'Ordering locked')
    } catch (e) {
      toast.error(e.message || 'Could not update.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`card p-4 mb-4 flex items-center justify-between gap-3 flex-wrap border-l-4 ${locked ? 'border-l-red-500' : 'border-l-emerald-500'}`}>
      <div className="text-sm flex items-center gap-2">
        {locked ? <Lock size={16} className="text-red-600" /> : <Unlock size={16} className="text-emerald-600" />}
        <span className="text-stone-500">Ordering is</span>
        <span className={`font-semibold ${locked ? 'text-red-600' : 'text-emerald-600'}`}>{locked ? 'CLOSED' : 'OPEN'}</span>
        <span className="text-stone-400 hidden sm:inline">
          · {locked ? 'buyers can view totals but not change orders' : 'buyers can add and edit orders'}
        </span>
      </div>
      <button onClick={toggle} disabled={busy} className={`btn btn-sm ${locked ? 'btn-success' : 'btn-danger'}`}>
        {locked ? <><Unlock size={14} /> Re-open ordering</> : <><Lock size={14} /> Lock ordering</>}
      </button>
    </div>
  )
}

// Create a new store (renew) and switch which store is live for everyone.
function StoreManager() {
  const { stores, activeStoreId, activeStore, renewStore, switchStore } = useData()
  const [mode, setMode] = useState(null) // null | 'renew' | 'switch'
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  // renew state
  const suggested = `Lulu Order ${new Date().getFullYear() + 1}`
  const [newName, setNewName] = useState(suggested)
  const [renewConfirm, setRenewConfirm] = useState('')

  // switch state
  const [targetId, setTargetId] = useState('')
  const [switchConfirm, setSwitchConfirm] = useState('')
  const targetStore = stores.find((s) => s.id === targetId)

  function reset() {
    setMode(null); setErr(''); setBusy(false)
    setNewName(suggested); setRenewConfirm(''); setTargetId(''); setSwitchConfirm('')
  }

  async function doRenew() {
    setErr('')
    if (!newName.trim()) return setErr('Enter a name for the new store.')
    if (renewConfirm.trim().toLowerCase() !== 'renew') return setErr('Type "renew" to confirm.')
    setBusy(true)
    const name = newName.trim()
    try { await renewStore(name); reset(); toast.success(`“${name}” is now live`) }
    catch (e) { setErr(e.message || 'Failed to renew.'); setBusy(false) }
  }

  async function doSwitch() {
    setErr('')
    if (!targetStore) return setErr('Pick a store to switch to.')
    if (switchConfirm !== targetStore.name) return setErr('Type the store name exactly to confirm.')
    setBusy(true)
    const name = targetStore.name
    try { await switchStore(targetId); reset(); toast.success(`Switched to “${name}”`) }
    catch (e) { setErr(e.message || 'Failed to switch.'); setBusy(false) }
  }

  return (
    <div className="card p-4 mb-4 border-l-4 border-l-brand-500">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm flex items-center gap-2">
          <Store size={16} className="text-brand-600" />
          <span className="text-stone-500">Live store: </span>
          <span className="font-semibold">{activeStore?.name ?? '—'}</span>
          {stores.length > 1 && <span className="text-stone-400">· {stores.length} stores total</span>}
        </div>
        {mode === null && (
          <div className="flex gap-2">
            <button onClick={() => { reset(); setMode('switch') }}
              disabled={stores.length < 2}
              className="btn btn-ghost btn-sm"
              title={stores.length < 2 ? 'Only one store exists' : 'Switch the live store'}>
              <ArrowLeftRight size={14} /> Switch store
            </button>
            <button onClick={() => { reset(); setMode('renew') }} className="btn btn-primary btn-sm">
              <Sparkles size={14} /> Start new store (renew)
            </button>
          </div>
        )}
      </div>

      {mode === 'renew' && (
        <div className="mt-4 pt-4 border-t border-stone-100 space-y-3 max-w-md">
          <p className="text-sm text-stone-600">
            Creates a fresh copy of the current roster, items and tax settings under a new
            name. Orders are <strong>not</strong> carried over. The new store becomes live
            immediately.
          </p>
          <div>
            <label className="block text-xs text-stone-500 mb-1">New store name</label>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} className="input text-sm" />
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Type <code className="px-1 py-0.5 bg-stone-100 rounded">renew</code> to confirm</label>
            <input value={renewConfirm} onChange={(e) => setRenewConfirm(e.target.value)}
              placeholder="renew" className="input text-sm" />
          </div>
          {err && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}
          <div className="flex gap-2">
            <button onClick={doRenew} disabled={busy} className="btn btn-primary">
              <Sparkles size={16} /> {busy ? 'Creating…' : 'Create & make live'}
            </button>
            <button onClick={reset} disabled={busy} className="btn btn-ghost">Cancel</button>
          </div>
        </div>
      )}

      {mode === 'switch' && (
        <div className="mt-4 pt-4 border-t border-stone-100 space-y-3 max-w-md">
          <p className="text-sm text-stone-600">
            Changes which store everyone sees. To be safe, type the target store's exact
            name to confirm.
          </p>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Store to make live</label>
            <select value={targetId} onChange={(e) => { setTargetId(e.target.value); setSwitchConfirm('') }}
              className="select text-sm">
              <option value="">Select a store…</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.id === activeStoreId ? ' (currently live)' : ''}
                </option>
              ))}
            </select>
          </div>
          {targetStore && targetId !== activeStoreId && (
            <div>
              <label className="block text-xs text-stone-500 mb-1">
                Type <code className="px-1 py-0.5 bg-stone-100 rounded">{targetStore.name}</code> to confirm
              </label>
              <input value={switchConfirm} onChange={(e) => setSwitchConfirm(e.target.value)} className="input text-sm" />
            </div>
          )}
          {err && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}
          <div className="flex gap-2">
            <button onClick={doSwitch} disabled={busy || targetId === activeStoreId} className="btn btn-primary">
              <ArrowLeftRight size={16} /> {busy ? 'Switching…' : 'Confirm switch'}
            </button>
            <button onClick={reset} disabled={busy} className="btn btn-ghost">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

// Read-only view of any store's orders (admins only — enforced by the API).
function HistoryView() {
  const { stores, activeStoreId, adminPw } = useData()
  const [storeId, setStoreId] = useState('')
  const [data, setData] = useState(null) // { orders, items, roster, settings }
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [sub, setSub] = useState('players') // 'players' | 'combined'

  useEffect(() => {
    if (!storeId) { setData(null); return }
    let cancelled = false
    setLoading(true); setErr('')
    Promise.all([
      api.getOrders(storeId, adminPw),
      api.getItems(storeId),
      api.getRoster(storeId),
      api.getSettings(storeId),
    ])
      .then(([orders, items, roster, settings]) => {
        if (!cancelled) setData({ orders, items, roster, settings })
      })
      .catch((e) => { if (!cancelled) setErr(e.message || 'Failed to load store.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [storeId, adminPw])

  const grand = data ? summarize(data.orders, data.orders, data.items, data.settings) : null

  return (
    <div className="mt-2">
      <div className="card p-4 flex items-center gap-3 flex-wrap">
        <label className="text-sm text-stone-600">View orders from store:</label>
        <select value={storeId} onChange={(e) => setStoreId(e.target.value)}
          className="select text-sm w-auto">
          <option value="">Select a store…</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}{s.id === activeStoreId ? ' (live)' : ''}
            </option>
          ))}
        </select>
        {data && (
          <div className="flex rounded-lg border border-stone-300 overflow-hidden text-sm ml-auto">
            <ViewBtn active={sub === 'players'} onClick={() => setSub('players')}>By team member</ViewBtn>
            <ViewBtn active={sub === 'combined'} onClick={() => setSub('combined')}>Combined order</ViewBtn>
          </div>
        )}
      </div>

      {loading && <p className="text-stone-500 mt-6">Loading…</p>}
      {err && <p className="text-red-600 mt-6">{err}</p>}
      {data && !loading && (
        data.orders.length === 0 ? (
          <p className="text-stone-500 mt-6">No orders were placed in this store.</p>
        ) : sub === 'players' ? (
          <PlayersView roster={data.roster} orders={data.orders} items={data.items}
            settings={data.settings} removeOrder={null} />
        ) : (
          <CombinedView orders={data.orders} items={data.items} settings={data.settings} grand={grand} />
        )
      )}
    </div>
  )
}

function ViewBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} className={`seg ${active ? 'seg-on' : 'seg-off'}`}>
      {children}
    </button>
  )
}

function SettingsBar({ settings, setSettings, grand, orders }) {
  const [shipping, setShipping] = useState(String(settings.shippingTotal || ''))
  const [taxPct, setTaxPct] = useState(String((settings.taxRate ?? 0) * 100))

  async function apply() {
    try {
      await setSettings({
        shippingTotal: Number(shipping) || 0,
        taxRate: (Number(taxPct) || 0) / 100,
      })
      toast.success('Tax & shipping updated')
    } catch (e) {
      toast.error(e.message || 'Could not update settings.')
    }
  }

  const itemCount = orders.reduce((s, o) => s + orderItemCount(o), 0)

  return (
    <div className="card p-4 mt-4">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
        <div>
          <label className="block text-xs text-stone-500 mb-1">Tax rate (%)</label>
          <input type="number" min="0" step="0.1" value={taxPct} onChange={(e) => setTaxPct(e.target.value)}
            className="input text-sm" />
        </div>
        <div>
          <label className="block text-xs text-stone-500 mb-1">Total shipping ($)</label>
          <input type="number" min="0" step="0.01" value={shipping} onChange={(e) => setShipping(e.target.value)}
            placeholder="Enter once known"
            className="input text-sm" />
        </div>
        <button onClick={apply} className="btn btn-primary">Apply</button>
        <p className="text-xs text-stone-400">
          Shipping is split across {itemCount} item{itemCount === 1 ? '' : 's'} — buyers with
          more items pay proportionally more.
        </p>
      </div>

      <div className="flex gap-6 mt-4 pt-4 border-t border-stone-100 text-sm flex-wrap">
        <Stat label="Subtotal" value={formatMoney(grand.subtotal)} />
        <Stat label="Tax" value={formatMoney(grand.tax)} />
        <Stat label="Shipping" value={settings.shippingTotal > 0 ? formatMoney(grand.shipping) : 'TBD'} />
        <Stat label="Grand total" value={formatMoney(grand.total)} strong />
      </div>
    </div>
  )
}

function Stat({ label, value, strong }) {
  return (
    <div>
      <p className="text-xs text-stone-500">{label}</p>
      <p className={strong ? 'font-bold text-lg' : 'font-medium'}>{value}</p>
    </div>
  )
}

function PlayersView({ roster, orders, items, settings, removeOrder }) {
  const [expanded, setExpanded] = useState(null)

  const playersWithOrders = roster
    .map((p) => ({ player: p, orders: orders.filter((o) => o.playerId === p.id) }))
    .filter((g) => g.orders.length > 0)
    .sort((a, b) => a.player.name.localeCompare(b.player.name))

  if (playersWithOrders.length === 0) {
    return <p className="text-stone-500 mt-6">No orders yet.</p>
  }

  return (
    <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {playersWithOrders.map(({ player, orders: pOrders }) => {
        const { subtotal, total } = summarize(pOrders, orders, items, settings)
        const count = pOrders.reduce((s, o) => s + orderItemCount(o), 0)
        const isOpen = expanded === player.id
        return (
          <div key={player.id}
            className={`card p-4 ${isOpen ? 'border-brand-500 ring-1 ring-brand-200 sm:col-span-2 lg:col-span-3' : 'card-interactive'}`}
            onClick={() => !isOpen && setExpanded(player.id)}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{player.name}</h3>
                <p className="text-xs text-stone-500">
                  {count} item{count === 1 ? '' : 's'} · {pOrders.length} order{pOrders.length === 1 ? '' : 's'}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-brand-700">{formatMoney(total)}</p>
                <p className="text-xs text-stone-400">subtotal {formatMoney(subtotal)}</p>
              </div>
            </div>

            {isOpen && (
              <div className="mt-4 pt-4 border-t border-stone-100" onClick={(e) => e.stopPropagation()}>
                {pOrders.map((o) => (
                  <div key={o.id} className="mb-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">
                        Ordered by {o.buyerName}
                        {o.buyerName === player.name && <span className="text-stone-400"> (self)</span>}
                      </p>
                      {removeOrder && (
                        <button onClick={() => { if (confirm('Delete this order?')) removeOrder(o.id) }}
                          className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-1.5 py-0.5 rounded transition-colors cursor-pointer">
                          <Trash2 size={12} /> delete
                        </button>
                      )}
                    </div>
                    <ul className="text-sm text-stone-600 mt-1 space-y-0.5">
                      {o.items.map((li, i) => {
                        const item = items.find((it) => it.id === li.itemId)
                        return (
                          <li key={i} className="flex justify-between">
                            <span>{li.quantity}× {item?.name ?? 'Item'} · {li.size}{li.embroidery ? ' · embroidered' : ''}</span>
                            <span>{formatMoney(lineItemUnitPrice(li, item) * li.quantity)}</span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
                <button onClick={() => setExpanded(null)}
                  className="text-sm text-stone-500 hover:text-stone-900 mt-1 cursor-pointer transition-colors">
                  Collapse
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function CombinedView({ orders, items, settings, grand }) {
  // Aggregate every line item by item + size + embroidery so the admin can
  // order all quantities of each variant at once on lululemon.com.
  const map = new Map()
  for (const o of orders) {
    for (const li of o.items) {
      const key = `${li.itemId}|${li.size}|${li.embroidery ? 'e' : 'n'}`
      const existing = map.get(key)
      if (existing) existing.quantity += li.quantity
      else map.set(key, { itemId: li.itemId, size: li.size, embroidery: li.embroidery, quantity: li.quantity })
    }
  }

  const rows = [...map.values()]
    .map((r) => {
      const item = items.find((it) => it.id === r.itemId)
      const unit = lineItemUnitPrice(r, item)
      return { ...r, name: item?.name ?? 'Item', unit, lineTotal: unit * r.quantity }
    })
    .sort((a, b) => a.name.localeCompare(b.name) || String(a.size).localeCompare(String(b.size)))

  return (
    <div className="mt-6 card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-brand-50 text-brand-900 text-left">
          <tr>
            <th className="px-4 py-2.5 font-semibold">Item</th>
            <th className="px-4 py-2.5 font-semibold">Size</th>
            <th className="px-4 py-2.5 font-semibold">Embroidery</th>
            <th className="px-4 py-2.5 font-semibold text-right">Qty</th>
            <th className="px-4 py-2.5 font-semibold text-right">Unit</th>
            <th className="px-4 py-2.5 font-semibold text-right">Line total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-stone-50 transition-colors">
              <td className="px-4 py-2">{r.name}</td>
              <td className="px-4 py-2">{r.size}</td>
              <td className="px-4 py-2">{r.embroidery ? 'Yes' : '—'}</td>
              <td className="px-4 py-2 text-right font-medium">{r.quantity}</td>
              <td className="px-4 py-2 text-right">{formatMoney(r.unit)}</td>
              <td className="px-4 py-2 text-right">{formatMoney(r.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-stone-50 border-t border-stone-200">
          <tr>
            <td colSpan={5} className="px-4 py-2 text-right text-stone-500">Subtotal</td>
            <td className="px-4 py-2 text-right">{formatMoney(grand.subtotal)}</td>
          </tr>
          <tr>
            <td colSpan={5} className="px-4 py-2 text-right text-stone-500">Tax ({((settings.taxRate ?? 0) * 100).toFixed(0)}%)</td>
            <td className="px-4 py-2 text-right">{formatMoney(grand.tax)}</td>
          </tr>
          <tr>
            <td colSpan={5} className="px-4 py-2 text-right text-stone-500">Shipping</td>
            <td className="px-4 py-2 text-right">{settings.shippingTotal > 0 ? formatMoney(grand.shipping) : 'TBD'}</td>
          </tr>
          <tr className="font-bold text-brand-800 border-t border-stone-200">
            <td colSpan={5} className="px-4 py-2.5 text-right">Grand total</td>
            <td className="px-4 py-2.5 text-right">{formatMoney(grand.total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

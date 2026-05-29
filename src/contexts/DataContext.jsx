import { createContext, useContext, useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth, ADMIN_PASSWORD } from './AuthContext'

const DataContext = createContext(null)

export function DataProvider({ children }) {
  const { session } = useAuth()
  // Use the shared admin constant directly (it's already in the bundle), so admin
  // writes authorize correctly even for sessions created before adminPassword was stored.
  const adminPw = session?.role === 'admin' ? ADMIN_PASSWORD : undefined

  const [stores, setStores] = useState([])
  const [activeStoreId, setActiveStoreId] = useState(null)
  const [roster, setRoster] = useState([])
  const [items, setItems] = useState([])
  const [orders, setOrders] = useState([])
  const [settings, setSettingsState] = useState({ taxRate: 0.06, shippingTotal: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [st, r, i, o, s] = await Promise.all([
        api.getStores(), api.getRoster(), api.getItems(), api.getOrders(undefined, adminPw), api.getSettings(),
      ])
      setStores(st.stores)
      setActiveStoreId(st.activeStoreId)
      setRoster(r)
      setItems(i)
      setOrders(o)
      setSettingsState(s)
    } catch (e) {
      setError(e.message || 'Failed to load data.')
    } finally {
      setLoading(false)
    }
  }, [adminPw])

  useEffect(() => { refresh() }, [refresh])

  const activeStore = stores.find((s) => s.id === activeStoreId) ?? null

  // ---- stores ----
  async function renewStore(name) {
    await api.renewStore(name, adminPw)
    await refresh()
  }
  async function switchStore(storeId) {
    await api.setActiveStore(storeId, adminPw)
    await refresh()
  }

  // ---- roster ----
  async function addPlayer(name) {
    const player = await api.addPlayer(name, adminPw)
    setRoster((prev) => [...prev, player])
  }
  async function updatePlayer(id, name) {
    const player = await api.updatePlayer(id, name, adminPw)
    setRoster((prev) => prev.map((p) => (p.id === id ? player : p)))
  }
  async function removePlayer(id) {
    await api.removePlayer(id, adminPw)
    setRoster((prev) => prev.filter((p) => p.id !== id))
  }

  // ---- items ----
  async function addItem(data) {
    const item = await api.addItem(data, adminPw)
    setItems((prev) => [...prev, item])
  }
  async function updateItem(id, patch) {
    const item = await api.updateItem(id, patch, adminPw)
    setItems((prev) => prev.map((i) => (i.id === id ? item : i)))
  }
  async function removeItem(id) {
    await api.removeItem(id, adminPw)
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  // ---- orders ----
  async function submitOrder(playerId, buyerName, lineItems) {
    const order = await api.submitOrder({ playerId, buyerName, items: lineItems })
    setOrders((prev) => [...prev, order])
    return order
  }
  async function updateOrder(id, items) {
    const order = await api.updateOrder(id, items)
    setOrders((prev) => prev.map((o) => (o.id === id ? order : o)))
    return order
  }
  async function removeOrder(id) {
    await api.removeOrder(id, adminPw)
    setOrders((prev) => prev.filter((o) => o.id !== id))
  }

  // ---- settings ----
  async function setSettings(next) {
    // Merge with current so callers can patch one field (e.g. just `locked`).
    const merged = {
      taxRate: settings.taxRate ?? 0,
      shippingTotal: settings.shippingTotal ?? 0,
      locked: settings.locked ?? false,
      ...next,
    }
    const saved = await api.updateSettings(merged, adminPw)
    setSettingsState(saved)
  }

  return (
    <DataContext.Provider value={{
      loading, error, refresh, adminPw,
      stores, activeStoreId, activeStore, renewStore, switchStore,
      roster, addPlayer, updatePlayer, removePlayer,
      items, addItem, updateItem, removeItem,
      orders, submitOrder, updateOrder, removeOrder,
      settings, setSettings,
    }}>
      {children}
    </DataContext.Provider>
  )
}

export const useData = () => useContext(DataContext)

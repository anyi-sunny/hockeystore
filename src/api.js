// Thin client for the HockeyStore serverless API.
// Base URL comes from VITE_API_URL (written to .env after `cdk deploy`).
const BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, '') ?? ''

export const apiConfigured = Boolean(BASE)

async function request(method, path, { body, adminPassword } = {}) {
  if (!BASE) throw new Error('API URL not configured (VITE_API_URL).')
  const headers = {}
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (adminPassword) headers['x-admin-password'] = adminPassword

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    let detail = ''
    try { detail = (await res.json()).message } catch { /* ignore */ }
    throw new Error(detail || `${method} ${path} failed (${res.status})`)
  }
  return res.status === 204 ? null : res.json()
}

const qs = (storeId) => (storeId ? `?storeId=${encodeURIComponent(storeId)}` : '')

export const api = {
  // stores (seasons)
  getStores: () => request('GET', '/stores'),
  renewStore: (name, pw) => request('POST', '/stores', { body: { name }, adminPassword: pw }),
  setActiveStore: (storeId, pw) => request('PUT', '/stores/active', { body: { storeId }, adminPassword: pw }),

  // roster — defaults to the active store; pass storeId to read a specific (past) store
  getRoster: (storeId) => request('GET', `/roster${qs(storeId)}`),
  addPlayer: (name, pw) => request('POST', '/roster', { body: { name }, adminPassword: pw }),
  updatePlayer: (id, name, pw) => request('PUT', `/roster/${id}`, { body: { name }, adminPassword: pw }),
  removePlayer: (id, pw) => request('DELETE', `/roster/${id}`, { adminPassword: pw }),

  // items
  getItems: (storeId) => request('GET', `/items${qs(storeId)}`),
  addItem: (data, pw) => request('POST', '/items', { body: data, adminPassword: pw }),
  updateItem: (id, patch, pw) => request('PUT', `/items/${id}`, { body: patch, adminPassword: pw }),
  removeItem: (id, pw) => request('DELETE', `/items/${id}`, { adminPassword: pw }),

  // orders — viewing a non-active store requires the admin password
  getOrders: (storeId, pw) => request('GET', `/orders${qs(storeId)}`, { adminPassword: pw }),
  submitOrder: (order) => request('POST', '/orders', { body: order }),
  removeOrder: (id, pw) => request('DELETE', `/orders/${id}`, { adminPassword: pw }),

  // settings (per store)
  getSettings: (storeId) => request('GET', `/settings${qs(storeId)}`),
  updateSettings: (settings, pw) => request('PUT', '/settings', { body: settings, adminPassword: pw }),

  // image upload: get a presigned URL, PUT the file to S3, return the public URL
  async uploadImage(file, pw) {
    const { uploadUrl, publicUrl, contentType } = await request('POST', '/uploads', {
      body: { filename: file.name, contentType: file.type || 'application/octet-stream' },
      adminPassword: pw,
    })
    const put = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': contentType },
      body: file,
    })
    if (!put.ok) throw new Error(`Image upload failed (${put.status})`)
    return publicUrl
  },
}

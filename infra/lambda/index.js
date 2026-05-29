// Single Lambda handling all API routes for the Bowdoin Hockey Lulu store.
// Backed by DynamoDB (stores, roster, items, orders, settings) + S3 (item images).
//
// Everything is scoped to a "store" (a season, e.g. "Lulu Order 2026"). One store is
// active at a time — that's what players see. Admins can create new stores (renew),
// switch the active store, and view past stores' orders.
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const {
  DynamoDBDocumentClient, ScanCommand, GetCommand, PutCommand, DeleteCommand,
} = require('@aws-sdk/lib-dynamodb')
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}))
const s3 = new S3Client({})

const {
  STORES_TABLE, ROSTER_TABLE, ITEMS_TABLE, ORDERS_TABLE, SETTINGS_TABLE,
  IMAGES_BUCKET, ADMIN_PASSWORD, AWS_REGION,
} = process.env

const ACTIVE_POINTER_ID = '__active__' // reserved record in the stores table
const DEFAULT_SETTINGS = { taxRate: 0.06, shippingTotal: 0 }

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

const scanAll = async (TableName) => {
  const out = await ddb.send(new ScanCommand({ TableName }))
  return out.Items ?? []
}

const byStore = (rows, storeId) => rows.filter((r) => r.storeId === storeId)

const newId = (prefix) =>
  `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`

async function getActiveStoreId() {
  const out = await ddb.send(new GetCommand({ TableName: STORES_TABLE, Key: { id: ACTIVE_POINTER_ID } }))
  return out.Item?.storeId ?? null
}

async function setActiveStoreId(storeId) {
  await ddb.send(new PutCommand({ TableName: STORES_TABLE, Item: { id: ACTIVE_POINTER_ID, storeId } }))
}

exports.handler = async (event) => {
  const method = event.requestContext?.http?.method ?? 'GET'
  const rawPath = event.rawPath ?? '/'
  const parts = rawPath.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean)
  const [resource, id] = parts
  const body = event.body ? JSON.parse(event.body) : {}
  const query = event.queryStringParameters ?? {}
  const isAdmin = (event.headers?.['x-admin-password'] ?? '') === ADMIN_PASSWORD

  const requireAdmin = () => {
    if (!isAdmin) throw { status: 401, message: 'Admin authorization required.' }
  }

  // Which store this request targets: explicit ?storeId wins, else the active store.
  const resolveStoreId = async () => query.storeId || (await getActiveStoreId())

  try {
    if (method === 'OPTIONS') return json(204, {})

    // ---- stores ----
    if (resource === 'stores') {
      if (method === 'GET') {
        const all = await scanAll(STORES_TABLE)
        const stores = all
          .filter((s) => s.id !== ACTIVE_POINTER_ID)
          .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
        const activeStoreId = all.find((s) => s.id === ACTIVE_POINTER_ID)?.storeId ?? null
        return json(200, { stores, activeStoreId })
      }
      // PUT /stores/active  → switch the active store
      if (method === 'PUT' && id === 'active') {
        requireAdmin()
        const storeId = body.storeId
        const store = await ddb.send(new GetCommand({ TableName: STORES_TABLE, Key: { id: storeId } }))
        if (!store.Item) throw { status: 404, message: 'Store not found.' }
        await setActiveStoreId(storeId)
        return json(200, { activeStoreId: storeId })
      }
      // POST /stores  → "renew": create a new store, copy roster+items+settings, make it active
      if (method === 'POST') {
        requireAdmin()
        const name = String(body.name ?? '').trim()
        if (!name) throw { status: 400, message: 'Store name required.' }
        const store = { id: newId('s'), name, createdAt: new Date().toISOString() }
        await ddb.send(new PutCommand({ TableName: STORES_TABLE, Item: store }))

        const fromId = await getActiveStoreId()
        if (fromId) {
          const [roster, items, settingsAll] = await Promise.all([
            scanAll(ROSTER_TABLE), scanAll(ITEMS_TABLE), scanAll(SETTINGS_TABLE),
          ])
          const copies = []
          for (const p of byStore(roster, fromId)) {
            copies.push(ddb.send(new PutCommand({ TableName: ROSTER_TABLE,
              Item: { ...p, id: newId('p'), storeId: store.id } })))
          }
          for (const it of byStore(items, fromId)) {
            copies.push(ddb.send(new PutCommand({ TableName: ITEMS_TABLE,
              Item: { ...it, id: newId('i'), storeId: store.id } })))
          }
          const prevSettings = settingsAll.find((s) => s.storeId === fromId)
          copies.push(ddb.send(new PutCommand({ TableName: SETTINGS_TABLE,
            Item: { id: store.id, storeId: store.id, ...DEFAULT_SETTINGS,
              taxRate: prevSettings?.taxRate ?? DEFAULT_SETTINGS.taxRate, shippingTotal: 0 } })))
          // Orders are intentionally NOT copied — a renewed store starts with none.
          await Promise.all(copies)
        }
        await setActiveStoreId(store.id)
        return json(201, { store, activeStoreId: store.id })
      }
    }

    // ---- roster ----
    if (resource === 'roster') {
      if (method === 'GET') return json(200, byStore(await scanAll(ROSTER_TABLE), await resolveStoreId()))
      if (method === 'POST') {
        requireAdmin()
        const storeId = await resolveStoreId()
        const player = { id: newId('p'), storeId, name: String(body.name ?? '').trim() }
        if (!player.name) throw { status: 400, message: 'Name required.' }
        await ddb.send(new PutCommand({ TableName: ROSTER_TABLE, Item: player }))
        return json(201, player)
      }
      if (method === 'PUT') {
        requireAdmin()
        const existing = await ddb.send(new GetCommand({ TableName: ROSTER_TABLE, Key: { id } }))
        const player = { ...(existing.Item ?? {}), id, name: String(body.name ?? '').trim() }
        await ddb.send(new PutCommand({ TableName: ROSTER_TABLE, Item: player }))
        return json(200, player)
      }
      if (method === 'DELETE') {
        requireAdmin()
        await ddb.send(new DeleteCommand({ TableName: ROSTER_TABLE, Key: { id } }))
        return json(200, { id })
      }
    }

    // ---- items ----
    if (resource === 'items') {
      if (method === 'GET') return json(200, byStore(await scanAll(ITEMS_TABLE), await resolveStoreId()))
      if (method === 'POST') {
        requireAdmin()
        const storeId = await resolveStoreId()
        const item = { ...body, id: newId('i'), storeId }
        await ddb.send(new PutCommand({ TableName: ITEMS_TABLE, Item: item }))
        return json(201, item)
      }
      if (method === 'PUT') {
        requireAdmin()
        const existing = await ddb.send(new GetCommand({ TableName: ITEMS_TABLE, Key: { id } }))
        const item = { ...(existing.Item ?? {}), ...body, id }
        await ddb.send(new PutCommand({ TableName: ITEMS_TABLE, Item: item }))
        return json(200, item)
      }
      if (method === 'DELETE') {
        requireAdmin()
        await ddb.send(new DeleteCommand({ TableName: ITEMS_TABLE, Key: { id } }))
        return json(200, { id })
      }
    }

    // ---- orders ----  (buyers freely manage their own orders; viewing past stores is admin)
    if (resource === 'orders') {
      if (method === 'GET') {
        const activeId = await getActiveStoreId()
        const storeId = query.storeId || activeId
        if (storeId !== activeId) requireAdmin() // only admins view non-active (past) stores
        return json(200, byStore(await scanAll(ORDERS_TABLE), storeId))
      }
      if (method === 'POST') {
        const storeId = await resolveStoreId()
        const order = {
          id: newId('o'),
          storeId,
          playerId: body.playerId,
          buyerName: String(body.buyerName ?? '').trim(),
          items: Array.isArray(body.items) ? body.items : [],
          createdAt: new Date().toISOString(),
        }
        if (!order.storeId || !order.playerId || !order.buyerName || order.items.length === 0) {
          throw { status: 400, message: 'storeId, playerId, buyerName and items are required.' }
        }
        await ddb.send(new PutCommand({ TableName: ORDERS_TABLE, Item: order }))
        return json(201, order)
      }
      // Buyers edit their own order's line items (no admin needed — open ordering model).
      if (method === 'PUT') {
        const existing = await ddb.send(new GetCommand({ TableName: ORDERS_TABLE, Key: { id } }))
        if (!existing.Item) throw { status: 404, message: 'Order not found.' }
        const items = Array.isArray(body.items) ? body.items : []
        if (items.length === 0) throw { status: 400, message: 'Order must have at least one item (delete it instead).' }
        const order = { ...existing.Item, items }
        await ddb.send(new PutCommand({ TableName: ORDERS_TABLE, Item: order }))
        return json(200, order)
      }
      if (method === 'DELETE') {
        await ddb.send(new DeleteCommand({ TableName: ORDERS_TABLE, Key: { id } }))
        return json(200, { id })
      }
    }

    // ---- settings ----  (one record per store, keyed by storeId)
    if (resource === 'settings') {
      if (method === 'GET') {
        const storeId = await resolveStoreId()
        const out = await ddb.send(new GetCommand({ TableName: SETTINGS_TABLE, Key: { id: storeId } }))
        return json(200, out.Item ?? { id: storeId, storeId, ...DEFAULT_SETTINGS })
      }
      if (method === 'PUT') {
        requireAdmin()
        const storeId = await resolveStoreId()
        const settings = {
          id: storeId,
          storeId,
          taxRate: Number(body.taxRate) || 0,
          shippingTotal: Number(body.shippingTotal) || 0,
        }
        await ddb.send(new PutCommand({ TableName: SETTINGS_TABLE, Item: settings }))
        return json(200, settings)
      }
    }

    // ---- uploads ----  (admin gets a presigned URL, uploads image directly to S3)
    if (resource === 'uploads' && method === 'POST') {
      requireAdmin()
      const ext = (body.filename ?? '').split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
      const key = `items/${newId('img')}.${ext}`
      const contentType = body.contentType || 'application/octet-stream'
      const uploadUrl = await getSignedUrl(
        s3,
        new PutObjectCommand({ Bucket: IMAGES_BUCKET, Key: key, ContentType: contentType }),
        { expiresIn: 300 }
      )
      const publicUrl = `https://${IMAGES_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${key}`
      return json(200, { uploadUrl, publicUrl, contentType })
    }

    return json(404, { message: `No route for ${method} /${parts.join('/')}` })
  } catch (err) {
    if (err && err.status) return json(err.status, { message: err.message })
    console.error('Unhandled error', err)
    return json(500, { message: 'Internal error', detail: String(err?.message ?? err) })
  }
}

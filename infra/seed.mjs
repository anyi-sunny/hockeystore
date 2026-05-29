// Seeds the roster + item catalog via the deployed API, only if currently empty.
// Usage: API_URL=https://… ADMIN_PASSWORD=… node seed.mjs
const API = (process.env.API_URL || '').replace(/\/$/, '')
const PW = process.env.ADMIN_PASSWORD || 'bowdoinhockey2026'
if (!API) { console.error('Set API_URL'); process.exit(1) }

const ROSTER = [
  'Ericah', 'Provo', 'Bags', 'Woj', 'Sofia', 'Luna', 'Emma', 'Charlee', 'Biz',
  'Mele', 'Kate', 'Lele', 'Judy', 'Anyi', 'Sage', 'Bea', 'Abby A', 'Channing',
  'Molly', 'Ava I', 'Daphne', 'Kira', 'Shiggy', 'Pete', 'Abby M', 'Coach',
  'Mal', 'Santana', 'Gia',
]

const ITEMS = [
  { name: 'Align Leggings 25"',                    price: 49, sizes: ['2','4','6','8','10','12','14'], embroideryAvailable: true, embroideryCost: 10, stock: {}, imageUrl: '' },
  { name: 'Align Shorts 4"',                       price: 32, sizes: ['2','4','6','8','10','12','14'], embroideryAvailable: true, embroideryCost: 10, stock: {}, imageUrl: '' },
  { name: 'Align High-Rise Skirt 13"',             price: 39, sizes: ['2','4','6','8','10','12'],      embroideryAvailable: true, embroideryCost: 10, stock: {}, imageUrl: '' },
  { name: 'Hottie Hot High-Rise Lined Short 2.5"', price: 34, sizes: ['2','4','6','8','10','12'],      embroideryAvailable: true, embroideryCost: 10, stock: {}, imageUrl: '' },
  { name: 'Swiftly Tech Short-Sleeve Shirt 2.0',   price: 34, sizes: ['2','4','6','8','10','12'],      embroideryAvailable: true, embroideryCost: 10, stock: {}, imageUrl: '' },
  { name: 'Swiftly Tech Long-Sleeve Shirt 2.0',    price: 39, sizes: ['2','4','6','8','10','12'],      embroideryAvailable: true, embroideryCost: 10, stock: {}, imageUrl: '' },
  { name: 'Swiftly Tech Racerback Tank Top 2.0',   price: 29, sizes: ['0','2','4','6','8','10','12'],  embroideryAvailable: true, embroideryCost: 10, stock: {}, imageUrl: '' },
  { name: 'All Yours Cotton Crewneck T-Shirt',     price: 24, sizes: ['S','M','L','XL'],               embroideryAvailable: true, embroideryCost: 10, stock: {}, imageUrl: '' },
  { name: 'Flow Y Bra Nulu',                       price: 24, sizes: ['2','4','6','8','10','12'],      embroideryAvailable: true, embroideryCost: 10, stock: {}, imageUrl: '' },
  { name: 'Energy Bra',                            price: 26, sizes: ['2','4','6','8','10','12'],      embroideryAvailable: true, embroideryCost: 10, stock: {}, imageUrl: '' },
  { name: 'Scuba Oversized Full Zip Hoodie',       price: 64, sizes: ['XS/S','M/L','XL/XXL'],          embroideryAvailable: true, embroideryCost: 10, stock: {}, imageUrl: '' },
  { name: 'Fundamental T-Shirt',                   price: 29, sizes: ['S','M','L','XL','XXL'],         embroideryAvailable: true, embroideryCost: 10, stock: {}, imageUrl: '' },
]

const post = (path, body) =>
  fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-admin-password': PW },
    body: JSON.stringify(body),
  }).then(async (r) => { if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`); return r.json() })

const get = (path) => fetch(`${API}${path}`).then((r) => r.json())

const existingRoster = await get('/roster')
const existingItems = await get('/items')

if (existingRoster.length === 0) {
  for (const name of ROSTER) await post('/roster', { name })
  console.log(`Seeded ${ROSTER.length} players.`)
} else {
  console.log(`Roster already has ${existingRoster.length} players — skipping.`)
}

if (existingItems.length === 0) {
  for (const item of ITEMS) await post('/items', item)
  console.log(`Seeded ${ITEMS.length} items.`)
} else {
  console.log(`Catalog already has ${existingItems.length} items — skipping.`)
}

console.log('Done.')

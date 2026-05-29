// One-time reset to the baseline starter store. Wipes all stores/roster/items/orders/
// settings and creates a single active store with two coaches + one example item.
// Run from infra/lambda:  node reset.mjs
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb'

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }))

const T = {
  stores: 'hockeystore-stores',
  roster: 'hockeystore-roster',
  items: 'hockeystore-items',
  orders: 'hockeystore-orders',
  settings: 'hockeystore-settings',
}

async function wipe(table) {
  const out = await ddb.send(new ScanCommand({ TableName: table }))
  for (const item of out.Items ?? []) {
    await ddb.send(new DeleteCommand({ TableName: table, Key: { id: item.id } }))
  }
  console.log(`wiped ${table}: ${out.Items?.length ?? 0} records`)
}

for (const t of Object.values(T)) await wipe(t)

const storeId = 's2026'
const now = new Date().toISOString()

await ddb.send(new PutCommand({ TableName: T.stores, Item: { id: storeId, name: 'Lulu Order 2026', createdAt: now } }))
await ddb.send(new PutCommand({ TableName: T.stores, Item: { id: '__active__', storeId } }))

const COACHES = [
  { id: 'p_marissa', name: "Marissa O'Neill" },
  { id: 'p_mallory', name: 'Mallory Michaels' },
]
for (const coach of COACHES) {
  await ddb.send(new PutCommand({
    TableName: T.roster,
    Item: { ...coach, storeId },
  }))
}

await ddb.send(new PutCommand({
  TableName: T.items,
  Item: {
    id: 'i_example', storeId,
    name: 'Example Item', price: 0, imageUrl: '',
    sizes: ['S', 'M', 'L'], embroideryAvailable: true, embroideryCost: 0, stock: {},
  },
}))

await ddb.send(new PutCommand({
  TableName: T.settings,
  Item: { id: storeId, storeId, taxRate: 0.06, shippingTotal: 0 },
}))

console.log('Baseline store "Lulu Order 2026" created and set active (2 coaches, 1 example item).')

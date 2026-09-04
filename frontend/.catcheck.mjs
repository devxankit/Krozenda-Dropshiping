import { createServer } from 'vite'
const s = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
const f = await s.ssrLoadModule('/src/modules/admin/fixtures/catalog.js')
console.log('approvals   ', f.approvalQueueFixture().items.length, JSON.stringify(f.approvalQueueFixture().tabCounts))
console.log('categories  ', f.categoryTreeFixture().nodes.length)
console.log('attributes  ', f.attributeListFixture().items.length)
console.log('products    ', f.productListFixture({}).items.length)
console.log('inventory   ', f.inventoryFixture({}).items.length)
await s.close(); process.exit(0)

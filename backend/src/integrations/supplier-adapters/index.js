// Registry: supplier key -> adapter instance. No concrete adapters exist
// yet — §13.2 item 5 (which two suppliers are in Phase 1) is still open.
// When one is confirmed, add `<Name>Adapter.js` extending SupplierAdapter
// and register it here; nothing else in the codebase should reference a
// specific supplier by name.
export const supplierAdapters = new Map()

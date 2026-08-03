// Contract every supplier sync adapter must satisfy (project context §6.7,
// §12). Supplier sync (stock/price/image/description) is capped at TWO
// integrations in Phase 1 — each additional one is bespoke, priced
// separately. Which two suppliers is still an open question (§13.2 item 5).
// New supplier = a new class extending this, not a new codebase.
export class SupplierAdapter {
  async syncStock(_productRef) {
    throw new Error('Not implemented')
  }

  async syncPrice(_productRef) {
    throw new Error('Not implemented')
  }

  async syncImages(_productRef) {
    throw new Error('Not implemented')
  }

  async syncDescription(_productRef) {
    throw new Error('Not implemented')
  }
}

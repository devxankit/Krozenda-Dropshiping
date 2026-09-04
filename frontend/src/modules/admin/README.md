# Admin panel

89 routes across 9 navigation groups, covering PRD §9 (Phase 1E admin scope),
§6 (business logic) and the whole of `docs/BILLING_ACCOUNTING_SPECIFICATION.md`.

Everything runs against a **fixtures layer** — five of roughly nineteen
collections are modelled server-side and only `GET /admin/dashboard-summary`
exists. See [Data layer](#data-layer) for how that is arranged so going live is
a one-line change per service, not a rewrite.

---

## Layout

```
modules/admin/
├── components/
│   ├── shell/        AdminLayout · AdminSidebar · AdminTopbar · CommandPalette
│   │                 MobileNav · NotificationsPanel · ProfileMenu · PageHeader · PageBody
│   ├── data/         ListScreen · DataTable · FilterBar · BulkActionBar · ExportMenu
│   ├── display/      cells (money, date, status, id) + structure (card, kv, timeline)
│   ├── charts/       AreaTrend · BarSeries · DonutSplit · Sparkline · chartTheme
│   ├── forms/        FormSection · FormRow · Stepper · FormActions · FileDropzone
│   ├── overlay/      Drawer · ConfirmDialog
│   ├── feedback/     InlineAlert · ErrorState · PageSkeleton · PermissionGate
│   └── <domain>/     auth · catalog · orders · fulfilment · people · finance · marketing · system
├── pages/            one folder per navigation group
├── controllers/      react-query orchestration — the ONLY thing pages call
├── services/         the ONLY place that imports axios (or knows a fixture exists)
├── schemas/          zod contracts — validate the fixture today, the API tomorrow
├── fixtures/         API-shaped demo data
├── tableColumns/     column definitions and filter schemas, as data
├── lib/              nav derivation, formatting, zodResolver, screen index
├── stores/           chrome state (sidebar collapsed, overlays) — not server state
├── constants.js      NAV_TREE · permissions · status→tone maps
└── routes.jsx        the 89-route tree
```

---

## The ten rules

These are enforceable by reading a diff, and were checked at the end of every
phase.

1. **Layer rule.** A page imports a controller. A controller imports a service.
   A service imports axios and a zod schema. Lint enforces the page half
   (`eslint.config.js`, `no-restricted-imports` on `modules/*/pages/**`).
2. **Size ceilings.** Route page ≤ 120 lines, section component ≤ 180,
   primitive ≤ 120. Data files (`constants.js`, `tableColumns/`, `fixtures/`,
   `lib/screenIndex.js`) are exempt — pushing configuration into them is the
   point.
3. **Pages compose, they never style.** A page file is imports, one controller
   call, and layout.
4. **Tokens only.** `bg-brand-600`, never `bg-blue-600`; no hex in JSX. The two
   documented exceptions are `charts/chartTheme.js` and the decorative SVG in
   `components/auth/AuthShell.jsx`, where `fill` and `stroke` are attributes a
   Tailwind class cannot reach.
5. **One list anatomy.** `PageHeader → Tabs → FilterBar → FilterChips →
   BulkActionBar → DataTable → Pagination`, all owned by
   `components/data/ListScreen.jsx`. Twenty-odd list screens are ~30 lines each
   because of it.
6. **One detail anatomy.** Entity header with actions → tabs → section cards →
   right rail.
7. **Columns and filters are data.** They live in `tableColumns/`, never inline
   in a page.
8. **Forms are react-hook-form + zod**, through `lib/zodResolver.js`.
9. **Four states per screen** — loading, empty, error, loaded — built as the
   screen is built.
10. **Permission-aware by construction.** Nav entries and destructive actions
    carry a permission key and render through `PermissionGate`.

---

## Data layer

```
fixtures/orders.js  ──┐
                      ├─→ services/orderService.js ─→ controllers/ ─→ pages/
GET /admin/orders   ──┘         (picks one, by VITE_USE_MOCKS)
                                        │
                                schemas/orderSchema.js
                            validates BOTH paths, identically
```

`services/mockTransport.js` reads `env.useMocks`. Because the same zod schema
parses the fixture and the live response, **`fixtures/` is an executable API
specification** — a fixture that drifts from the contract fails loudly rather
than producing a screen that cannot work against the real endpoint.

Set `VITE_USE_MOCKS=false` to point every admin service at the real API.

**Money is in paise, integer, everywhere.** Rupee floats in a settlement engine
drift by a few paise every thousand orders.

---

## Things that are load-bearing

- **Commission is snapshotted**, never recomputed. `subOrder.commission` carries
  the rate that applied when the order was placed. Editing a rule in
  `/admin/finance/commission-rules` affects future orders only.
- **A parent order has no status of its own.** It has N sub-orders that each
  carry one; the orders list shows a derived roll-up (`FULFILMENT_STATUS`), and
  the "partly" values are the normal case, not an edge case.
- **The accounting statements are computed from one chart of accounts**
  (`fixtures/finance.js`). The P&L subtotals, balance sheet equity, trial
  balance columns and settlement nets are all derived, so a changed line cannot
  silently break a total.
- **RTO is not a return.** The no-return policy does not cover a consignment
  that never reached the buyer, so it has its own workflow, cost bearer and
  settlement reversal.
- **DLT registration gates SMS.** A template without an approved DLT id cannot
  send, and registration is client-owned and takes 3–10 working days. The
  templates screen shows that state rather than pretending the text is freely
  editable.

---

## Bundle

Chart-bearing screens (dashboard, four analytics, finance overview) are
`lazy()`-loaded so recharts (~400 kB) is a separate chunk. A session that goes
straight to Orders or KYC never downloads it.

| chunk | raw | gzip |
|---|---|---|
| admin routes | 345 kB | 92 kB |
| charts (lazy) | 415 kB | 118 kB |

---

## Verifying

```bash
npx eslint src/modules/admin --quiet     # must be silent
npm run build                            # must succeed
```

Fixture-to-schema validation is not yet wired into a test runner (no vitest in
the project). Until it is, `mockTransport` parses every fixture through its
schema at runtime, so a drifted fixture surfaces the moment the screen loads in
development.

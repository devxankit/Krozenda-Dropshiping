# Kit A2 - admin-level shared components used by the seller screens

Scope = only what `frontend/src/modules/{vendor-shared,seller}` import from `modules/admin`. Status key: Built = written + eslint clean, not run on a device.

| Web source (modules/admin) | Native file (mobile-seller/src) | Status / notes |
|---|---|---|
| components/shell/PageBody | components/admin/shell/PageBody.jsx | Built. ScrollView, px-3 py-2.5 gap-2.5, `refreshing`/`onRefresh`, tap-persist. `className`/`width` ignored. |
| components/shell/PageHeader | .../shell/PageHeader.jsx | Built. Title 16/24 bold, description 12 (2 lines), actions wrap. Breadcrumb/`trail` hidden below sm -> not rendered. |
| components/shell/navStyles | .../shell/navStyles.jsx | Built. `navItemClass`/`navIconClass` return Tailwind strings on web -> native `navItemStyle()` (returns `{row,text,bar,iconColor}`) + `navIconColor()`; `NavCount`, `NavGroupLabel`, `BrandMark` same props. Only the lead's VendorSidebar imports it. |
| components/data/ListScreen | .../data/ListScreen.jsx | Built. Same props. Adds pull-to-refresh (controller.refetch). `renderRowActions` passed by OrdersPage is never read on web either (unreachable). |
| components/data/DataTable | .../data/DataTable.jsx | Built. Uses ui Table/Pagination/EmptyState + ErrorState. |
| components/data/FilterBar (+FilterChips) | .../data/FilterBar.jsx | Built. Search = TextInput; `<select>` = pill that opens a Sheet option list. |
| components/data/BulkActionBar, RowActions, ExportMenu | .../data/*.jsx + AnchoredMenu.jsx | Built. Dropdowns = transparent Modal positioned via measureInWindow (AnchoredMenu is a native-only helper). Not rendered by any seller screen except ExportMenu. |
| components/overlay/Drawer | .../overlay/Drawer.jsx | Built. RN Modal + Animated slide (220ms in / 160ms out), right (default) or left; `nav` = 85vw max 288; others full width capped at max-w; header/scroll body/footer; backdrop tap + Android back close; follows keyboard height; safe-area top/bottom. `ariaLabel` ignored. |
| components/overlay/ConfirmDialog | .../overlay/ConfirmDialog.jsx | Built. ui Modal; typed `confirmPhrase` via TextInput. |
| components/forms/FormDrawer | .../forms/FormDrawer.jsx | Built. No `<form>`; submit button calls `onSubmit({preventDefault(){}, stopPropagation(){}})`; blocked while `isSubmitting`/`!canSubmit`. |
| components/forms/index.jsx | .../forms/index.jsx | Built: FormSection (`columns` honoured as rows), FormRow, Stepper, FormActions, UnsavedIndicator, re-export FormDrawer. Only FormDrawer is used by seller. |
| components/feedback/index.jsx | .../feedback/index.jsx | Built: InlineAlert, ErrorState, PageSkeleton (stacked at phone width), PermissionGate, NoData. |
| components/display/cells | .../display/cells.jsx | Built: MoneyCell, DateCell, StatusPill, IdCell, PrimaryCell. `to` links -> `onPress`. MoneyCell/DateCell/IdCell accept `style` and a small `className` subset (text-{palette}-{shade}, text-xs..2xl, font-medium/semibold/bold). |
| components/display/structure | .../display/structure.jsx | Built: SectionCard, KeyValueList, Timeline, RowActions (inline icon row). |
| components/display/index | .../display/index.js | Built; also re-exports formatMoney/formatCount. |
| components/StatTile | components/admin/StatTile.jsx | Built (phone sizes). |
| components/charts/{chartTheme,ChartFrame,index} | .../charts/* | Built. recharts -> react-native-svg: `AreaTrend` (stacked/non-stacked monotone areas, gradient fill, grid, rupee axis, tap tooltip with total), `SparkArea`, `ChartFrame`, `ChartLegend`, `ChartTooltip`, `SERIES`/`formatAxisRupees`/`formatAxisCount`. `BarSeries`/`DonutSplit` NOT ported: no seller screen imports them. |
| components/dashboard/{KpiCard,OrderPipeline} | .../dashboard/*.jsx + index.js | Built (1-column KPI grid, `columns` prop accepted/ignored). ActionQueue/IntegrationHealthStrip/RecentSubOrders/OwnStockCard not ported (admin-only). |
| controllers/useListController | modules/admin/controllers/useListController.js | Built, verbatim. |
| controllers/useDashboardController | modules/admin/controllers/useDashboardController.js | Only `DASHBOARD_RANGES` (+`DASHBOARD_REFRESH_MS`) - the only symbol seller imports. |
| stores/toastStore | modules/admin/stores/toastStore.js | Re-export of `toast` from src/lib/toast. (`useToastStore` shim not exported: unused.) |
| services/mockTransport | modules/admin/services/mockTransport.js | Live path only. All seller call sites pass `live: true`; native has no mock mode. `fixture`/`live` options ignored. |
| lib/format, lib/exportCsv | modules/admin/lib/{format,exportCsv}.js | `export *` re-exports of src/lib (A1). |
| schemas/analyticsSchema | modules/admin/schemas/analyticsSchema.js | Only `sellerRevenueSchema` (+ dashboardSchema.granularitySchema). |
| tableColumns/analyticsColumns | modules/admin/tableColumns/analyticsColumns.jsx | Only `PRODUCT_REVENUE_COLUMNS` (no `to` links involved). |
| constants | modules/admin/constants.js | Only `DEFAULT_ROWS_PER_PAGE = 25`. |

Unreachable on web / skipped: breadcrumb (hidden < sm), `renderRowActions`, `Drawer.ariaLabel`, `useToastStore`.

Verification: `npx eslint src/components/admin src/modules/admin` clean (A1's ui/lib files had landed). Nothing run on a device.

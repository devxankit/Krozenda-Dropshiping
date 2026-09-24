import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import { RoleGuard } from '../../routes/RoleGuard'
import { useAuthStore } from '../../lib/authStore'
import { LogisticsSettingsPage } from './pages/system/LogisticsSettingsPage'
import { CarrierAccountsPage, CarrierShipmentsPage } from './pages/fulfilment/CarrierShipmentsPage'
import { ADMIN_ROUTES } from '../../config/routes'
import { ADMIN_PERMISSIONS } from './constants'
import { AdminLayout } from './components/shell'
import { PageSkeleton } from './components/feedback'
import { PLACEHOLDER_SCREENS } from './lib/placeholderScreens'
import { ForbiddenPage } from './pages/ForbiddenPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { ShowcasePage } from './pages/ShowcasePage'
import { ProductsPage } from './pages/catalog/ProductsPage'
import { ProductDetailPage } from './pages/catalog/ProductDetailPage'
import { ApprovalsPage } from './pages/catalog/ApprovalsPage'
import { CategoriesPage } from './pages/catalog/CategoriesPage'
import { BrandsPage } from './pages/catalog/BrandsPage'
import { AttributesPage } from './pages/catalog/AttributesPage'
import { InventoryPage } from './pages/catalog/InventoryPage'
import { ImportPage } from './pages/catalog/ImportPage'
import { SupplierSyncPage } from './pages/catalog/SupplierSyncPage'
import { DropshippingOverviewPage } from './pages/dropshipping/DropshippingOverviewPage'
import { CjSettingsPage } from './pages/cj/CjSettingsPage'
import { CjDashboardPage } from './pages/cj/CjDashboardPage'
import { CjCataloguePage } from './pages/cj/CjCataloguePage'
import { CjCategoryPage } from './pages/cj/CjCategoryPage'
import { CjProductsPage } from './pages/cj/CjProductsPage'
import { CjProductDetailPage } from './pages/cj/CjProductDetailPage'
import { CjOrdersPage } from './pages/cj/CjOrdersPage'
import { CjShipmentsPage } from './pages/cj/CjShipmentsPage'
import { CjDisputesPage } from './pages/cj/CjDisputesPage'
import { CjSyncLogsPage } from './pages/cj/CjSyncLogsPage'
import { DropshippingPartnersPage } from './pages/dropshipping/DropshippingPartnersPage'
import { DropshippingProductsPage } from './pages/dropshipping/DropshippingProductsPage'
import { DropshippingOrdersPage } from './pages/dropshipping/DropshippingOrdersPage'
import { DropshippingMarginsPage } from './pages/dropshipping/DropshippingMarginsPage'
import { OrdersPage } from './pages/orders/OrdersPage'
import { OrderDetailPage } from './pages/orders/OrderDetailPage'
import { SubOrdersPage } from './pages/fulfilment/SubOrdersPage'
import { SubOrderDetailPage } from './pages/fulfilment/SubOrderDetailPage'
import { ShipmentsPage } from './pages/fulfilment/ShipmentsPage'
import { RtoPage } from './pages/fulfilment/RtoPage'
import { ReturnsPage } from './pages/fulfilment/ReturnsPage'
import { ReturnDetailPage } from './pages/fulfilment/ReturnDetailPage'
import { CancellationsPage } from './pages/fulfilment/CancellationsPage'
import { InvoicesPage } from './pages/fulfilment/InvoicesPage'
import { InvoiceDetailPage } from './pages/fulfilment/InvoiceDetailPage'
import { CustomersPage } from './pages/people/CustomersPage'
import { VendorsPage } from './pages/people/VendorsPage'
import { KycQueuePage } from './pages/people/KycQueuePage'
import { KycReviewPage } from './pages/people/KycReviewPage'
import { PolicyAcceptancesPage } from './pages/people/PolicyAcceptancesPage'
import { RolesManagementPage } from './pages/people/RolesManagementPage'
import { UserManagementPage } from './pages/people/UserManagementPage'
import { TransactionsPage, RefundsPage } from './pages/finance/FinanceListPages'
import { SettlementsPage, VendorLedgersPage } from './pages/finance/SettlementListPages'
import { SettlementBatchPage } from './pages/finance/SettlementBatchPage'
import { VendorStatementPage } from './pages/finance/VendorStatementPage'
import { CommissionRulesPage, PricingRulesPage } from './pages/finance/RulesPages'
import { TrialBalancePage } from './pages/finance/LedgerPages'
import { ChartOfAccountsPage } from './pages/finance/ChartOfAccountsPage'
import { JournalVouchersPage } from './pages/finance/JournalVouchersPage'
import { ExpensesPage } from './pages/finance/ExpensesPage'
import { ProfitAndLossPage, BalanceSheetPage, CashFlowPage } from './pages/finance/StatementPages'
import { TaxCentrePage } from './pages/finance/TaxCentrePage'
import {
  AccountingTransactionsPage,
  AccountingTransactionDetailPage,
} from './pages/accounting/TransactionsPage'
import { SellerLedgerListPage, SellerLedgerDetailPage } from './pages/accounting/SellerLedgerPage'
import { CommissionsPage } from './pages/accounting/CommissionsPage'
import { AccountingSettlementsPage, AccountingSettlementDetailPage } from './pages/accounting/SettlementsPage'
import { PayoutsPage, PayoutDetailPage } from './pages/accounting/PayoutsPage'
import { AccountingRefundsPage } from './pages/accounting/RefundsPage'
import { AccountingReportsPage, AccountingReportRunnerPage } from './pages/accounting/ReportsPage'
import { AccountsDashboardPage } from './pages/accounts/AccountsDashboardPage'
import { VendorPayoutsPage } from './pages/accounts/VendorPayoutsPage'
import { TransactionsPage as AccountsTransactionsPage } from './pages/accounts/TransactionsPage'
import { LedgerPage } from './pages/accounts/LedgerPage'
import { CouponsPage, CampaignsPage, ReviewsPage } from './pages/marketing/MarketingListPages'
import { OffersPage, CmsPagesPage, TemplatesPage } from './pages/marketing/ContentPages'
import { BannersPage } from './pages/marketing/BannersPage'
import { ReportsPage, ReportRunnerPage } from './pages/reports/ReportPages'
import { BusinessRulesPage } from './pages/system/BusinessRulesPage'
import {
  GeneralSettingsPage,
  TaxSettingsPage,
  PoliciesPage,
  NotificationSettingsPage,
  IntegrationHealthPage,
  ApiWebhooksPage,
} from './pages/system/SettingsPages'
import { AuditLogPage, BackupsPage, SupportTicketsPage, AdminProfilePage } from './pages/system/SystemPages'
import { SupportTicketDetailPage } from './pages/system/SupportTicketDetailPage'
import { LoginPage } from './pages/auth/LoginPage'
import { TwoFactorPage } from './pages/auth/TwoFactorPage'
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage'
import { LockedPage } from './pages/auth/LockedPage'
import { TranslationProvider } from '../../lib/i18n'

// Chart-bearing screens are split out: recharts is ~400 kB, and a session
// that goes straight to Orders or KYC should never download it.
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const SalesAnalyticsPage = lazy(() =>
  import('./pages/analytics/SalesAnalyticsPage').then((m) => ({ default: m.SalesAnalyticsPage })),
)
const VendorAnalyticsPage = lazy(() =>
  import('./pages/analytics/VendorAnalyticsPage').then((m) => ({ default: m.VendorAnalyticsPage })),
)
const CatalogAnalyticsPage = lazy(() =>
  import('./pages/analytics/CatalogAnalyticsPage').then((m) => ({ default: m.CatalogAnalyticsPage })),
)
const CustomerAnalyticsPage = lazy(() =>
  import('./pages/analytics/CustomerAnalyticsPage').then((m) => ({ default: m.CustomerAnalyticsPage })),
)
const FinanceOverviewPage = lazy(() =>
  import('./pages/finance/FinanceOverviewPage').then((m) => ({ default: m.FinanceOverviewPage })),
)
const AccountingOverviewPage = lazy(() =>
  import('./pages/accounting/AccountingOverviewPage').then((m) => ({
    default: m.AccountingOverviewPage,
  })),
)

// Paths in config/routes.js are absolute; this router is mounted at /admin,
// so its <Route path> values are the remainder.
const rel = (path) => path.replace(`${ADMIN_ROUTES.ROOT}/`, '')

function ChunkFallback() {
  return (
    <div className="p-5">
      <PageSkeleton rows={3} />
    </div>
  )
}

// Unlike the shared ProtectedRoute (which has a guest-mode bypass for the
// buyer/seller/partner apps that don't have real backends yet), the admin
// panel has real login now, so it enforces the session for real.
function AdminProtectedRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to={ADMIN_ROUTES.LOGIN} replace state={{ from: location }} />
  }

  return <Outlet />
}

export default function AdminRoutes() {
  return (
    // Wraps the sign-in, 2FA and lock screens too, not only the panel behind
    // the guard — a staff member who needs another language needs it before
    // they can sign in. Screens below need no changes at all: the provider
    // translates the rendered DOM, so the tables, filters and charts' labels
    // are covered without touching a single page.
    <TranslationProvider>
      <Routes>
        {/* Unauthenticated. Deliberately outside the guard — the admin panel
          has its own email + 2FA sign-in rather than the buyer OTP flow. */}
        <Route path={rel(ADMIN_ROUTES.LOGIN)} element={<LoginPage />} />
        <Route path={rel(ADMIN_ROUTES.TWO_FACTOR)} element={<TwoFactorPage />} />
        <Route path={rel(ADMIN_ROUTES.FORGOT_PASSWORD)} element={<ForgotPasswordPage />} />
        <Route path={rel(ADMIN_ROUTES.RESET_PASSWORD)} element={<ResetPasswordPage />} />
        <Route path={rel(ADMIN_ROUTES.LOCKED)} element={<LockedPage />} />

        {/* Everything below requires a session AND admin.access. */}
        <Route element={<AdminProtectedRoute />}>
          <Route
            element={<RoleGuard permissions={[ADMIN_PERMISSIONS.ACCESS]} redirectTo={ADMIN_ROUTES.LOGIN} />}
          >
            <Route element={<AdminLayout />}>
              {/* Suspense sits inside the shell so the sidebar and topbar stay
                on screen while a split chunk loads. */}
              <Route index element={<Navigate to={ADMIN_ROUTES.DASHBOARD} replace />} />
              <Route
                path={rel(ADMIN_ROUTES.DASHBOARD)}
                element={
                  <Suspense fallback={<ChunkFallback />}>
                    <DashboardPage />
                  </Suspense>
                }
              />

              <Route
                path={rel(ADMIN_ROUTES.ANALYTICS_SALES)}
                element={
                  <Suspense fallback={<ChunkFallback />}>
                    <SalesAnalyticsPage />
                  </Suspense>
                }
              />
              <Route
                path={rel(ADMIN_ROUTES.ANALYTICS_VENDORS)}
                element={
                  <Suspense fallback={<ChunkFallback />}>
                    <VendorAnalyticsPage />
                  </Suspense>
                }
              />
              <Route
                path={rel(ADMIN_ROUTES.ANALYTICS_CATALOG)}
                element={
                  <Suspense fallback={<ChunkFallback />}>
                    <CatalogAnalyticsPage />
                  </Suspense>
                }
              />
              <Route
                path={rel(ADMIN_ROUTES.ANALYTICS_CUSTOMERS)}
                element={
                  <Suspense fallback={<ChunkFallback />}>
                    <CustomerAnalyticsPage />
                  </Suspense>
                }
              />

              {/* Catalog. Product create/edit happens in a drawer (on the list
                and on the detail screen); PRODUCT_NEW stays registered,
                redirecting back to the list, so old links don't 404. */}
              <Route path={rel(ADMIN_ROUTES.PRODUCTS)} element={<ProductsPage />} />
              <Route
                path={rel(ADMIN_ROUTES.PRODUCT_NEW)}
                element={<Navigate to={ADMIN_ROUTES.PRODUCTS} replace />}
              />
              <Route
                path={rel(ADMIN_ROUTES.PRODUCT_DETAIL)}
                element={<ProductDetailPage />}
              />
              <Route path={rel(ADMIN_ROUTES.CATALOG_APPROVALS)} element={<ApprovalsPage />} />
              <Route path={rel(ADMIN_ROUTES.CATALOG_IMPORT)} element={<ImportPage />} />
              <Route path={rel(ADMIN_ROUTES.CATEGORIES)} element={<CategoriesPage />} />
              <Route path={rel(ADMIN_ROUTES.BRANDS)} element={<BrandsPage />} />
              <Route path={rel(ADMIN_ROUTES.ATTRIBUTES)} element={<AttributesPage />} />
              <Route path={rel(ADMIN_ROUTES.INVENTORY)} element={<InventoryPage />} />
              <Route path={rel(ADMIN_ROUTES.SUPPLIER_SYNC)} element={<SupplierSyncPage />} />

              {/* Orders — the reference list + detail pair every other list
                and detail screen is assembled the same way. */}
              <Route path={rel(ADMIN_ROUTES.ORDERS)} element={<OrdersPage />} />
              <Route path={rel(ADMIN_ROUTES.ORDER_DETAIL)} element={<OrderDetailPage />} />
              <Route path={rel(ADMIN_ROUTES.SUB_ORDERS)} element={<SubOrdersPage />} />
              <Route path={rel(ADMIN_ROUTES.SUB_ORDER_DETAIL)} element={<SubOrderDetailPage />} />
              <Route path={rel(ADMIN_ROUTES.SHIPMENTS)} element={<ShipmentsPage />} />
              <Route path={rel(ADMIN_ROUTES.CARRIER_SHIPMENTS)} element={<CarrierShipmentsPage />} />
              <Route path={rel(ADMIN_ROUTES.CARRIER_ACCOUNTS)} element={<CarrierAccountsPage />} />
              <Route path={rel(ADMIN_ROUTES.RTO)} element={<RtoPage />} />
              <Route path={rel(ADMIN_ROUTES.RETURNS)} element={<ReturnsPage />} />
              <Route path={rel(ADMIN_ROUTES.RETURN_DETAIL)} element={<ReturnDetailPage />} />
              <Route path={rel(ADMIN_ROUTES.CANCELLATIONS)} element={<CancellationsPage />} />
              <Route path={rel(ADMIN_ROUTES.INVOICES)} element={<InvoicesPage />} />
              <Route path={rel(ADMIN_ROUTES.INVOICE_DETAIL)} element={<InvoiceDetailPage />} />

              {/* Dropshipping Module */}
              <Route path={rel(ADMIN_ROUTES.DROPSHIPPING_OVERVIEW)} element={<DropshippingOverviewPage />} />
              <Route path={rel(ADMIN_ROUTES.DROPSHIPPING_PARTNERS)} element={<DropshippingPartnersPage />} />
              <Route path={rel(ADMIN_ROUTES.DROPSHIPPING_PRODUCTS)} element={<DropshippingProductsPage />} />
              <Route path={rel(ADMIN_ROUTES.DROPSHIPPING_ORDERS)} element={<DropshippingOrdersPage />} />
              <Route path={rel(ADMIN_ROUTES.DROPSHIPPING_MARGINS)} element={<DropshippingMarginsPage />} />

              {/* CJ Dropshipping Module — provider-specific, admin-only. */}
              <Route path={rel(ADMIN_ROUTES.CJ_DASHBOARD)} element={<CjDashboardPage />} />
              <Route path={rel(ADMIN_ROUTES.CJ_CATALOGUE)} element={<CjCataloguePage />} />
              <Route path={rel(ADMIN_ROUTES.CJ_CATEGORY)} element={<CjCategoryPage />} />
              <Route path={rel(ADMIN_ROUTES.CJ_PRODUCTS)} element={<CjProductsPage />} />
              <Route path={rel(ADMIN_ROUTES.CJ_PRODUCT_DETAIL)} element={<CjProductDetailPage />} />
              <Route path={rel(ADMIN_ROUTES.CJ_ORDERS)} element={<CjOrdersPage />} />
              <Route path={rel(ADMIN_ROUTES.CJ_SHIPMENTS)} element={<CjShipmentsPage />} />
              <Route path={rel(ADMIN_ROUTES.CJ_DISPUTES)} element={<CjDisputesPage />} />
              <Route path={rel(ADMIN_ROUTES.CJ_SYNC_LOGS)} element={<CjSyncLogsPage />} />
              <Route path={rel(ADMIN_ROUTES.CJ_SETTINGS)} element={<CjSettingsPage />} />

              {/* People. The customer, B2B, partner, company and channel lists
                are the same screen with a different default filter. */}
              <Route path={rel(ADMIN_ROUTES.CUSTOMERS)} element={<CustomersPage />} />
              <Route path={rel(ADMIN_ROUTES.B2B_BUYERS)} element={<CustomersPage />} />
              <Route path={rel(ADMIN_ROUTES.CUSTOMER_DETAIL)} element={<CustomersPage />} />
              <Route path={rel(ADMIN_ROUTES.SELLERS)} element={<VendorsPage />} />
              <Route path={rel(ADMIN_ROUTES.SELLER_DETAIL)} element={<VendorsPage />} />
              <Route path={rel(ADMIN_ROUTES.PARTNERS)} element={<VendorsPage />} />
              <Route path={rel(ADMIN_ROUTES.PARTNER_DETAIL)} element={<VendorsPage />} />
              <Route path={rel(ADMIN_ROUTES.COMPANIES)} element={<VendorsPage />} />
              <Route path={rel(ADMIN_ROUTES.CHANNEL_PARTNERS)} element={<VendorsPage />} />
              <Route path={rel(ADMIN_ROUTES.KYC_QUEUE)} element={<KycQueuePage />} />
              <Route path={rel(ADMIN_ROUTES.KYC_REVIEW)} element={<KycReviewPage />} />
              <Route path={rel(ADMIN_ROUTES.POLICY_ACCEPTANCES)} element={<PolicyAcceptancesPage />} />
              <Route path={rel(ADMIN_ROUTES.USER_MANAGEMENT)} element={<UserManagementPage />} />
              <Route path={rel(ADMIN_ROUTES.ROLES)} element={<RolesManagementPage />} />

              {/* Finance & accounting */}
              <Route
                path={rel(ADMIN_ROUTES.FINANCE_OVERVIEW)}
                element={
                  <Suspense fallback={<ChunkFallback />}>
                    <FinanceOverviewPage />
                  </Suspense>
                }
              />
              <Route path={rel(ADMIN_ROUTES.TRANSACTIONS)} element={<TransactionsPage />} />
              <Route path={rel(ADMIN_ROUTES.REFUNDS)} element={<RefundsPage />} />
              <Route path={rel(ADMIN_ROUTES.SETTLEMENTS)} element={<SettlementsPage />} />
              <Route path={rel(ADMIN_ROUTES.SETTLEMENT_BATCH)} element={<SettlementBatchPage />} />
              <Route path={rel(ADMIN_ROUTES.VENDOR_LEDGERS)} element={<VendorLedgersPage />} />
              <Route path={rel(ADMIN_ROUTES.VENDOR_LEDGER_DETAIL)} element={<VendorStatementPage />} />
              <Route path={rel(ADMIN_ROUTES.COMMISSION_RULES)} element={<CommissionRulesPage />} />
              <Route path={rel(ADMIN_ROUTES.PRICING_RULES)} element={<PricingRulesPage />} />
              <Route path={rel(ADMIN_ROUTES.CHART_OF_ACCOUNTS)} element={<ChartOfAccountsPage />} />
              <Route path={rel(ADMIN_ROUTES.JOURNAL_VOUCHERS)} element={<JournalVouchersPage />} />
              <Route path={rel(ADMIN_ROUTES.EXPENSES)} element={<ExpensesPage />} />
              <Route path={rel(ADMIN_ROUTES.PNL)} element={<ProfitAndLossPage />} />
              <Route path={rel(ADMIN_ROUTES.BALANCE_SHEET)} element={<BalanceSheetPage />} />
              <Route path={rel(ADMIN_ROUTES.TRIAL_BALANCE)} element={<TrialBalancePage />} />
              <Route path={rel(ADMIN_ROUTES.CASH_FLOW)} element={<CashFlowPage />} />
              <Route path={rel(ADMIN_ROUTES.TAX_CENTER)} element={<TaxCentrePage />} />

              {/* Accounting — the marketplace money trail. Eight screens plus
                their detail views. */}
              <Route
                path={rel(ADMIN_ROUTES.ACCOUNTING)}
                element={
                  <Suspense fallback={<ChunkFallback />}>
                    <AccountingOverviewPage />
                  </Suspense>
                }
              />
              <Route
                path={rel(ADMIN_ROUTES.ACCOUNTING_TRANSACTIONS)}
                element={<AccountingTransactionsPage />}
              />
              <Route
                path={rel(ADMIN_ROUTES.ACCOUNTING_TRANSACTION_DETAIL)}
                element={<AccountingTransactionDetailPage />}
              />
              <Route path={rel(ADMIN_ROUTES.ACCOUNTING_SELLER_LEDGER)} element={<SellerLedgerListPage />} />
              <Route
                path={rel(ADMIN_ROUTES.ACCOUNTING_SELLER_LEDGER_DETAIL)}
                element={<SellerLedgerDetailPage />}
              />
              <Route path={rel(ADMIN_ROUTES.ACCOUNTING_COMMISSIONS)} element={<CommissionsPage />} />
              <Route
                path={rel(ADMIN_ROUTES.ACCOUNTING_SETTLEMENTS)}
                element={<AccountingSettlementsPage />}
              />
              <Route
                path={rel(ADMIN_ROUTES.ACCOUNTING_SETTLEMENT_DETAIL)}
                element={<AccountingSettlementDetailPage />}
              />
              <Route path={rel(ADMIN_ROUTES.ACCOUNTING_PAYOUTS)} element={<PayoutsPage />} />
              <Route path={rel(ADMIN_ROUTES.ACCOUNTING_PAYOUT_DETAIL)} element={<PayoutDetailPage />} />
              <Route path={rel(ADMIN_ROUTES.ACCOUNTING_REFUNDS)} element={<AccountingRefundsPage />} />
              <Route path={rel(ADMIN_ROUTES.ACCOUNTING_REPORTS)} element={<AccountingReportsPage />} />
              <Route
                path={rel(ADMIN_ROUTES.ACCOUNTING_REPORT_DETAIL)}
                element={<AccountingReportRunnerPage />}
              />

              {/* Accounts MVP — separate, minimal money screens (not the
                Accounting module above). */}
              <Route path={rel(ADMIN_ROUTES.ACCOUNTS_DASHBOARD)} element={<AccountsDashboardPage />} />
              <Route path={rel(ADMIN_ROUTES.ACCOUNTS_PAYOUTS)} element={<VendorPayoutsPage />} />
              <Route path={rel(ADMIN_ROUTES.ACCOUNTS_TRANSACTIONS)} element={<AccountsTransactionsPage />} />
              <Route path={rel(ADMIN_ROUTES.ACCOUNTS_LEDGER)} element={<LedgerPage />} />

              {/* Marketing, content & reports */}
              <Route path={rel(ADMIN_ROUTES.COUPONS)} element={<CouponsPage />} />
              <Route path={rel(ADMIN_ROUTES.OFFERS)} element={<OffersPage />} />
              <Route path={rel(ADMIN_ROUTES.BANNERS)} element={<BannersPage />} />
              <Route path={rel(ADMIN_ROUTES.CMS_PAGES)} element={<CmsPagesPage />} />
              <Route path={rel(ADMIN_ROUTES.CAMPAIGNS)} element={<CampaignsPage />} />
              <Route path={rel(ADMIN_ROUTES.TEMPLATES)} element={<TemplatesPage />} />
              <Route path={rel(ADMIN_ROUTES.REVIEWS)} element={<ReviewsPage />} />
              <Route path={rel(ADMIN_ROUTES.REPORTS)} element={<ReportsPage />} />
              <Route path={rel(ADMIN_ROUTES.REPORT_RUNNER)} element={<ReportRunnerPage />} />

              {/* Settings & system */}
              <Route path="settings" element={<Navigate to={ADMIN_ROUTES.SETTINGS_GENERAL} replace />} />
              <Route path="payments" element={<Navigate to={ADMIN_ROUTES.SETTINGS_PAYMENTS} replace />} />
              <Route path="payment-methods" element={<Navigate to={ADMIN_ROUTES.SETTINGS_PAYMENTS} replace />} />
              <Route path={rel(ADMIN_ROUTES.SETTINGS_GENERAL)} element={<GeneralSettingsPage />} />
              <Route path={rel(ADMIN_ROUTES.SETTINGS_BUSINESS_RULES)} element={<BusinessRulesPage />} />
              <Route path={rel(ADMIN_ROUTES.SETTINGS_TAXES)} element={<TaxSettingsPage />} />
              <Route path={rel(ADMIN_ROUTES.SETTINGS_POLICIES)} element={<PoliciesPage />} />
              <Route path={rel(ADMIN_ROUTES.SETTINGS_PAYMENTS)} element={<GeneralSettingsPage defaultTab="payments" />} />
              <Route path={rel(ADMIN_ROUTES.SETTINGS_LOGISTICS)} element={<LogisticsSettingsPage />} />
              <Route path={rel(ADMIN_ROUTES.SETTINGS_NOTIFICATIONS)} element={<NotificationSettingsPage />} />
              <Route path={rel(ADMIN_ROUTES.SETTINGS_INTEGRATIONS)} element={<IntegrationHealthPage />} />
              <Route path={rel(ADMIN_ROUTES.SETTINGS_SECURITY)} element={<GeneralSettingsPage defaultTab="security" />} />
              <Route path={rel(ADMIN_ROUTES.SETTINGS_API_WEBHOOKS)} element={<ApiWebhooksPage />} />
              <Route path={rel(ADMIN_ROUTES.AUDIT_LOGS)} element={<AuditLogPage />} />
              <Route path={rel(ADMIN_ROUTES.BACKUPS)} element={<BackupsPage />} />
              <Route path={rel(ADMIN_ROUTES.SUPPORT_TICKETS)} element={<SupportTicketsPage />} />
              <Route path={rel(ADMIN_ROUTES.SUPPORT_TICKET_DETAIL)} element={<SupportTicketDetailPage />} />
              <Route path={rel(ADMIN_ROUTES.PROFILE)} element={<AdminProfilePage />} />

              {/* Routes whose screen lands in a later phase. Navigation,
                breadcrumbs and the command palette all work today. */}
              {PLACEHOLDER_SCREENS.map((screen) => (
                <Route
                  key={screen.path}
                  path={rel(screen.path)}
                  element={
                    <PlaceholderPage
                      title={screen.title}
                      description={screen.description}
                      phase={screen.phase}
                    />
                  }
                />
              ))}

              <Route path={rel(ADMIN_ROUTES.SHOWCASE)} element={<ShowcasePage />} />
              <Route path={rel(ADMIN_ROUTES.FORBIDDEN)} element={<ForbiddenPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </TranslationProvider>
  )
}

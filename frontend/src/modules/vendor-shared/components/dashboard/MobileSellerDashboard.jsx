import React, { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Icon } from '../../../../components/ui'
import { formatMoney, formatRelativeTime } from '../../../admin/lib/format'
import { VENDOR_ORDER_STATUS_TONE } from '../../constants'

const STATUS_PILL_STYLES = {
  warning: 'bg-amber-50 text-amber-700 border-amber-200/80',
  brand: 'bg-blue-50 text-blue-700 border-blue-200/80',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
  danger: 'bg-rose-50 text-rose-700 border-rose-200/80',
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function shortDate(dateStr) {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

export function MobileSellerDashboard({
  summary,
  analytics,
  orders,
  basePath = '/seller',
}) {
  const [chartRange, setChartRange] = useState('30D') // '7D' | '30D'
  const greeting = getGreeting()

  const salesTrend = analytics?.salesTrend ?? []
  const statusBreakdown = analytics?.orderStatusBreakdown ?? {}

  // Filter trend data according to selected period
  const filteredTrend = useMemo(() => {
    if (!salesTrend.length) return []
    const count = chartRange === '7D' ? 7 : 30
    return salesTrend.slice(-count).map((point) => ({
      date: point.date,
      label: shortDate(point.date),
      revenue: point.revenue,
      rupees: Math.round(point.revenue / 100),
      orders: point.orders,
    }))
  }, [salesTrend, chartRange])

  const totalPeriodRevenue = useMemo(() => {
    return filteredTrend.reduce((acc, curr) => acc + (curr.revenue || 0), 0)
  }, [filteredTrend])

  const recentOrdersList = (orders?.items || []).slice(0, 5)

  const pendingCount = summary?.pendingOrdersCount || 0
  const processingCount = statusBreakdown?.PROCESSING || 0
  const shippedCount = statusBreakdown?.SHIPPED || 0
  const deliveredCount = statusBreakdown?.DELIVERED || 0
  const cancelledCount = statusBreakdown?.CANCELLED || 0

  return (
    <div className="font-sans px-3 pt-2 pb-6 space-y-2.5 max-w-md mx-auto bg-slate-50/70 min-h-screen">
      {/* 1. Store Header & Greeting Card - Compact & Clean */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-600 font-bold text-xs text-white shadow-xs ring-2 ring-brand-100/70">
              {summary?.storeName ? summary.storeName.slice(0, 2).toUpperCase() : 'AM'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-xs font-semibold text-slate-500">
                  {greeting},
                </span>
                <span className="text-[10px] text-slate-400">
                  {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
              </div>
              <h1 className="text-sm font-bold tracking-tight text-slate-900 flex items-center gap-1 truncate">
                <span className="truncate max-w-[170px]">{summary?.storeName || 'Arya Manufacturing'}</span>
                <span className="inline-flex items-center text-brand-600 shrink-0" title="Verified Marketplace Seller">
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </span>
                <span className="inline-flex items-center gap-1 text-[9.5px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60 ml-0.5 shrink-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Active
                </span>
              </h1>
            </div>
          </div>

          <Link
            to={`${basePath}/products`}
            className="shrink-0 flex items-center gap-1 rounded-lg bg-brand-600 hover:bg-brand-700 px-2.5 py-1.5 text-xs font-semibold text-white shadow-xs active:scale-95 transition-all"
          >
            <Icon name="add" className="h-3 w-3 stroke-[2.5]" />
            <span>Add SKU</span>
          </Link>
        </div>
      </div>

      {/* 2. KYC Alert Banner (if pending) */}
      {summary?.kycStatus !== 'approved' && (
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 p-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="flex items-start gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white shadow-xs mt-0.5">
              <Icon name="shield" className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-amber-900 tracking-tight">KYC Verification Required</h4>
                <Link
                  to={`${basePath}/kyc-documents`}
                  className="text-[11px] font-bold text-amber-900 hover:underline flex items-center gap-0.5"
                >
                  Verify <Icon name="arrowRight" className="h-2.5 w-2.5" />
                </Link>
              </div>
              <p className="mt-0.5 text-2xs text-amber-800 leading-snug">
                Upload PAN, GST & Bank details to unlock automated direct settlements.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 3. Fast Action Shortcut Grid - Compact Tiles */}
      <div className="grid grid-cols-5 gap-1.5 select-none">
        <Link
          to={`${basePath}/products`}
          className="flex flex-col items-center justify-center gap-1 rounded-xl bg-white py-1.5 px-0.5 border border-slate-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:border-slate-300 active:scale-95 transition-all"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Icon name="add" className="h-3.5 w-3.5" />
          </div>
          <span className="text-[10px] font-semibold text-slate-700 text-center leading-none">
            Add SKU
          </span>
        </Link>

        <Link
          to={`${basePath}/orders`}
          className="relative flex flex-col items-center justify-center gap-1 rounded-xl bg-white py-1.5 px-0.5 border border-slate-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:border-slate-300 active:scale-95 transition-all"
        >
          {pendingCount > 0 && (
            <span className="absolute top-1 right-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-amber-500 px-0.5 text-[8.5px] font-bold text-white shadow-xs">
              {pendingCount}
            </span>
          )}
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            <Icon name="orders" className="h-3.5 w-3.5" />
          </div>
          <span className="text-[10px] font-semibold text-slate-700 text-center leading-none">
            Orders
          </span>
        </Link>

        <Link
          to={`${basePath}/earnings`}
          className="flex flex-col items-center justify-center gap-1 rounded-xl bg-white py-1.5 px-0.5 border border-slate-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:border-slate-300 active:scale-95 transition-all"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <Icon name="settlements" className="h-3.5 w-3.5" />
          </div>
          <span className="text-[10px] font-semibold text-slate-700 text-center leading-none">
            Payouts
          </span>
        </Link>

        <Link
          to={`${basePath}/analytics`}
          className="flex flex-col items-center justify-center gap-1 rounded-xl bg-white py-1.5 px-0.5 border border-slate-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:border-slate-300 active:scale-95 transition-all"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
            <Icon name="analytics" className="h-3.5 w-3.5" />
          </div>
          <span className="text-[10px] font-semibold text-slate-700 text-center leading-none">
            Analytics
          </span>
        </Link>

        <Link
          to={`${basePath}/kyc-documents`}
          className="flex flex-col items-center justify-center gap-1 rounded-xl bg-white py-1.5 px-0.5 border border-slate-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:border-slate-300 active:scale-95 transition-all"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
            <Icon name="kyc" className="h-3.5 w-3.5" />
          </div>
          <span className="text-[10px] font-semibold text-slate-700 text-center leading-none">
            KYC Docs
          </span>
        </Link>
      </div>

      {/* 4. App-Style KPI Metric Cards (2x2 Grid) - Executive & Clean */}
      <div className="grid grid-cols-2 gap-2">
        {/* Card 1: Delivered Revenue */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500">
              Delivered Revenue
            </span>
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
              <Icon name="money" className="h-3 w-3" />
            </div>
          </div>
          <div className="mt-1">
            <p className="text-lg font-bold tracking-tight text-slate-900 tabular-nums">
              {formatMoney(summary?.totalRevenue ?? 0)}
            </p>
            <p className="text-[10px] font-medium text-emerald-700 flex items-center gap-1 mt-0.5">
              <Icon name="check" className="h-2.5 w-2.5 stroke-[2.5]" />
              Completed orders
            </p>
          </div>
        </div>

        {/* Card 2: Pending Orders */}
        <Link
          to={`${basePath}/orders`}
          className="rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:border-amber-300 active:scale-[0.98] transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500">
              Pending Orders
            </span>
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-50 text-amber-600">
              <Icon name="pending" className="h-3 w-3" />
            </div>
          </div>
          <div className="mt-1">
            <p className="text-lg font-bold tracking-tight text-slate-900 tabular-nums">
              {pendingCount}
            </p>
            <p className="text-[10px] font-medium text-amber-700 flex items-center gap-0.5 mt-0.5">
              <span>Action required</span>
              <Icon name="chevronRight" className="h-2.5 w-2.5" />
            </p>
          </div>
        </Link>

        {/* Card 3: Live SKUs */}
        <Link
          to={`${basePath}/products`}
          className="rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:border-blue-300 active:scale-[0.98] transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500">
              Live Products
            </span>
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-50 text-blue-600">
              <Icon name="products" className="h-3 w-3" />
            </div>
          </div>
          <div className="mt-1">
            <p className="text-lg font-bold tracking-tight text-slate-900 tabular-nums">
              {summary?.liveSkusCount ?? 0}
            </p>
            <p className="text-[10px] font-medium text-blue-700 flex items-center gap-1 mt-0.5">
              <Icon name="live" className="h-2.5 w-2.5" />
              Active in catalog
            </p>
          </div>
        </Link>

        {/* Card 4: Due for Payout */}
        <Link
          to={`${basePath}/earnings`}
          className="rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:border-purple-300 active:scale-[0.98] transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500">
              Due Payout
            </span>
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-purple-50 text-purple-600">
              <Icon name="settlements" className="h-3 w-3" />
            </div>
          </div>
          <div className="mt-1">
            <p className="text-lg font-bold tracking-tight text-slate-900 tabular-nums">
              {formatMoney(summary?.availablePayout ?? 0)}
            </p>
            <p className="text-[10px] font-medium text-purple-700 mt-0.5">
              Settlement due
            </p>
          </div>
        </Link>
      </div>

      {/* 5. Order Pipeline Fulfillment Funnel - Compact */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <h3 className="text-xs font-bold text-slate-900 tracking-tight">Order Pipeline</h3>
            <span className="text-[10px] text-slate-400 font-medium">Live breakdown</span>
          </div>
          <Link
            to={`${basePath}/orders`}
            className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-0.5"
          >
            All Orders <Icon name="chevronRight" className="h-2.5 w-2.5" />
          </Link>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {/* Pending */}
          <Link
            to={`${basePath}/orders`}
            className="flex flex-col items-center justify-center rounded-lg bg-amber-50/70 border border-amber-200/50 p-1.5 active:scale-95 transition-transform"
          >
            <span className="text-xs font-bold text-amber-800 tabular-nums">{pendingCount}</span>
            <span className="text-[9.5px] font-semibold text-amber-700">Pending</span>
          </Link>

          {/* Processing */}
          <Link
            to={`${basePath}/orders`}
            className="flex flex-col items-center justify-center rounded-lg bg-blue-50/70 border border-blue-200/50 p-1.5 active:scale-95 transition-transform"
          >
            <span className="text-xs font-bold text-blue-800 tabular-nums">{processingCount}</span>
            <span className="text-[9.5px] font-semibold text-blue-700">Processing</span>
          </Link>

          {/* Shipped */}
          <Link
            to={`${basePath}/orders`}
            className="flex flex-col items-center justify-center rounded-lg bg-purple-50/70 border border-purple-200/50 p-1.5 active:scale-95 transition-transform"
          >
            <span className="text-xs font-bold text-purple-800 tabular-nums">{shippedCount}</span>
            <span className="text-[9.5px] font-semibold text-purple-700">Shipped</span>
          </Link>

          {/* Delivered */}
          <Link
            to={`${basePath}/orders`}
            className="flex flex-col items-center justify-center rounded-lg bg-emerald-50/70 border border-emerald-200/50 p-1.5 active:scale-95 transition-transform"
          >
            <span className="text-xs font-bold text-emerald-800 tabular-nums">{deliveredCount}</span>
            <span className="text-[9.5px] font-semibold text-emerald-700">Delivered</span>
          </Link>
        </div>

        {cancelledCount > 0 && (
          <div className="mt-2 flex items-center justify-between rounded-md bg-rose-50 px-2 py-1 text-[10px] text-rose-700 border border-rose-100">
            <span className="flex items-center gap-1 font-medium">
              <Icon name="danger" className="h-3 w-3" />
              {cancelledCount} Cancelled Orders
            </span>
            <Link to={`${basePath}/orders`} className="font-bold underline">
              View
            </Link>
          </div>
        )}
      </div>

      {/* 6. Revenue Trend Performance Chart - Compact & Sleek */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="flex items-center justify-between mb-1.5">
          <div>
            <h3 className="text-xs font-bold text-slate-900 tracking-tight">Revenue Trend</h3>
            <p className="text-[10px] text-slate-500">
              {chartRange === '7D' ? 'Last 7 days' : 'Last 30 days'}:{' '}
              <strong className="text-slate-900 font-semibold">{formatMoney(totalPeriodRevenue)}</strong>
            </p>
          </div>

          <div className="flex items-center rounded-lg bg-slate-100 p-0.5 border border-slate-200/60">
            <button
              type="button"
              onClick={() => setChartRange('7D')}
              className={`rounded-md px-2 py-0.5 text-[10px] font-bold transition-colors ${
                chartRange === '7D' ? 'bg-white text-brand-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              7D
            </button>
            <button
              type="button"
              onClick={() => setChartRange('30D')}
              className={`rounded-md px-2 py-0.5 text-[10px] font-bold transition-colors ${
                chartRange === '30D' ? 'bg-white text-brand-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              30D
            </button>
          </div>
        </div>

        <div className="h-36 w-full mt-1">
          {filteredTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={filteredTrend} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="mobileSalesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 9.5, fill: '#94a3b8' }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 9.5, fill: '#94a3b8' }}
                  tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                  width={38}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload
                      return (
                        <div className="rounded-lg border border-slate-200 bg-white/95 px-2 py-1 shadow-md backdrop-blur-sm">
                          <p className="text-[9.5px] font-medium text-slate-500">{data.label}</p>
                          <p className="text-[11px] font-bold text-brand-700">
                            {formatMoney(data.revenue)}
                          </p>
                          <p className="text-[9.5px] text-slate-600">{data.orders} orders</p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="rupees"
                  stroke="#2563eb"
                  strokeWidth={2}
                  fill="url(#mobileSalesGrad)"
                  dot={false}
                  activeDot={{ r: 3.5, strokeWidth: 1.5, stroke: '#ffffff', fill: '#2563eb' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-slate-400">
              No revenue recorded for this period
            </div>
          )}
        </div>
      </div>

      {/* 7. Recent Orders (Native Mobile Cards) - Compact */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-0.5">
          <h3 className="text-xs font-bold text-slate-900 tracking-tight">Recent Orders</h3>
          <Link
            to={`${basePath}/orders`}
            className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-0.5"
          >
            View All ({orders?.total ?? recentOrdersList.length}) <Icon name="chevronRight" className="h-2.5 w-2.5" />
          </Link>
        </div>

        {recentOrdersList.length === 0 ? (
          <div className="rounded-xl border border-slate-200/80 bg-white p-4 text-center shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
              <Icon name="orders" className="h-4 w-4" />
            </div>
            <p className="mt-1.5 text-xs font-bold text-slate-700">No Orders Placed Yet</p>
            <p className="text-[10px] text-slate-400">
              Live orders from buyers will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {recentOrdersList.map((order) => {
              const tone = VENDOR_ORDER_STATUS_TONE[order.status] || 'neutral'
              const pillClass = STATUS_PILL_STYLES[tone] || STATUS_PILL_STYLES.neutral
              const firstItem = order.items?.[0]
              const itemsCount = order.items?.length || 1

              return (
                <Link
                  key={order.id}
                  to={`${basePath}/orders`}
                  className="block rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:border-brand-200 active:scale-[0.99] transition-all"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] font-bold text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded border border-brand-100">
                        #{order.id.slice(-8).toUpperCase()}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {order.createdAt ? formatRelativeTime(order.createdAt) : 'Recent'}
                      </span>
                    </div>

                    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${pillClass}`}>
                      {order.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 pt-2">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400 border border-slate-200/60 overflow-hidden">
                      {firstItem?.image ? (
                        <img
                          src={firstItem.image}
                          alt={firstItem.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Icon name="products" className="h-4 w-4 text-slate-400" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="truncate text-xs font-semibold text-slate-900">
                        {firstItem?.name || 'Catalog Item'}
                      </h4>
                      <p className="truncate text-[10px] text-slate-500">
                        Buyer: <span className="font-medium text-slate-700">{order.customer?.name || 'Customer'}</span>
                        {itemsCount > 1 && ` • +${itemsCount - 1} more`}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-slate-900 tabular-nums">
                        {formatMoney(order.itemsValue ?? 0)}
                      </p>
                      <span className="text-[10px] font-semibold text-brand-600 flex items-center justify-end gap-0.5">
                        Process <Icon name="chevronRight" className="h-2 w-2" />
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}

            <Link
              to={`${basePath}/orders`}
              className="flex w-full items-center justify-center gap-1 rounded-lg border border-slate-200/80 bg-white py-2 text-xs font-semibold text-slate-700 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:bg-slate-50 active:scale-98 transition-all"
            >
              <span>View All Orders</span>
              <Icon name="arrowRight" className="h-3 w-3" />
            </Link>
          </div>
        )}
      </div>

      {/* 8. Seller Tools Quick Hub - Compact */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <h3 className="text-xs font-bold text-slate-900 tracking-tight mb-2">
          Management Hub
        </h3>

        <div className="grid grid-cols-2 gap-1.5">
          <Link
            to={`${basePath}/inventory`}
            className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/60 p-2 hover:bg-slate-100/70 transition-colors"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white shadow-xs text-blue-600">
              <Icon name="inventory" className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate">Inventory</p>
              <p className="text-[9.5px] text-slate-400 truncate">Stock levels</p>
            </div>
          </Link>

          <Link
            to={`${basePath}/shipping`}
            className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/60 p-2 hover:bg-slate-100/70 transition-colors"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white shadow-xs text-emerald-600">
              <Icon name="shipments" className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate">Shipping</p>
              <p className="text-[9.5px] text-slate-400 truncate">Labels & AWB</p>
            </div>
          </Link>

          <Link
            to={`${basePath}/reviews`}
            className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/60 p-2 hover:bg-slate-100/70 transition-colors"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white shadow-xs text-amber-600">
              <Icon name="reviews" className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate">Reviews</p>
              <p className="text-[9.5px] text-slate-400 truncate">Buyer feedback</p>
            </div>
          </Link>

          <Link
            to={`${basePath}/coupons`}
            className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/60 p-2 hover:bg-slate-100/70 transition-colors"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white shadow-xs text-purple-600">
              <Icon name="coupons" className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate">Coupons</p>
              <p className="text-[9.5px] text-slate-400 truncate">Discounts</p>
            </div>
          </Link>
        </div>
      </div>

      {/* 9. Support & Live Sync Footer */}
      <div className="flex items-center justify-between rounded-lg bg-slate-200/50 px-2.5 py-1.5 text-[10px] text-slate-500">
        <span className="flex items-center gap-1 font-medium">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Krozenda Seller • Realtime
        </span>
        <Link to={`${basePath}/tickets`} className="font-semibold text-brand-700 hover:underline">
          Help & Support
        </Link>
      </div>
    </div>
  )
}

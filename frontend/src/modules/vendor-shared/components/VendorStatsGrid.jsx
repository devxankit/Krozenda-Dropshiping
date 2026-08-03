// Module-local presentational component — takes already-fetched data as
// props, same "no axios" rule as components/ui applies here too.
export function VendorStatsGrid({ summary }) {
  const stats = [
    { label: 'Total Orders', value: summary.totalOrders },
    { label: 'Pending Orders', value: summary.pendingOrders },
    { label: 'Total Revenue', value: `₹${summary.totalRevenue.toLocaleString('en-IN')}` },
    { label: 'Pending Settlement', value: `₹${summary.pendingSettlement.toLocaleString('en-IN')}` },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-lg border border-border bg-surface p-4">
          <p className="text-sm text-slate-500">{stat.label}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{stat.value}</p>
        </div>
      ))}
    </div>
  )
}

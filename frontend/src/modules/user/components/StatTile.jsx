export function StatTile({ label, value }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  )
}

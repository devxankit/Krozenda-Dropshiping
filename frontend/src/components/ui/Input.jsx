export function Input({ label, error, id, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <input
        id={id}
        className={`h-10 rounded-md border px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 ${error ? 'border-danger-500' : 'border-border'} ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-danger-700">{error}</span>}
    </div>
  )
}

export function Select({ label, error, id, options = [], placeholder, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <select
        id={id}
        className={`h-10 rounded-md border bg-surface px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 ${error ? 'border-danger-500' : 'border-border'} ${className}`}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-danger-700">{error}</span>}
    </div>
  )
}

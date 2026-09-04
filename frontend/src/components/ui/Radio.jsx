// Two presentations of the same control. `RadioGroup` is the plain list;
// `RadioCards` is the boxed variant used where each option needs a sentence
// of explanation (product type, payout approval mode).
// options: [{ value, label, description?, disabled? }]

function Dot({ selected }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 peer-focus-visible:ring-offset-1 ${selected ? 'border-brand-600 bg-brand-600' : 'border-border-strong bg-surface'}`}
    >
      {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
    </span>
  )
}

export function RadioGroup({ name, value, options = [], onChange, label, className = '' }) {
  return (
    <fieldset className={`flex flex-col gap-2 ${className}`}>
      {label && (
        <legend className="mb-1 text-sm font-medium text-slate-700">{label}</legend>
      )}
      {options.map((option) => (
        <label
          key={option.value}
          className={`inline-flex items-start gap-2 ${option.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
        >
          <span className="relative flex h-4 w-4 items-center justify-center">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              disabled={option.disabled}
              onChange={() => onChange?.(option.value)}
              className="peer absolute h-4 w-4 cursor-pointer opacity-0"
            />
            <Dot selected={value === option.value} />
          </span>
          <span className="flex flex-col gap-0.5 leading-tight">
            <span className="text-sm text-slate-800">{option.label}</span>
            {option.description && (
              <span className="text-xs text-ink-faint">{option.description}</span>
            )}
          </span>
        </label>
      ))}
    </fieldset>
  )
}

export function RadioCards({
  name,
  value,
  options = [],
  onChange,
  label,
  columns = 1,
  className = '',
}) {
  return (
    <fieldset className={className}>
      {label && <legend className="mb-2 text-sm font-medium text-slate-700">{label}</legend>}
      <div
        className="grid gap-2.5"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {options.map((option) => {
          const selected = value === option.value
          return (
            <label
              key={option.value}
              className={`flex items-start gap-2.5 rounded-lg border p-3 transition-colors ${option.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${selected ? 'border-brand-600 bg-brand-50/50 ring-1 ring-brand-600' : 'border-border bg-surface hover:bg-surface-muted'}`}
            >
              <span className="relative mt-0.5 flex h-4 w-4 items-center justify-center">
                <input
                  type="radio"
                  name={name}
                  value={option.value}
                  checked={selected}
                  disabled={option.disabled}
                  onChange={() => onChange?.(option.value)}
                  className="peer absolute h-4 w-4 cursor-pointer opacity-0"
                />
                <Dot selected={selected} />
              </span>
              <span className="flex flex-col gap-0.5 leading-tight">
                <span
                  className={`text-sm font-medium ${selected ? 'text-slate-900' : 'text-slate-700'}`}
                >
                  {option.label}
                </span>
                {option.description && (
                  <span className="text-xs leading-snug text-ink-faint">{option.description}</span>
                )}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

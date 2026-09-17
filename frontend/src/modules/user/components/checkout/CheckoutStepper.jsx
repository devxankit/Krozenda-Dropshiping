// The three-step checkout progress bar (Address -> Order Summary -> Payment).
const STEPS = ['Address', 'Order Summary', 'Payment']

export function CheckoutStepper({ current }) {
  return (
    <div className="mb-4 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm sm:p-5">
      {/* Mobile view */}
      <div className="flex items-center justify-between text-xs font-bold text-slate-700 sm:hidden">
        <span className="font-black text-blue-700">
          Step {current} of {STEPS.length}: {STEPS[current - 1]}
        </span>
        {current === STEPS.length ? (
          <span className="font-bold text-emerald-600">Final Step</span>
        ) : (
          <span className="text-slate-400">Next: {STEPS[current]}</span>
        )}
      </div>

      {/* Desktop view */}
      <ol className="mx-auto hidden max-w-2xl items-center justify-between text-xs font-bold sm:flex">
        {STEPS.map((label, index) => {
          const step = index + 1
          const done = step < current
          const active = step === current
          const isLast = step === STEPS.length

          return (
            <li key={label} className="flex items-center gap-2">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] transition-colors ${
                  done
                    ? 'bg-emerald-100 text-emerald-700 font-bold'
                    : active
                      ? 'bg-blue-700 text-white font-black'
                      : 'bg-slate-100 text-slate-400 font-semibold'
                }`}
                aria-hidden="true"
              >
                {done ? '✓' : step}
              </span>
              <span
                className={done ? 'text-emerald-600' : active ? 'font-black text-blue-700' : 'text-slate-400'}
                aria-current={active ? 'step' : undefined}
              >
                {label}
              </span>
              {!isLast && (
                <div className={`mx-4 h-0.5 w-16 lg:w-28 transition-colors ${done ? 'bg-emerald-600' : 'bg-slate-200'}`} />
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

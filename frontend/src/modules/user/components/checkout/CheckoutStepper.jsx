// The four-step checkout progress bar.
//
// Shared because it was copy-pasted into each screen, which is how step 2 came
// to be called "Delivery" in three places and mean something different in each.
// One list, one component: renaming a step is a one-line change.

const STEPS = ['Address', 'Payment', 'Summary', 'Pay']

export function CheckoutStepper({ current }) {
  return (
    <div className="mb-4 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm sm:p-5">
      {/* Phones get the words, not the rail — four labelled circles at that
          width are unreadable. */}
      <div className="flex items-center justify-between text-xs font-bold text-slate-700 sm:hidden">
        <span className="font-black text-blue-700">
          Step {current} of {STEPS.length}: {STEPS[current - 1]}
        </span>
        {current === STEPS.length && <span className="font-bold text-emerald-600">Final Step</span>}
      </div>

      <ol className="mx-auto hidden max-w-3xl items-center justify-between text-xs font-bold sm:flex">
        {STEPS.map((label, index) => {
          const step = index + 1
          const done = step < current
          const active = step === current
          const isLast = step === STEPS.length

          return (
            <li key={label} className="flex items-center gap-2">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${
                  done
                    ? 'bg-emerald-100 text-emerald-700'
                    : active
                      ? 'bg-blue-700 text-white'
                      : 'bg-slate-100 text-slate-400'
                }`}
                // The number is decorative; the label carries the meaning.
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
                <div className={`mx-3 h-0.5 w-8 lg:w-16 ${done ? 'bg-emerald-600' : 'bg-slate-200'}`} />
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

import { useRef } from 'react'

// Six boxes that behave like one field: typing advances, backspace retreats,
// and a pasted code fills every box. Anything less and admins paste the code
// from their authenticator and watch five digits vanish.
export function OtpInput({ value = '', onChange, length = 6, error, disabled }) {
  const inputsRef = useRef([])
  const digits = value.padEnd(length, ' ').slice(0, length).split('')

  function setDigit(index, digit) {
    const next = digits.map((current, position) => (position === index ? digit : current)).join('')
    onChange(next.replace(/\s+$/, ''))
  }

  function handleChange(index, raw) {
    const digit = raw.replace(/\D/g, '').slice(-1)
    if (!digit) return
    setDigit(index, digit)
    inputsRef.current[index + 1]?.focus()
  }

  function handleKeyDown(index, event) {
    if (event.key === 'Backspace') {
      event.preventDefault()
      if (digits[index].trim()) {
        setDigit(index, ' ')
      } else {
        inputsRef.current[index - 1]?.focus()
        setDigit(index - 1, ' ')
      }
    }
    if (event.key === 'ArrowLeft') inputsRef.current[index - 1]?.focus()
    if (event.key === 'ArrowRight') inputsRef.current[index + 1]?.focus()
  }

  function handlePaste(event) {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (!pasted) return
    event.preventDefault()
    onChange(pasted)
    inputsRef.current[Math.min(pasted.length, length - 1)]?.focus()
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2" onPaste={handlePaste}>
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(element) => {
              inputsRef.current[index] = element
            }}
            value={digit.trim()}
            onChange={(event) => handleChange(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            disabled={disabled}
            inputMode="numeric"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            aria-label={`Digit ${index + 1} of ${length}`}
            aria-invalid={error ? true : undefined}
            className={`tabular h-12 w-full rounded-md border bg-surface text-center text-lg font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-surface-muted ${
              error ? 'border-danger-500' : 'border-border-strong'
            }`}
          />
        ))}
      </div>
      {error && <span className="text-xs text-danger-700">{error}</span>}
    </div>
  )
}

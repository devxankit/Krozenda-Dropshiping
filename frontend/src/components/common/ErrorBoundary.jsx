import React from 'react'

// Without this, one thrown render error anywhere in the tree unmounts the
// whole app and leaves a blank white screen — which inside a Flutter WebView
// looks like the app itself crashed, with no way back short of killing it.
//
// Two usages:
//   <ErrorBoundary>            wraps a route; shows a recoverable full screen
//   <ErrorBoundary fallback={} wraps a section (a home rail, a product card);
//     the rest of the page keeps working and only that piece is replaced.
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Kept as a console error rather than swallowed: a render crash is a real
    // defect, and hiding it entirely would make it invisible in the field.
    console.error('[ErrorBoundary]', error, info?.componentStack)
    this.props.onError?.(error, info)
  }

  reset = () => {
    this.setState({ error: null })
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    if (this.props.fallback !== undefined) {
      return typeof this.props.fallback === 'function'
        ? this.props.fallback({ error, reset: this.reset })
        : this.props.fallback
    }

    return (
      <div
        role="alert"
        className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-4 px-6 text-center"
      >
        <div
          className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-2xl"
          aria-hidden="true"
        >
          {'⚠'}
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-bold text-slate-900">Something went wrong on this screen</h2>
          <p className="mx-auto max-w-sm text-xs text-slate-500">
            You can try again, or go back to the home page. Nothing in your cart or your orders has
            been affected.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={this.reset}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700"
          >
            Try again
          </button>
          <button
            type="button"
            // A hard navigation rather than a router push: the router itself
            // may be the thing that threw.
            onClick={() => {
              window.location.href = '/app/dashboard'
            }}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            Go to home
          </button>
        </div>
      </div>
    )
  }
}

// Section-level convenience: if one home rail or one card throws, it is
// replaced by a quiet placeholder and the rest of the page survives.
export function SectionErrorBoundary({ children, label = 'This section' }) {
  return (
    <ErrorBoundary
      fallback={({ reset }) => (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
          <p className="text-xs font-semibold text-slate-600">{label} could not be displayed.</p>
          <button
            type="button"
            onClick={reset}
            className="mt-2 text-xs font-bold text-blue-600 hover:underline"
          >
            Retry
          </button>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  )
}

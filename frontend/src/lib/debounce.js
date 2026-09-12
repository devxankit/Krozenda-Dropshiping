// Keyed debounce — a plain single-timer debounce would cancel a pending
// call for product A when the user then acts on product B. Each key gets
// its own timer, so a rapid like/unlike or quantity burst on one product
// collapses into one network call without ever touching another product's
// pending call.
export function keyedDebounce(fn, delay = 500) {
  const timers = new Map()

  return (key, ...args) => {
    clearTimeout(timers.get(key))
    const timer = setTimeout(() => {
      timers.delete(key)
      fn(key, ...args)
    }, delay)
    timers.set(key, timer)
  }
}

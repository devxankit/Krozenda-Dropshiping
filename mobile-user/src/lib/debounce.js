// Keyed debounce — each key gets its own timer (see the web app's lib/debounce.js).
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

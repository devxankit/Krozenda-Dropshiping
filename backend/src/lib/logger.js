// Minimal structured logger — no external dependency. Swap the console
// calls for a real transport (pino/winston) later without touching call
// sites, since everything imports `logger` from here.

function line(level, message, meta) {
  const timestamp = new Date().toISOString()
  const suffix = meta !== undefined ? ` ${meta instanceof Error ? meta.stack : JSON.stringify(meta)}` : ''
  return `[${timestamp}] ${level.toUpperCase()} ${message}${suffix}`
}

export const logger = Object.freeze({
  info: (message, meta) => console.log(line('info', message, meta)),
  warn: (message, meta) => console.warn(line('warn', message, meta)),
  error: (message, meta) => console.error(line('error', message, meta)),
  debug: (message, meta) => {
    if (process.env.NODE_ENV !== 'production') console.debug(line('debug', message, meta))
  },
})

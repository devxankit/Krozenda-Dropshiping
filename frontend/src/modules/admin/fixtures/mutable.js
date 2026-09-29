// Writes in the mock layer land in the same arrays the read fixtures page
// over, so a posted voucher appears in its list AND moves every statement
// derived from the chart of accounts. That is the point: the fixtures stay
// internally reconciled under writes, not just at rest.
//
// Nothing here survives a reload, and that is deliberate — the persistence
// story belongs to the API, not to the fixture layer standing in for it.

const counters = new Map()

/** Sequential, readable ids — `jv_7` reads better than a uuid in a table. */
export function nextId(prefix) {
  const next = (counters.get(prefix) ?? 0) + 1
  counters.set(prefix, next)
  return `${prefix}_${next}`
}

/** Newest first, matching how every list in the panel is ordered. */
export function insert(collection, row) {
  collection.unshift(row)
  return row
}

export function patch(collection, id, changes, key = 'id') {
  const index = collection.findIndex((row) => row[key] === id)
  if (index === -1) throw notFound(id)
  collection[index] = { ...collection[index], ...changes }
  return collection[index]
}

export function drop(collection, id, key = 'id') {
  const index = collection.findIndex((row) => row[key] === id)
  if (index === -1) throw notFound(id)
  return collection.splice(index, 1)[0]
}

export function findOr404(collection, id, key = 'id') {
  const row = collection.find((entry) => entry[key] === id)
  if (!row) throw notFound(id)
  return row
}

// Shaped like the API error envelope the services already throw, so error
// handling upstream does not have to special-case the mock path.
export function notFound(id) {
  return { status: 404, code: 'NOT_FOUND', message: `${id} no longer exists.`, details: null }
}

export function invalid(message, details = null) {
  return { status: 422, code: 'INVALID', message, details }
}

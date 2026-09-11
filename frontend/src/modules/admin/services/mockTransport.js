// Layer rule: services/ is the ONLY place that imports the axios instance —
// and the only place that knows a fixture exists. Everything above the
// service layer is written as if the API were live.
//
// The fixture goes through the SAME zod schema the real response will, so a
// fixture that drifts from the contract fails loudly here rather than
// producing a screen that quietly cannot work against the real endpoint.
// That makes fixtures/ an executable specification for the backend.

import { api } from '../../../lib/axios'
import { env } from '../../../config/env'

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/**
 * Resolve one read.
 *
 * @param {object}   options
 * @param {string}   options.path   API path, used when mocks are off.
 * @param {object}   [options.params] Query params for the live call.
 * @param {Function} options.fixture Returns the mocked payload.
 * @param {object}   options.schema  Zod schema applied to BOTH paths.
 * @param {boolean}  [options.live]  Hit the real API even while VITE_USE_MOCKS
 *   is on, for the handful of endpoints that are actually implemented.
 */
export async function fetchResource({ path, params, fixture, schema, live = false }) {
  if (env.useMocks && !live) {
    await delay(env.mockLatencyMs)
    return schema.parse(fixture())
  }

  // The backend always responds { success, message, data }; unwrap `data`.
  const { data } = await api.get(path, { params })
  return schema ? schema.parse(data.data) : data.data
}

/**
 * Resolve one write. Mocked writes echo the payload back so optimistic UI and
 * success states are exercised exactly as they will be against the API.
 */
export async function mutateResource({ method = 'post', path, body, fixture, schema, live = false }) {
  if (env.useMocks && !live) {
    await delay(env.mockLatencyMs)
    const result = fixture ? fixture(body) : body
    return schema ? schema.parse(result) : result
  }

  const { data } = await api[method](path, body)
  return schema ? schema.parse(data.data) : data.data
}

// Deliberately failing and empty variants, so the error and empty states
// required of every screen can actually be exercised in development.
export async function failResource(message = 'Mocked failure') {
  await delay(env.mockLatencyMs)
  throw { status: 500, code: 'MOCK_ERROR', message, details: null }
}

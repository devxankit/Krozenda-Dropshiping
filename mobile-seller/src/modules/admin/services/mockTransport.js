// Layer rule: services/ is the ONLY place that imports the axios instance.
//
// The web version can answer from fixtures while VITE_USE_MOCKS is on; every seller call site
// passes `live: true`, and the native app has no mock mode, so this is the live path only
// (`fixture` / `live` options are accepted and ignored). The response goes through the same zod
// schema as on the web.
import { api } from '../../../lib/axios'

/**
 * Resolve one read. The backend responds { success, message, data }; `data` is unwrapped.
 * options: { path, params?, schema? }
 */
export async function fetchResource({ path, params, schema }) {
  const { data } = await api.get(path, { params })
  return schema ? schema.parse(data.data) : data.data
}

/** Resolve one write (method defaults to post). options: { method?, path, body?, schema? } */
export async function mutateResource({ method = 'post', path, body, schema }) {
  const { data } = await api[method](path, body)
  return schema ? schema.parse(data.data) : data.data
}

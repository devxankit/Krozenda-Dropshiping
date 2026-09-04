// Layer rule: services/ is the ONLY place that imports the axios instance.

import { fetchResource } from './mockTransport'
import { shellSummaryFixture } from '../fixtures/shell'
import { shellSummarySchema } from '../schemas/shellSchema'

export function fetchShellSummary() {
  return fetchResource({
    path: '/admin/shell-summary',
    fixture: shellSummaryFixture,
    schema: shellSummarySchema,
  })
}

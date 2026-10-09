import { z } from 'zod'

// Only the shared piece the seller revenue contract uses (web: schemas/dashboardSchema.js).
export const granularitySchema = z.enum(['day', 'week', 'month'])

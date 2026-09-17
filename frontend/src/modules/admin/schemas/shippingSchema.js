import { z } from 'zod'

// Admin-only shipping contracts. The shipment and tracking shapes are shared
// with the seller panel and live in lib/shipping/contracts — re-exported here
// so admin code has one import, not so there are two copies. The 22-status
// vocabulary must never fork between panels.
export { shipmentSchema, shipmentListSchema, trackingSchema, packageSchema } from '../../../lib/shipping/contracts'

const isoDate = z.string().nullable()

// One carrier account, as an ADMIN may see it.
//
// Note what is absent and must stay absent (task §18): no `email`, no
// password, no token, no decrypted credential. `maskedEmail` is the only
// identifier, and the backend masks it — this schema would reject a full
// address only by convention, so the guarantee lives server-side in
// adminShippingController.serializeIntegrationForAdmin.
export const adminCarrierAccountSchema = z.object({
  id: z.string(),
  provider: z.string(),
  accountType: z.string(),
  // "Platform Account" or "Seller Own Account" — the label task §18 asks for.
  accountLabel: z.string(),
  vendorId: z.string().nullable(),
  vendorName: z.string(),

  status: z.string(),
  isActive: z.boolean(),
  maskedEmail: z.string(),

  lastTestedAt: isoDate,
  lastSuccessfulAt: isoDate,
  lastFailureAt: isoDate,
  failureReason: z.string(),
  consecutiveFailures: z.number().int(),
  disconnectedAt: isoDate,
  createdAt: z.string(),
})

export const adminCarrierAccountListSchema = z.object({
  items: z.array(adminCarrierAccountSchema),
  total: z.number().int().nonnegative(),
})

export const shippingPolicySchema = z.object({
  shippingEnabled: z.boolean(),
  provider: z.string(),

  sellerOwnAccountEnabled: z.boolean(),
  platformFallbackEnabled: z.boolean(),

  courierSelectionStrategy: z.string(),
  blockedCourierIds: z.array(z.number()),

  volumetricDivisor: z.number(),
  defaultPackage: z.object({
    lengthCm: z.number(),
    breadthCm: z.number(),
    heightCm: z.number(),
    weightKg: z.number(),
  }),

  codEnabled: z.boolean(),
  freeShippingThreshold: z.number().nonnegative().optional().default(0),

  trackingPollEnabled: z.boolean(),
  trackingPollCron: z.string(),
  trackingStaleAfterMinutes: z.number(),
  trackingPollBatchSize: z.number(),

  updatedAt: z.string(),
})

// What the SERVER is configured to do, as opposed to what the policy asks for.
// Booleans only — the credential values themselves never leave the backend.
export const shippingReadinessSchema = z.object({
  credentialEncryptionConfigured: z.boolean(),
  platformCredentialsConfigured: z.boolean(),
  webhookConfigured: z.boolean(),
})

export const adminShippingSettingsSchema = z.object({
  settings: shippingPolicySchema,
  platformAccount: adminCarrierAccountSchema.nullable(),
  readiness: shippingReadinessSchema,
  // Which carrier operations the backend has verified. An unverified one
  // answers 501, so the UI disables rather than offers it.
  capabilities: z.record(z.string(), z.boolean()),
  strategies: z.array(z.string()),
})

export const adminShippingSaveSchema = z.object({
  settings: shippingPolicySchema,
  readiness: shippingReadinessSchema,
})

export const adminShippingOverviewSchema = z.object({
  accounts: z.object({
    platform: z.record(z.string(), z.number()),
    seller: z.record(z.string(), z.number()),
  }),
  shipmentsByStatus: z.record(z.string(), z.number()),
  // Parcels whose carrier call timed out and must be checked by a human before
  // anyone retries them.
  reconciliationRequired: z.number().int().nonnegative(),
  readiness: shippingReadinessSchema,
})

export const platformConnectionSchema = z.object({
  connected: z.boolean(),
  testedAt: z.string().optional(),
  platformAccount: adminCarrierAccountSchema,
})

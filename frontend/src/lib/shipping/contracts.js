import { z } from 'zod'

// Runtime contracts for the seller-facing shipping endpoints.
//
// These are strict on purpose. The shipping surface talks to a third party, so
// a field that quietly changes shape is a real risk — parsing here turns that
// into a loud failure in one place instead of `undefined` spreading through
// three screens.
//
// Money here is in RUPEES, not paise, unlike the rest of the vendor panel:
// carrier rates come back from Shiprocket as decimal rupees and are stored that
// way (see Shipment.carrierShippingCost). Formatting must not reuse the paise
// helpers.

// An ISO date string, or null. Mongoose serialises dates to ISO strings; a
// missing lifecycle date is null rather than absent.
const isoDate = z.string().nullable()

// ---------------------------------------------------------------------------
// Carrier account
// ---------------------------------------------------------------------------

export const shippingIntegrationSchema = z.object({
  id: z.string(),
  provider: z.string(),
  accountType: z.string(),
  status: z.string(),
  // The seller's OWN carrier email, in full — this is their account. The admin
  // equivalent is masked; see adminShippingController.
  email: z.string(),
  isActive: z.boolean(),
  lastTestedAt: isoDate,
  lastSuccessfulAt: isoDate,
  lastFailureAt: isoDate,
  failureReason: z.string(),
  disconnectedAt: isoDate,
  createdAt: z.string(),
  updatedAt: z.string(),
})

// Which carrier operations the backend has actually verified against the real
// API. An unverified one returns 501, so the UI reads this to disable the
// control rather than offering an action that cannot work.
const capabilitiesSchema = z.record(z.string(), z.boolean())

export const shippingIntegrationViewSchema = z.object({
  integration: shippingIntegrationSchema.nullable(),
  policy: z.object({
    sellerOwnAccountEnabled: z.boolean(),
    platformFallbackEnabled: z.boolean(),
    shippingEnabled: z.boolean(),
  }),
  // False when the server has no encryption key: credentials cannot be stored
  // at all, so the connect form must not be offered.
  canStoreCredentials: z.boolean(),
  capabilities: capabilitiesSchema,
})

export const connectionResultSchema = z.object({
  connected: z.boolean(),
  lastTestedAt: isoDate.optional(),
  integration: shippingIntegrationSchema.nullable().optional(),
})

// ---------------------------------------------------------------------------
// Pickup locations
// ---------------------------------------------------------------------------

export const pickupLocationSchema = z.object({
  id: z.string(),
  nickname: z.string(),
  contactName: z.string(),
  phone: z.string(),
  email: z.string(),
  addressLine1: z.string(),
  addressLine2: z.string(),
  city: z.string(),
  state: z.string(),
  pincode: z.string(),
  country: z.string(),
  // NOT_REGISTERED | REGISTERED | FAILED — a location must be REGISTERED at the
  // carrier before a parcel can ship from it.
  registrationStatus: z.string(),
  registrationError: z.string(),
  shiprocketLocationName: z.string(),
  isDefault: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.string(),
})

export const pickupLocationListSchema = z.object({
  items: z.array(pickupLocationSchema),
  total: z.number().int().nonnegative(),
  registrationSupported: z.boolean(),
})

// ---------------------------------------------------------------------------
// Packaging (Decision B)
// ---------------------------------------------------------------------------

export const packageSchema = z.object({
  lengthCm: z.number(),
  breadthCm: z.number(),
  heightCm: z.number(),
  actualWeightKg: z.number(),
  volumetricWeightKg: z.number(),
  chargeableWeightKg: z.number(),
  volumetricDivisor: z.number(),
  // PRODUCT | VENDOR_DEFAULT | PLATFORM_DEFAULT | MANUAL
  source: z.string().optional(),
  // True when any figure came from a fallback rather than the product itself.
  // The seller is asked to confirm before the parcel is created, because the
  // carrier bills on these numbers.
  isEstimate: z.boolean().optional(),
})

export const packageSuggestionSchema = z.object({
  package: packageSchema,
  items: z.array(
    z.object({
      productId: z.string(),
      name: z.string(),
      quantity: z.number().int(),
      hasDimensions: z.boolean(),
    })
  ),
})

// ---------------------------------------------------------------------------
// Serviceability
// ---------------------------------------------------------------------------

export const courierSchema = z.object({
  courierId: z.number().nullable(),
  courierName: z.string(),
  // Null means the carrier did not report a rate. It is NOT zero, and must
  // never be rendered as "free".
  rate: z.number().nullable(),
  freightCharge: z.number().nullable(),
  codCharge: z.number(),
  estimatedCost: z.number().nullable(),
  estimatedDeliveryDays: z.number().nullable(),
  estimatedDeliveryDate: z.string().nullable(),
  supportsCod: z.boolean(),
  isSurface: z.boolean(),
  rating: z.number().nullable(),
  minWeightKg: z.number().nullable(),
})

export const serviceabilitySchema = z.object({
  serviceable: z.boolean(),
  couriers: z.array(courierSchema),
  recommended: courierSchema.nullable(),
  codAvailable: z.boolean(),
  strategy: z.string(),
  accountType: z.string(),
  lane: z.object({
    pickupPincode: z.string(),
    deliveryPincode: z.string(),
    weightKg: z.number(),
    cod: z.boolean(),
  }),
  package: packageSchema.optional(),
  pickupLocation: z
    .object({
      id: z.string(),
      nickname: z.string(),
      pincode: z.string(),
      city: z.string(),
      registrationStatus: z.string(),
    })
    .optional(),
  cod: z.boolean().optional(),
  declaredValue: z.number().optional(),
})

// ---------------------------------------------------------------------------
// Shipments
// ---------------------------------------------------------------------------

export const shipmentSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  vendorId: z.string().nullable(),
  shipmentType: z.string(),
  parentShipmentId: z.string().nullable(),

  items: z.array(
    z.object({
      productId: z.string(),
      name: z.string(),
      quantity: z.number().int(),
      unitPrice: z.number(),
    })
  ),
  itemCount: z.number().int(),

  // Our 22-state internal status. The carrier's own wording is separate and
  // never drives UI logic.
  status: z.string(),
  carrierStatus: z.string(),

  courierName: z.string(),
  awbCode: z.string().nullable(),
  trackingUrl: z.string().nullable(),

  pickupLocation: z.string(),
  pickupPincode: z.string(),
  deliveryCity: z.string(),
  deliveryPincode: z.string(),

  package: packageSchema.nullable(),
  paymentMethod: z.string(),
  collectableAmount: z.number(),
  declaredValue: z.number(),

  pickupScheduledAt: isoDate,
  pickedUpAt: isoDate,
  deliveredAt: isoDate,
  estimatedDeliveryAt: isoDate,
  createdAt: z.string(),

  // A parcel whose carrier call timed out mid-flight. It must be checked in
  // the Shiprocket panel before anyone retries, or it becomes a duplicate.
  reconciliationRequired: z.boolean(),
  reconciliationNote: z.string(),
  errorMessage: z.string(),

  // Present on the detail read and for admins. Absent from list rows.
  shippingAccountType: z.string().nullable().optional(),
  shippingAccountOwnerId: z.string().nullable().optional(),
  carrierOrderId: z.string().nullable().optional(),
  carrierShipmentId: z.string().nullable().optional(),
  carrierShippingCost: z.number().optional(),
  customerShippingCharge: z.number().optional(),
  platformShippingMargin: z.number().optional(),
  retryCount: z.number().int().optional(),
  statusHistory: z
    .array(z.object({ status: z.string(), at: z.string(), source: z.string(), note: z.string() }))
    .optional(),
})

export const shipmentListSchema = z.object({
  items: z.array(shipmentSchema),
  total: z.number().int().nonnegative(),
  // One count per tab, computed server-side over the same scope minus the
  // status filter — so the numbers on the other tabs do not move when you
  // switch tabs.
  groupCounts: z.record(z.string(), z.number().int().nonnegative()),
})

export const trackingEventSchema = z.object({
  // Our mapped status, or null when the carrier sent wording we do not
  // recognise. Null is deliberate — it is never guessed into a real status.
  status: z.string().nullable(),
  carrierStatus: z.string(),
  location: z.string(),
  description: z.string(),
  occurredAt: z.string(),
})

export const trackingSchema = z.object({
  shipmentId: z.string(),
  awbCode: z.string().nullable(),
  courierName: z.string(),
  currentStatus: z.string(),
  carrierStatus: z.string(),
  trackingUrl: z.string().nullable(),
  estimatedDelivery: isoDate,
  lastSyncedAt: isoDate,
  events: z.array(trackingEventSchema),
})

export const trackingRefreshSchema = z.object({
  shipmentId: z.string(),
  currentStatus: z.string(),
  newEvents: z.number().int().nonnegative(),
  events: z.array(trackingEventSchema),
})

import { z } from 'zod'

// Runtime contracts for Vendor Panel API endpoints. Money in PAISE (see
// MoneyCell / formatMoney), matching the rest of the admin-family surface.

const paged = (item) =>
  z.object({
    items: z.array(item),
    page: z.number().int().positive(),
    rowsPerPage: z.number().int().positive(),
    totalItems: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
    tabCounts: z.record(z.string(), z.number()),
  })

export const vendorSummarySchema = z.object({
  storeName: z.string(),
  status: z.string(),
  totalRevenue: z.number().int(),
  pendingOrdersCount: z.number().int(),
  liveSkusCount: z.number().int(),
  availablePayout: z.number().int(),
  kycStatus: z.string(),
  routeLinked: z.boolean(),
})

const namedRef = z.object({ id: z.string(), name: z.string() }).nullable()

export const vendorProductSchema = z.object({
  id: z.string(),
  sku: z.string(),
  name: z.string(),
  category: namedRef,
  brand: namedRef,
  price: z.number(),
  salePrice: z.number().nullable(),
  discountPercent: z.number(),
  stock: z.number().int(),
  weight: z.number().nullable(),
  images: z.array(z.string()),
  description: z.string(),
  isActive: z.boolean(),
  approvalStatus: z.string(),
  rejectionReason: z.string(),
  rating: z.number(),
  reviewsCount: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const vendorProductListSchema = paged(vendorProductSchema)

export const vendorInventoryRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string(),
  image: z.string().nullable(),
  stock: z.number().int(),
  isLowStock: z.boolean(),
  isOutOfStock: z.boolean(),
  updatedAt: z.string(),
})

export const vendorInventoryListSchema = paged(vendorInventoryRowSchema)

const vendorOrderItemSchema = z.object({
  productId: z.string(),
  name: z.string(),
  image: z.string().nullable(),
  price: z.number().int(),
  quantity: z.number().int(),
  variant: z.string(),
  status: z.string(),
  courierName: z.string(),
  trackingNumber: z.string(),
  statusHistory: z.array(z.object({ status: z.string(), at: z.string() })),
})

export const vendorOrderSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  customer: z.object({ name: z.string(), mobileNumber: z.string() }),
  shippingAddress: z.record(z.string(), z.any()),
  items: z.array(vendorOrderItemSchema),
  itemsValue: z.number().int(),
  paymentMethod: z.string(),
  paymentStatus: z.string(),
  status: z.string(),
  createdAt: z.string(),
})

export const vendorOrderListSchema = paged(vendorOrderSchema)

export const vendorCustomerSchema = z.object({
  id: z.string(),
  name: z.string(),
  mobileNumber: z.string(),
  email: z.string(),
  ordersCount: z.number().int(),
  totalSpent: z.number().int(),
  lastOrderAt: z.string(),
})

export const vendorCustomerListSchema = paged(vendorCustomerSchema)

export const vendorCouponSchema = z.object({
  id: z.string(),
  code: z.string(),
  description: z.string(),
  discountType: z.string(),
  discountValue: z.number(),
  maxDiscountAmount: z.number().nullable(),
  minOrderAmount: z.number(),
  usageLimit: z.number().nullable(),
  usedCount: z.number(),
  perUserLimit: z.number().nullable(),
  productIds: z.array(z.string()),
  startDate: z.string(),
  endDate: z.string(),
  isActive: z.boolean(),
  status: z.string(),
  createdAt: z.string(),
})

export const vendorCouponListSchema = paged(vendorCouponSchema)

export const vendorReviewSchema = z.object({
  id: z.string(),
  productId: z.string(),
  productName: z.string(),
  productImage: z.string().nullable(),
  author: z.string(),
  rating: z.number(),
  reviewText: z.string(),
  photos: z.array(z.string()),
  vendorReply: z.object({ message: z.string(), repliedAt: z.string() }).nullable(),
  createdAt: z.string(),
})

export const vendorReviewListSchema = paged(vendorReviewSchema)

export const vendorReturnSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  productId: z.string(),
  productName: z.string(),
  productImage: z.string().nullable(),
  customer: z.object({ name: z.string(), mobileNumber: z.string() }),
  requestType: z.string(),
  reason: z.string(),
  photos: z.array(z.string()),
  status: z.string(),
  adminNote: z.string(),
  refundAmount: z.number().nullable(),
  resolvedAt: z.string().nullable(),
  createdAt: z.string(),
})

export const vendorReturnListSchema = paged(vendorReturnSchema)

export const vendorEarningsSummarySchema = z.object({
  commissionRatePercent: z.number(),
  totalSales: z.number().int(),
  totalCommission: z.number().int(),
  netEarnings: z.number().int(),
  pendingAmount: z.number().int(),
  paidAmount: z.number().int(),
  inTransitOrderValue: z.number().int(),
  deliveredOrdersCount: z.number().int(),
})

export const vendorEarningsEntrySchema = z.object({
  id: z.string(),
  orderId: z.string(),
  productName: z.string(),
  quantity: z.number().int(),
  grossAmount: z.number().int(),
  commission: z.number().int(),
  netAmount: z.number().int(),
  deliveredAt: z.string().nullable(),
})

export const vendorEarningsEntryListSchema = z.object({ items: z.array(vendorEarningsEntrySchema) })

export const vendorAnalyticsSchema = z.object({
  salesTrend: z.array(z.object({ date: z.string(), revenue: z.number(), orders: z.number() })),
  topProducts: z.array(z.object({ productId: z.string(), name: z.string(), unitsSold: z.number(), revenue: z.number() })),
  orderStatusBreakdown: z.record(z.string(), z.number()),
  productsTotal: z.number().int(),
  productsActive: z.number().int(),
})

export const vendorNotificationSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  message: z.string(),
  actionType: z.string(),
  actionRefId: z.string().nullable(),
  isRead: z.boolean(),
  createdAt: z.string(),
})

export const vendorNotificationListSchema = z.object({
  items: z.array(vendorNotificationSchema),
  unreadCount: z.number().int(),
})

export const vendorKycDocSchema = z.object({
  id: z.string(),
  vendorId: z.string(),
  documentType: z.string(),
  documentLabel: z.string(),
  documentNumber: z.string(),
  documentUrl: z.string().nullable(),
  status: z.string(),
  rejectionReason: z.string(),
  verifiedAt: z.string().nullable(),
  createdAt: z.string(),
})

export const vendorKycListSchema = z.object({ items: z.array(vendorKycDocSchema) })

export const vendorSettingsSchema = z.object({
  storeName: z.string(),
  commissionRatePercent: z.number(),
  bank: z.record(z.string(), z.any()),
  notificationPrefs: z.object({ orderUpdates: z.boolean(), promotions: z.boolean() }),
})

import { z } from 'zod'

// Mirrors backend/Controllers/walletController.js's serializeTransaction().
export const walletTransactionSchema = z.object({
  id: z.string(),
  type: z.enum(['CREDIT', 'DEBIT']),
  amount: z.number(),
  balanceAfter: z.number(),
  source: z.enum(['TOPUP', 'ORDER_PAYMENT', 'ORDER_REFUND']),
  status: z.string(),
  createdAt: z.string(),
})

export const walletSchema = z.object({
  balance: z.number(),
  transactions: z.array(walletTransactionSchema),
})

// POST /user/wallet/topup/order response — the Razorpay order to open the
// checkout widget against.
export const topupOrderSchema = z.object({
  razorpayOrderId: z.string(),
  amount: z.number(),
  currency: z.string(),
  keyId: z.string(),
})

import mongoose from 'mongoose'
import { BUSINESS_MODEL, ALL_ORDER_STATUSES, ORDER_STATUS } from '../config/constants.js'

// Core collection per project context §7 / §6.1. One sub-order per
// vendor/supplier/own-stock bucket within a parent Order — each carries its
// own status, shipment, invoice, commission, and settlement independently
// (partial cancellation/refund must not touch sibling sub-orders). Minimal
// skeleton: commission is snapshotted at order time per §6.5, never
// recomputed from live config later.
const subOrderSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', default: null },
    businessModel: { type: String, enum: Object.values(BUSINESS_MODEL), required: true },
    status: { type: String, enum: ALL_ORDER_STATUSES, default: ORDER_STATUS.PLACED },
    commissionSnapshot: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
)

export const SubOrder = mongoose.models.SubOrder ?? mongoose.model('SubOrder', subOrderSchema)

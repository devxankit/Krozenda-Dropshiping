const mongoose = require('mongoose');

const TICKET_CATEGORIES = [
  'Orders & Delivery',
  'Returns & Refunds',
  'Payments & Billing',
  'Damaged or Defective Item',
  'Account & Security',
  'General Inquiry',
];

const VENDOR_TICKET_CATEGORIES = [
  'Order Dispute',
  'Return Dispute',
  'Customer Issue',
  'Payment',
  'Payout',
  'Product',
  'Account',
  'Commission',
  'Technical',
  'Other',
];

const TICKET_PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const TICKET_STATUSES = ['open', 'waiting', 'resolved', 'closed'];
// Who raised the ticket.
const RAISED_BY_ROLES = ['customer', 'vendor'];
// Who currently owns acting on it — a customer→seller ticket starts
// targeted at the vendor and only becomes 'admin' once escalated.
const TARGET_ROLES = ['vendor', 'admin'];

const ticketMessageSchema = new mongoose.Schema(
  {
    sender: { type: String, enum: ['user', 'vendor', 'agent', 'system'], default: 'user' },
    senderName: { type: String, default: 'Customer' },
    message: { type: String, required: true, trim: true },
    attachments: { type: [String], default: [] },
    // Admin-only note, never visible to the customer or vendor thread.
    isInternal: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const ticketSchema = new mongoose.Schema(
  {
    ticketId: { type: String, required: true, unique: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    // Who raised it — kept from the original schema. 'buyer' === customer.
    party: { type: String, enum: ['buyer', 'seller'], default: 'buyer' },
    raisedByRole: { type: String, enum: RAISED_BY_ROLES, default: 'customer', index: true },

    // The vendor this ticket is about (customer→seller) or was raised by
    // (seller→admin). Resolved server-side from the order/product snapshot
    // — never trusted from the client — so it doubles as the vendor's
    // access-control scope in canAccessTicket.
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', default: null, index: true },
    targetRole: { type: String, enum: TARGET_ROLES, default: 'admin', index: true },

    subject: { type: String, required: true, trim: true },
    category: { type: String, required: true, default: 'General Inquiry' },
    priority: { type: String, enum: TICKET_PRIORITIES, default: 'normal' },
    status: { type: String, enum: TICKET_STATUSES, default: 'open', index: true },

    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    orderNumber: { type: String, default: '' },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    productName: { type: String, default: '' },

    messages: { type: [ticketMessageSchema], default: [] },

    owner: { type: String, default: null }, // Admin / Support executive assigned
    escalatedToAdmin: { type: Boolean, default: false },
    escalatedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

ticketSchema.index({ user: 1, isDeleted: 1, createdAt: -1 });
ticketSchema.index({ vendor: 1, isDeleted: 1, createdAt: -1 });

const Ticket = mongoose.model('Ticket', ticketSchema);
Ticket.CATEGORIES = TICKET_CATEGORIES;
Ticket.VENDOR_CATEGORIES = VENDOR_TICKET_CATEGORIES;
Ticket.PRIORITIES = TICKET_PRIORITIES;
Ticket.STATUSES = TICKET_STATUSES;

module.exports = Ticket;

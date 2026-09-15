const crypto = require('crypto');
const mongoose = require('mongoose');
const Ticket = require('../Models/Ticket');
const Order = require('../Models/Order');

// True when the caller is allowed to see/act on this ticket:
// - admins always can
// - a vendor may only access a ticket scoped to them (raised against them,
//   or raised by them to admin)
// - a ticket that belongs to a real customer account may only be accessed
//   by that same authenticated user
// - a ticket with no owning user (raised as a guest) is reachable by anyone
//   who has its id, by design — same tradeoff as an order-tracking number.
function canAccessTicket(req, ticket) {
  if (req.admin) return true;
  if (req.vendor) {
    return Boolean(ticket.vendor) && ticket.vendor.toString() === req.vendor._id.toString();
  }
  if (!ticket.user) return true;
  return Boolean(req.user) && ticket.user.toString() === req.user._id.toString();
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function calculateAgeHours(createdAt) {
  if (!createdAt) return 0;
  const diffMs = Date.now() - new Date(createdAt).getTime();
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60)));
}

// Internal notes (isInternal) are admin-only working notes — never surfaced
// to the customer or vendor thread, so they're stripped out for anyone else.
function serializeTicket(t, req) {
  const canSeeInternal = Boolean(req?.admin);
  const messages = (t.messages || [])
    .filter((m) => canSeeInternal || !m.isInternal)
    .map((m) => ({
      id: m._id ? m._id.toString() : undefined,
      sender: m.sender,
      senderName: m.senderName,
      message: m.message,
      attachments: m.attachments || [],
      isInternal: Boolean(m.isInternal),
      createdAt: m.createdAt,
    }));

  return {
    id: t.ticketId || t._id.toString(),
    _id: t._id.toString(),
    ticketId: t.ticketId,
    subject: t.subject,
    raisedBy: t.name || 'Customer',
    name: t.name || 'Customer',
    email: t.email || '',
    phone: t.phone || '',
    party: t.party || 'buyer',
    raisedByRole: t.raisedByRole || 'customer',
    targetRole: t.targetRole || 'admin',
    vendorId: t.vendor ? t.vendor.toString() : null,
    category: t.category || 'General Inquiry',
    priority: t.priority || 'normal',
    status: t.status || 'open',
    orderId: t.orderId ? t.orderId.toString() : null,
    orderNumber: t.orderNumber || '',
    productId: t.productId ? t.productId.toString() : null,
    productName: t.productName || '',
    owner: t.owner || null,
    escalatedToAdmin: Boolean(t.escalatedToAdmin),
    escalatedAt: t.escalatedAt,
    openedAt: formatDate(t.createdAt),
    ageHours: calculateAgeHours(t.createdAt),
    messages,
    resolvedAt: t.resolvedAt,
    closedAt: t.closedAt,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

function generateTicketId() {
  // Doubles as the guest-access credential for unauthenticated ticket
  // creators (see canAccessTicket), so it needs real entropy, not just a
  // human-friendly look — crypto.randomInt over 9-digits gives ~1e9
  // combinations vs. the previous ~9000.
  const randomSuffix = crypto.randomInt(0, 1000000000).toString().padStart(9, '0');
  return `TKT-${randomSuffix}`;
}

async function uniqueTicketId() {
  let ticketId = generateTicketId();
  let existing = await Ticket.findOne({ ticketId });
  while (existing) {
    ticketId = generateTicketId();
    existing = await Ticket.findOne({ ticketId });
  }
  return ticketId;
}

function findTicketQuery(id) {
  const query = { $or: [{ ticketId: id }], isDeleted: false };
  if (mongoose.isValidObjectId(id)) {
    query.$or.push({ _id: id });
  }
  return query;
}

// Resolves which seller a customer's product/order complaint belongs to,
// straight from the order the customer actually owns — never from a
// client-supplied vendorId, since that would let a customer route a ticket
// to any seller they like. Returns targetRole 'admin' when the order/item
// can't be matched, or when the item was platform-owned (no vendor).
async function resolveTicketTarget({ userId, orderId, productId }) {
  if (!orderId || !mongoose.isValidObjectId(orderId)) {
    return { targetRole: 'admin', vendor: null, orderId: null, orderNumber: '', productName: '' };
  }

  const order = await Order.findOne({ _id: orderId, user: userId }).lean();
  if (!order) {
    return { targetRole: 'admin', vendor: null, orderId: null, orderNumber: '', productName: '' };
  }

  const item = productId
    ? order.items.find((it) => it.product && it.product.toString() === String(productId))
    : null;

  if (item && item.vendor) {
    return {
      targetRole: 'vendor',
      vendor: item.vendor,
      orderId: order._id,
      orderNumber: order._id.toString().slice(-8).toUpperCase(),
      productName: item.name || '',
    };
  }

  return {
    targetRole: 'admin',
    vendor: null,
    orderId: order._id,
    orderNumber: order._id.toString().slice(-8).toUpperCase(),
    productName: item ? item.name || '' : '',
  };
}

// POST /user/tickets — customer-raised ticket. Product/order complaints are
// auto-routed to the owning seller (resolveTicketTarget); everything else
// (payment, account, platform) stays with Admin.
async function createTicket(req, res) {
  const {
    subject,
    category,
    priority,
    message,
    description,
    orderId,
    productId,
    orderNumber,
    name,
    email,
    phone,
  } = req.body;

  const contentMessage = (message || description || '').trim();
  if (!subject || !subject.trim()) {
    return res.status(400).json({ success: false, message: 'Subject is required' });
  }
  if (!contentMessage) {
    return res.status(400).json({ success: false, message: 'Message description is required' });
  }

  const customerName = (req.user?.name || name || 'Customer').trim();
  const customerEmail = (req.user?.email || email || '').trim();
  const customerPhone = (req.user?.mobileNumber || phone || '').trim();

  const target = req.user
    ? await resolveTicketTarget({ userId: req.user._id, orderId, productId })
    : { targetRole: 'admin', vendor: null, orderId: null, orderNumber: '', productName: '' };

  const ticketId = await uniqueTicketId();

  const initialMessages = [
    {
      sender: 'user',
      senderName: customerName,
      message: contentMessage,
      createdAt: new Date(),
    },
    {
      sender: 'system',
      senderName: 'Krozenda Support',
      message:
        target.targetRole === 'vendor'
          ? 'Thank you for reaching out. The seller has been notified and will respond shortly.'
          : 'Thank you for reaching out. Your support request has been logged. Our specialist team is reviewing your ticket and will update you shortly.',
      createdAt: new Date(),
    },
  ];

  const ticket = await Ticket.create({
    ticketId,
    user: req.user ? req.user._id : null,
    name: customerName,
    email: customerEmail,
    phone: customerPhone,
    party: 'buyer',
    raisedByRole: 'customer',
    vendor: target.vendor,
    targetRole: target.targetRole,
    subject: subject.trim(),
    category: category?.trim() || 'General Inquiry',
    priority: ['low', 'normal', 'high', 'urgent'].includes(priority) ? priority : 'normal',
    status: 'open',
    orderId: target.orderId || (orderId && mongoose.isValidObjectId(orderId) ? orderId : null),
    orderNumber: target.orderNumber || (orderNumber ? orderNumber.trim() : ''),
    productId: productId && mongoose.isValidObjectId(productId) ? productId : null,
    productName: target.productName,
    messages: initialMessages,
  });

  res.status(201).json({
    success: true,
    message: 'Support ticket raised successfully',
    data: serializeTicket(ticket, req),
  });
}

// POST /vendor/tickets — seller-raised ticket, always targeted at Admin
// (platform disputes, payouts, account issues — never another seller).
async function createVendorTicket(req, res) {
  const { subject, category, priority, message, description, orderId, productId, orderNumber } = req.body;

  const contentMessage = (message || description || '').trim();
  if (!subject || !subject.trim()) {
    return res.status(400).json({ success: false, message: 'Subject is required' });
  }
  if (!contentMessage) {
    return res.status(400).json({ success: false, message: 'Message description is required' });
  }

  const ticketId = await uniqueTicketId();

  const ticket = await Ticket.create({
    ticketId,
    user: null,
    name: req.vendor.contactPerson?.name || req.vendor.business?.businessName || 'Seller',
    email: req.vendor.contactPerson?.email || req.vendor.email || '',
    phone: req.vendor.contactPerson?.mobile || '',
    party: 'seller',
    raisedByRole: 'vendor',
    vendor: req.vendor._id,
    targetRole: 'admin',
    subject: subject.trim(),
    category: category?.trim() || 'Other',
    priority: ['low', 'normal', 'high', 'urgent'].includes(priority) ? priority : 'normal',
    status: 'open',
    orderId: orderId && mongoose.isValidObjectId(orderId) ? orderId : null,
    orderNumber: orderNumber ? orderNumber.trim() : '',
    productId: productId && mongoose.isValidObjectId(productId) ? productId : null,
    messages: [
      {
        sender: 'vendor',
        senderName: req.vendor.business?.businessName || req.vendor.contactPerson?.name || 'Seller',
        message: contentMessage,
        createdAt: new Date(),
      },
      {
        sender: 'system',
        senderName: 'Krozenda Support',
        message: 'Thank you for reaching out. Admin has been notified and will review your ticket shortly.',
        createdAt: new Date(),
      },
    ],
  });

  res.status(201).json({
    success: true,
    message: 'Support ticket raised successfully',
    data: serializeTicket(ticket, req),
  });
}

// GET /user/tickets
async function listUserTickets(req, res) {
  const { status, search, ids } = req.query;
  const filter = { isDeleted: false };

  if (req.user) {
    filter.user = req.user._id;
  } else if (req.admin) {
    // no scoping — admin sees everything, matched below by other filters
  } else if (ids) {
    const idList = ids.split(',').map((id) => id.trim()).filter(Boolean);
    if (idList.length > 0) {
      // Guest lookup by known ticket id(s) only — never exposes tickets
      // that belong to a real account.
      filter.user = null;
      filter.$or = [
        { ticketId: { $in: idList } },
        { _id: { $in: idList.filter((id) => mongoose.isValidObjectId(id)) } },
      ];
    } else {
      return res.json({ success: true, data: { items: [], total: 0 } });
    }
  } else {
    return res.json({ success: true, data: { items: [], total: 0 } });
  }

  if (status && status !== 'all') {
    filter.status = status;
  }

  if (search) {
    const regex = new RegExp(search.trim(), 'i');
    filter.$or = [
      ...(filter.$or || []),
      { ticketId: regex },
      { subject: regex },
      { category: regex },
    ];
  }

  const tickets = await Ticket.find(filter).sort({ updatedAt: -1, createdAt: -1 }).lean();
  const items = tickets.map((t) => serializeTicket(t, req));

  // Group status counts
  const allTickets = await Ticket.find({
    ...(req.user ? { user: req.user._id } : {}),
    isDeleted: false,
  }).lean();

  const counts = {
    all: allTickets.length,
    open: allTickets.filter((t) => t.status === 'open').length,
    waiting: allTickets.filter((t) => t.status === 'waiting').length,
    resolved: allTickets.filter((t) => t.status === 'resolved').length,
    closed: allTickets.filter((t) => t.status === 'closed').length,
  };

  res.json({
    success: true,
    data: {
      items,
      total: items.length,
      counts,
    },
  });
}

// GET /vendor/tickets — a seller only ever sees tickets scoped to them,
// whether raised against them by a customer or raised by them to Admin.
async function listVendorTickets(req, res) {
  const { status, search } = req.query;
  const filter = { isDeleted: false, vendor: req.vendor._id };

  if (status && status !== 'all') {
    filter.status = status;
  }

  if (search) {
    const regex = new RegExp(search.trim(), 'i');
    filter.$or = [{ ticketId: regex }, { subject: regex }, { category: regex }];
  }

  const tickets = await Ticket.find(filter).sort({ updatedAt: -1, createdAt: -1 }).lean();
  const items = tickets.map((t) => serializeTicket(t, req));

  const allTickets = await Ticket.find({ vendor: req.vendor._id, isDeleted: false }).lean();
  const counts = {
    all: allTickets.length,
    open: allTickets.filter((t) => t.status === 'open').length,
    waiting: allTickets.filter((t) => t.status === 'waiting').length,
    resolved: allTickets.filter((t) => t.status === 'resolved').length,
    closed: allTickets.filter((t) => t.status === 'closed').length,
    escalated: allTickets.filter((t) => t.escalatedToAdmin).length,
  };

  res.json({ success: true, data: { items, total: items.length, counts } });
}

// GET /user|vendor/tickets/:id
async function getTicketDetails(req, res) {
  const { id } = req.params;

  const ticket = await Ticket.findOne(findTicketQuery(id));
  if (!ticket) {
    return res.status(404).json({ success: false, message: 'Ticket not found' });
  }

  if (!canAccessTicket(req, ticket)) {
    return res.status(403).json({ success: false, message: 'Access denied to this ticket' });
  }

  res.json({
    success: true,
    data: serializeTicket(ticket, req),
  });
}

// POST /user|vendor/tickets/:id/messages
async function addTicketMessage(req, res) {
  const { id } = req.params;
  const { message, senderName, isInternal } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ success: false, message: 'Message cannot be empty' });
  }

  const ticket = await Ticket.findOne(findTicketQuery(id));
  if (!ticket) {
    return res.status(404).json({ success: false, message: 'Ticket not found' });
  }

  if (!canAccessTicket(req, ticket)) {
    return res.status(403).json({ success: false, message: 'Access denied to this ticket' });
  }

  let senderRole = 'user';
  let name = senderName || req.user?.name || ticket.name;
  if (req.admin) {
    senderRole = 'agent';
    name = senderName || req.admin.name || 'Support Agent';
  } else if (req.vendor) {
    senderRole = 'vendor';
    name = senderName || req.vendor.business?.businessName || req.vendor.contactPerson?.name || 'Seller';
  }

  // Only an admin may post an internal (staff-only) note — everyone else's
  // messages are always visible on the shared thread regardless of what the
  // client sends.
  ticket.messages.push({
    sender: senderRole,
    senderName: name,
    message: message.trim(),
    isInternal: req.admin ? Boolean(isInternal) : false,
    createdAt: new Date(),
  });

  // If the ticket owner (customer or vendor) replies to a resolved/closed
  // ticket, automatically reopen it; a reply from staff/agent shouldn't.
  const isOwnerReply = senderRole === 'user' || senderRole === 'vendor';
  if (isOwnerReply && (ticket.status === 'resolved' || ticket.status === 'closed')) {
    ticket.status = 'open';
    ticket.resolvedAt = null;
    ticket.closedAt = null;
    ticket.messages.push({
      sender: 'system',
      senderName: 'Krozenda Support',
      message: 'Ticket reopened due to new activity.',
      createdAt: new Date(),
    });
  }

  ticket.updatedAt = new Date();
  await ticket.save();

  res.json({
    success: true,
    message: 'Message added successfully',
    data: serializeTicket(ticket, req),
  });
}

// PATCH /user|vendor/tickets/:id/status
async function updateTicketStatus(req, res) {
  const { id } = req.params;
  const { status, note } = req.body;

  if (!Ticket.STATUSES.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid ticket status' });
  }

  const ticket = await Ticket.findOne(findTicketQuery(id));
  if (!ticket) {
    return res.status(404).json({ success: false, message: 'Ticket not found' });
  }

  if (!canAccessTicket(req, ticket)) {
    return res.status(403).json({ success: false, message: 'Access denied to this ticket' });
  }

  const prevStatus = ticket.status;
  ticket.status = status;

  if (status === 'resolved') {
    ticket.resolvedAt = new Date();
    ticket.messages.push({
      sender: 'system',
      senderName: 'System',
      message: note
        ? `Ticket marked as resolved: ${note}`
        : 'Ticket marked as resolved. If you need further help, feel free to reopen.',
      createdAt: new Date(),
    });
  } else if (status === 'closed') {
    ticket.closedAt = new Date();
    ticket.messages.push({
      sender: 'system',
      senderName: 'System',
      message: note ? `Ticket closed: ${note}` : 'Ticket closed.',
      createdAt: new Date(),
    });
  } else if (status === 'open' && (prevStatus === 'resolved' || prevStatus === 'closed')) {
    ticket.resolvedAt = null;
    ticket.closedAt = null;
    ticket.messages.push({
      sender: 'system',
      senderName: 'System',
      message: 'Ticket reopened.',
      createdAt: new Date(),
    });
  }

  ticket.updatedAt = new Date();
  await ticket.save();

  res.json({
    success: true,
    message: `Ticket status updated to ${status}`,
    data: serializeTicket(ticket, req),
  });
}

// PATCH /vendor/tickets/:id/escalate — a seller who can't resolve a
// customer complaint themselves hands it to Admin. Only the seller the
// ticket is scoped to can escalate it, and only while it's still open.
async function escalateTicket(req, res) {
  const { id } = req.params;
  const { note } = req.body;

  const ticket = await Ticket.findOne(findTicketQuery(id));
  if (!ticket) {
    return res.status(404).json({ success: false, message: 'Ticket not found' });
  }

  if (!canAccessTicket(req, ticket)) {
    return res.status(403).json({ success: false, message: 'Access denied to this ticket' });
  }

  if (ticket.status === 'closed') {
    return res.status(400).json({ success: false, message: 'A closed ticket cannot be escalated' });
  }

  ticket.targetRole = 'admin';
  ticket.escalatedToAdmin = true;
  ticket.escalatedAt = new Date();
  ticket.status = 'open';
  ticket.messages.push({
    sender: 'system',
    senderName: 'System',
    message: note ? `Escalated to Admin: ${note}` : 'This ticket has been escalated to Admin.',
    createdAt: new Date(),
  });

  ticket.updatedAt = new Date();
  await ticket.save();

  res.json({
    success: true,
    message: 'Ticket escalated to Admin',
    data: serializeTicket(ticket, req),
  });
}

// PATCH /admin/support/tickets/:id/assign
async function assignTicket(req, res) {
  const { id } = req.params;
  const { owner } = req.body;

  const ticket = await Ticket.findOne(findTicketQuery(id));
  if (!ticket) {
    return res.status(404).json({ success: false, message: 'Ticket not found' });
  }

  ticket.owner = owner ? String(owner).trim() : null;
  ticket.updatedAt = new Date();
  await ticket.save();

  res.json({ success: true, message: 'Ticket assigned', data: serializeTicket(ticket, req) });
}

// GET /admin/support/tickets - For Admin Panel Support Desk
async function listAdminTickets(req, res) {
  const { tab = 'all', page = 1, rowsPerPage, pageSize, search, party } = req.query;
  const filter = { isDeleted: false };

  if (party === 'buyer') {
    filter.raisedByRole = 'customer';
  } else if (party === 'seller') {
    filter.raisedByRole = 'vendor';
  }

  if (tab === 'open') {
    filter.status = 'open';
  } else if (tab === 'unassigned') {
    filter.owner = null;
  } else if (tab === 'urgent') {
    filter.priority = { $in: ['urgent', 'high'] };
    filter.status = { $ne: 'resolved' };
  } else if (tab === 'resolved') {
    filter.status = { $in: ['resolved', 'closed'] };
  } else if (tab === 'customer') {
    filter.raisedByRole = 'customer';
  } else if (tab === 'seller') {
    filter.raisedByRole = 'vendor';
  } else if (tab === 'escalated') {
    filter.escalatedToAdmin = true;
  }

  // Admin's queue is "things that currently need Admin", not every
  // customer<->seller conversation on the platform.
  if (!['customer', 'seller'].includes(tab)) {
    filter.targetRole = 'admin';
  }

  if (search) {
    const regex = new RegExp(search.trim(), 'i');
    filter.$or = [
      { ticketId: regex },
      { subject: regex },
      { name: regex },
      { category: regex },
    ];
  }

  const p = Math.max(1, parseInt(page, 10) || 1);
  const size = Math.max(1, parseInt(rowsPerPage, 10) || parseInt(pageSize, 10) || 20);

  const total = await Ticket.countDocuments(filter);
  const docs = await Ticket.find(filter)
    .populate('vendor', 'business.businessName')
    .sort({ createdAt: -1 })
    .skip((p - 1) * size)
    .limit(size)
    .lean();

  const allTickets = await Ticket.find({ isDeleted: false }).lean();
  const tabsCount = {
    all: allTickets.filter((t) => t.targetRole === 'admin').length,
    open: allTickets.filter((t) => t.status === 'open' && t.targetRole === 'admin').length,
    unassigned: allTickets.filter((t) => !t.owner && t.targetRole === 'admin').length,
    urgent: allTickets.filter((t) => ['urgent', 'high'].includes(t.priority) && t.status !== 'resolved' && t.targetRole === 'admin').length,
    resolved: allTickets.filter((t) => ['resolved', 'closed'].includes(t.status) && t.targetRole === 'admin').length,
    customer: allTickets.filter((t) => t.raisedByRole === 'customer').length,
    seller: allTickets.filter((t) => t.raisedByRole === 'vendor').length,
    escalated: allTickets.filter((t) => t.escalatedToAdmin).length,
  };

  const rows = docs.map((t) => ({
    ...serializeTicket(t, req),
    vendorName: t.vendor?.business?.businessName || null,
  }));

  res.json({
    success: true,
    data: {
      items: rows,
      page: p,
      rowsPerPage: size,
      totalItems: total,
      totalPages: Math.max(1, Math.ceil(total / size)),
      tabCounts: tabsCount,
    },
  });
}

module.exports = {
  createTicket,
  createVendorTicket,
  listUserTickets,
  listVendorTickets,
  getTicketDetails,
  addTicketMessage,
  updateTicketStatus,
  escalateTicket,
  assignTicket,
  listAdminTickets,
};

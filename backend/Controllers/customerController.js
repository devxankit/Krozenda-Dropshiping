const User = require('../Models/User');
const Order = require('../Models/Order');
const { getImageUrl } = require('../utils/imageHelper');

function serializeCustomer(user, stats) {
  return {
    id: user._id,
    name: user.name || '',
    email: user.email || '',
    phone: user.mobileNumber || '',
    image: getImageUrl(user.image),
    dob: user.dob,
    type: 'retail',
    orders: stats?.orders || 0,
    lifetimeValue: Math.round(stats?.lifetimeValue || 0),
    lastOrderAt: stats?.lastOrderAt || null,
    status: user.isActive ? 'active' : 'blocked',
  };
}

// Aggregates each customer's order count and lifetime spend from the Order
// collection rather than storing running totals on User — orders are the
// source of truth and totals must reflect cancellations/refunds correctly.
async function listCustomers(req, res) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const rowsPerPage = Math.max(1, parseInt(req.query.rowsPerPage, 10) || 10);
  const tab = req.query.tab || 'all';

  const customers = await User.find({ role: 'customer', isDeleted: false }).sort({ createdAt: -1 });

  const stats = await Order.aggregate([
    { $match: { status: { $ne: 'CANCELLED' } } },
    {
      $group: {
        _id: '$user',
        orders: { $sum: 1 },
        lifetimeValue: { $sum: '$total' },
        lastOrderAt: { $max: '$createdAt' },
      },
    },
  ]);
  const statsByUser = new Map(stats.map((s) => [s._id.toString(), s]));

  const allItems = customers.map((c) => serializeCustomer(c, statsByUser.get(c._id.toString())));
  const blockedItems = allItems.filter((c) => c.status === 'blocked');
  // Top spenders — ranked by lifetime value, not just insertion order.
  const topItems = [...allItems].sort((a, b) => b.lifetimeValue - a.lifetimeValue).slice(0, 10);

  const scopedItems = tab === 'blocked' ? blockedItems : tab === 'top' ? topItems : allItems;
  const totalItems = scopedItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage));
  const start = (page - 1) * rowsPerPage;
  const items = scopedItems.slice(start, start + rowsPerPage);

  res.json({
    success: true,
    data: {
      items,
      page,
      rowsPerPage,
      totalItems,
      totalPages,
      tabCounts: {
        all: allItems.length,
        top: topItems.length,
        blocked: blockedItems.length,
      },
    },
  });
}

async function createCustomer(req, res) {
  const { name, email, mobileNumber, dob, isActive } = req.body;

  if (!mobileNumber) {
    return res.status(400).json({ success: false, message: 'Mobile number is required' });
  }

  try {
    const customer = await User.create({
      name: name || undefined,
      email: email ? email.toLowerCase().trim() : undefined,
      mobileNumber,
      dob: dob || undefined,
      image: req.file?.url || null,
      isActive: isActive !== undefined ? isActive === 'true' || isActive === true : true,
      role: 'customer',
      createdBy: req.admin._id,
    });

    res.status(201).json({ success: true, message: 'Customer added successfully', data: serializeCustomer(customer, null) });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Email or mobile number is already in use' });
    }
    throw err;
  }
}

async function updateCustomerStatus(req, res) {
  const { isActive } = req.body;
  if (typeof isActive !== 'boolean') {
    return res.status(400).json({ success: false, message: 'isActive (boolean) is required' });
  }

  const customer = await User.findOneAndUpdate(
    { _id: req.params.id, role: 'customer', isDeleted: false },
    { isActive },
    { new: true }
  );

  if (!customer) {
    return res.status(404).json({ success: false, message: 'Customer not found' });
  }

  res.json({ success: true, message: 'Customer status updated', data: serializeCustomer(customer, null) });
}

module.exports = { listCustomers, createCustomer, updateCustomerStatus };

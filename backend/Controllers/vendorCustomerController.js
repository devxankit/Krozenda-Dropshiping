const Order = require('../Models/Order');
const { toPaise } = require('../utils/money');

// Read-only: a vendor's "customers" are just the buyers who bought their
// items, derived from Order — there's no separate customer relationship to
// manage, and per platform rules a seller never sees the platform-wide
// customer list, only their own.
async function listMyCustomers(req, res) {
  const { search, page = 1, rowsPerPage = 25 } = req.query;
  const vendorId = req.vendor._id;

  const rows = await Order.aggregate([
    { $match: { 'items.vendor': vendorId } },
    { $unwind: '$items' },
    { $match: { 'items.vendor': vendorId } },
    {
      $group: {
        _id: '$user',
        ordersCount: { $addToSet: '$_id' },
        totalSpent: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        lastOrderAt: { $max: '$createdAt' },
      },
    },
    { $sort: { lastOrderAt: -1 } },
  ]);

  const userIds = rows.map((r) => r._id);
  const users = await require('../Models/User').find({ _id: { $in: userIds } }).select('name mobileNumber email');
  const usersById = new Map(users.map((u) => [u._id.toString(), u]));

  let items = rows.map((r) => {
    const user = usersById.get(r._id?.toString());
    return {
      id: r._id?.toString() || '',
      name: user?.name || 'Deleted customer',
      mobileNumber: user?.mobileNumber || '',
      email: user?.email || '',
      ordersCount: r.ordersCount.length,
      totalSpent: toPaise(r.totalSpent),
      lastOrderAt: r.lastOrderAt,
    };
  });

  const term = (search || '').trim().toLowerCase();
  if (term) {
    items = items.filter(
      (c) => c.name.toLowerCase().includes(term) || c.mobileNumber.includes(term) || c.email.toLowerCase().includes(term)
    );
  }

  const perPage = Number(rowsPerPage) || 25;
  const currentPage = Number(page) || 1;
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const start = (currentPage - 1) * perPage;

  res.json({
    success: true,
    data: {
      items: items.slice(start, start + perPage),
      page: currentPage,
      rowsPerPage: perPage,
      totalItems,
      totalPages,
      tabCounts: { all: totalItems },
    },
  });
}

module.exports = { listMyCustomers };

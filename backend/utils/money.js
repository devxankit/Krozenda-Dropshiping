// The admin panel renders every amount as paise (see
// frontend/src/modules/admin/lib/format.js formatMoney), while the legacy
// models store rupees like the rest of this backend — so amounts are scaled up
// only on the way out to admin-facing surfaces, never in the database or the
// customer-facing API.
//
// The Accounting module is the exception and stores INTEGER PAISE natively
// (see Models/AccountingTransaction.js): a ledger that carries rupee floats
// drifts by a few paise every thousand orders, and "seller payable" has to
// reconcile to the last paise. Everything below exists so a rupee figure
// crossing into the ledger is rounded exactly once, at that boundary.
function toPaise(rupees) {
  return Math.round((rupees || 0) * 100);
}

function fromPaise(paise) {
  return (paise || 0) / 100;
}

// Percentage OF an integer-paise amount, back in integer paise. Scaled by
// 10000 before dividing so 2.5% of ₹10,000.01 lands on a whole paise rather
// than on 0.30000000000000004.
function percentOfPaise(paise, percent) {
  return Math.round((Math.round(paise || 0) * Math.round((percent || 0) * 10000)) / 1000000);
}

// Split `totalPaise` across `weights` so the parts sum EXACTLY back to it.
// Largest-remainder: floor every share, then hand the leftover paise out one
// at a time to the lines with the biggest lost fraction. This is how an
// order-level coupon/shipping figure is attributed to each seller's lines
// without the seller totals quietly failing to add up to the order total.
function allocateProportional(totalPaise, weights) {
  const total = Math.round(totalPaise || 0);
  const list = weights.map((w) => Math.max(0, Math.round(w || 0)));
  const sum = list.reduce((acc, w) => acc + w, 0);

  if (total === 0 || list.length === 0) return list.map(() => 0);
  // No weight to go on (e.g. a fully discounted order): spread evenly rather
  // than dropping the amount on the floor.
  if (sum === 0) {
    const even = Math.floor(total / list.length);
    const shares = list.map(() => even);
    let rest = total - even * list.length;
    for (let i = 0; rest > 0; i += 1, rest -= 1) shares[i % shares.length] += 1;
    return shares;
  }

  const exact = list.map((w) => (total * w) / sum);
  const shares = exact.map((value) => Math.floor(value));
  let remainder = total - shares.reduce((acc, value) => acc + value, 0);

  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);

  for (let i = 0; remainder > 0; i += 1, remainder -= 1) {
    shares[order[i % order.length].index] += 1;
  }
  return shares;
}

module.exports = { toPaise, fromPaise, percentOfPaise, allocateProportional };

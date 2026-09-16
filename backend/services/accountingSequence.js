const AccountingCounter = require('../Models/AccountingCounter');

const PREFIXES = Object.freeze({
  transaction: 'TXN',
  settlement: 'STL',
  payout: 'PAY',
});

// Reserve `count` consecutive numbers in one atomic $inc and return the
// formatted ids. Taking the whole block in a single round trip is what lets
// the posting engine write a whole order's worth of rows with insertMany
// instead of one call per row.
async function nextIds(kind, count = 1) {
  const prefix = PREFIXES[kind];
  if (!prefix) throw new Error(`Unknown accounting sequence "${kind}"`);
  if (count < 1) return [];

  const counter = await AccountingCounter.findOneAndUpdate(
    { key: kind },
    { $inc: { value: count } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  // `value` is the number AFTER the increment, so the block just reserved is
  // the `count` numbers ending there.
  const end = counter.value;
  const start = end - count + 1;
  return Array.from({ length: count }, (_, i) => `${prefix}-${String(start + i).padStart(8, '0')}`);
}

async function nextId(kind) {
  const [id] = await nextIds(kind, 1);
  return id;
}

module.exports = { nextId, nextIds, PREFIXES };

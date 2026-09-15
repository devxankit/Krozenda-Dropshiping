// The admin panel renders every amount as paise (see
// frontend/src/modules/admin/lib/format.js formatMoney), while the models
// store rupees like the rest of this backend — so amounts are scaled up only
// on the way out to admin-facing surfaces, never in the database or the
// customer-facing API.
function toPaise(rupees) {
  return Math.round((rupees || 0) * 100);
}

module.exports = { toPaise };

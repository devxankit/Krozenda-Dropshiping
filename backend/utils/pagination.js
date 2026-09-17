// One place that decides what `?page=` and `?limit=` mean, so every buyer-
// facing list endpoint answers the same way and none of them can be talked
// into returning the whole collection.
//
// Hostile input this has to survive, all of which previously reached
// Mongoose as-is on at least one endpoint:
//   ?limit=100000   -> capped at maxLimit
//   ?limit=-100     -> floored at 1
//   ?limit=abc      -> falls back to defaultLimit
//   ?page=0         -> floored at 1
//   ?page=1e9       -> capped, so `skip` can never become an unbounded scan

// Deep pagination is a full collection scan in MongoDB (skip walks every
// skipped document), so the page number itself needs a ceiling. 500 pages at
// the default size is far past anything a real buyer scrolls to.
const MAX_PAGE = 500;

function readPagination(query = {}, { defaultLimit = 20, maxLimit = 50 } = {}) {
  const rawLimit = Number(query.limit);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(maxLimit, Math.max(1, Math.trunc(rawLimit)))
    : defaultLimit;

  const rawPage = Number(query.page);
  const page = Number.isFinite(rawPage) ? Math.min(MAX_PAGE, Math.max(1, Math.trunc(rawPage))) : 1;

  return { page, limit, skip: (page - 1) * limit };
}

function buildPagination({ page, limit, total }) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

module.exports = { readPagination, buildPagination, MAX_PAGE };

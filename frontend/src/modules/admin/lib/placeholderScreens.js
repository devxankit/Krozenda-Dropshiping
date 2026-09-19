// Screens whose route exists but whose UI lands in a later phase.
//
// This list is now EMPTY again: every CJ Dropshipping screen (Dashboard,
// Catalogue, Products, Orders, Shipments, Returns & Disputes, Sync Logs,
// Settings) is real. The mechanism stays in place — add an entry here and
// routes.jsx renders a typed placeholder for it, so a new route is never a
// dead link while its screen is being built.

export const PLACEHOLDER_SCREENS = Object.freeze([])

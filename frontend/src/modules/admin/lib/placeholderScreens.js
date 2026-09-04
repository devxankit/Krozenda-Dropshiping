// Screens whose route exists but whose UI lands in a later phase.
//
// This list is now EMPTY: every one of the 89 routes resolves to a real
// screen. The mechanism stays in place — add an entry here and routes.jsx
// renders a typed placeholder for it, so a new route is never a dead link
// while its screen is being built.

export const PLACEHOLDER_SCREENS = Object.freeze([])

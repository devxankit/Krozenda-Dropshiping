// Derivations over NAV_TREE. The sidebar, the breadcrumb trail and the
// command palette are three views of one structure — these helpers are how
// they stay in agreement.

import { NAV_TREE } from '../constants'

// A nav item is active when the URL is the item's own path, a child of it, or
// a child of its declared `match` prefix (used where a group's landing page
// and its siblings live under different paths — Analytics, Settings).
//
// `exact` opts out of the child rule, for a landing page whose path is a
// PREFIX of its siblings' (Accounting Overview sits at /admin/accounting while
// Transactions sits at /admin/accounting/transactions). Without it that
// landing page would read as active on every sibling screen, and findNavItem
// would hand the breadcrumb the wrong item.
export function isNavItemActive(item, pathname) {
  if (pathname === item.to) return true
  if (!item.exact && pathname.startsWith(`${item.to}/`)) return true
  if (item.match && pathname.startsWith(item.match)) return true
  return false
}

// Admin bypasses every permission check (mirrors the backend's
// requirePermission behaviour); `adminOnly` items reject staff even if their
// permissions[] somehow includes the matching key.
export function visibleNavGroups(permissions = [], role = null) {
  const granted = new Set(permissions)
  const isAdmin = role === 'admin'
  return NAV_TREE.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (item.adminOnly && !isAdmin) return false
      if (!item.permission) return true
      return (
        isAdmin ||
        granted.has(item.permission) ||
        Boolean(item.legacyPermission && granted.has(item.legacyPermission))
      )
    }),
  })).filter((group) => group.items.length > 0)
}

// Same authorization rule as visibleNavGroups, for a single path — used to
// deny direct URL navigation to a module the sidebar already hides.
export function canAccessNavItem(item, permissions = [], role = null) {
  if (!item) return true
  if (item.adminOnly && role !== 'admin') return false
  if (!item.permission) return true
  return (
    role === 'admin' ||
    permissions.includes(item.permission) ||
    Boolean(item.legacyPermission && permissions.includes(item.legacyPermission))
  )
}

export function flatNavItems() {
  return NAV_TREE.flatMap((group) =>
    group.items.map((item) => ({ ...item, group: group.label || 'Overview' })),
  )
}

export function findNavItem(pathname) {
  return flatNavItems().find((item) => isNavItemActive(item, pathname)) || null
}

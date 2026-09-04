// Derivations over NAV_TREE. The sidebar, the breadcrumb trail and the
// command palette are three views of one structure — these helpers are how
// they stay in agreement.

import { NAV_TREE } from '../constants'

// A nav item is active when the URL is the item's own path, a child of it, or
// a child of its declared `match` prefix (used where a group's landing page
// and its siblings live under different paths — Analytics, Settings).
export function isNavItemActive(item, pathname) {
  if (pathname === item.to) return true
  if (pathname.startsWith(`${item.to}/`)) return true
  if (item.match && pathname.startsWith(item.match)) return true
  return false
}

export function visibleNavGroups(permissions = []) {
  const granted = new Set(permissions)
  return NAV_TREE.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.permission || granted.has(item.permission)),
  })).filter((group) => group.items.length > 0)
}

export function flatNavItems() {
  return NAV_TREE.flatMap((group) =>
    group.items.map((item) => ({ ...item, group: group.label || 'Overview' })),
  )
}

export function findNavItem(pathname) {
  return flatNavItems().find((item) => isNavItemActive(item, pathname)) || null
}

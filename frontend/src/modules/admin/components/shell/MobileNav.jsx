import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Icon } from '../../../../components/ui'
import { Drawer } from '../overlay/Drawer'
import { isNavItemActive } from '../../lib/nav'

const BADGE_TONE = Object.freeze({
  warning: 'bg-warning-50 text-warning-700',
  danger: 'bg-danger-50 text-danger-700',
  brand: 'bg-brand-100 text-brand-700',
})

// Collapsible parent for a group with `submenu` — mirrors AdminSidebar.
function MobileSubmenu({ submenu, items, renderItem, pathname }) {
  const hasActive = items.some((item) => isNavItemActive(item, pathname))
  const [toggled, setToggled] = useState(null)
  const open = toggled ?? hasActive

  return (
    <>
      <button
        type="button"
        onClick={() => setToggled(!open)}
        aria-expanded={open}
        className={`flex h-10 w-full items-center gap-3 rounded-md px-2.5 text-sm transition-colors hover:bg-surface-muted ${
          hasActive ? 'font-semibold text-brand-700' : 'font-medium text-ink-muted'
        }`}
      >
        <Icon name={submenu.icon} className="h-4 w-4 shrink-0" />
        <span className="truncate">{submenu.label}</span>
        <Icon
          name="chevronDown"
          className={`ml-auto h-3.5 w-3.5 shrink-0 transition-transform ${open ? '' : '-rotate-90'}`}
        />
      </button>
      {open && <div className="ml-4 flex flex-col gap-0.5 border-l border-border pl-2">{items.map(renderItem)}</div>}
    </>
  )
}

// Below `lg` the sidebar becomes a drawer. Same nav data, same active rule —
// only the container changes.
export function MobileNav({ isOpen, onClose, groups = [], counts = {} }) {
  const { pathname } = useLocation()

  const renderItem = (item) => {
    const count = item.badge ? counts[item.badge] : 0
    return (
      <NavLink
        key={item.to}
        to={item.to}
        onClick={onClose}
        className={`flex h-10 items-center gap-3 rounded-md px-2.5 text-sm transition-colors ${
          isNavItemActive(item, pathname)
            ? 'bg-brand-50 font-semibold text-brand-700'
            : 'font-medium text-ink-muted hover:bg-surface-muted'
        }`}
      >
        <Icon name={item.icon} className="h-4 w-4 shrink-0" />
        <span className="truncate">{item.label}</span>
        {count > 0 && (
          <span
            className={`ml-auto shrink-0 rounded-full px-1.5 text-2xs font-semibold ${BADGE_TONE[item.badgeTone] || BADGE_TONE.brand}`}
          >
            {count}
          </span>
        )}
      </NavLink>
    )
  }

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Krozenda admin" side="left" width="sm">
      <nav className="flex flex-col gap-0.5 p-3">
        {groups.map((group) => (
          <div key={group.id} className="flex flex-col gap-0.5">
            {group.label && (
              <p className="px-2 pb-1 pt-3 text-2xs font-semibold uppercase tracking-wider text-ink-faint">
                {group.label}
              </p>
            )}
            {group.submenu ? (
              <MobileSubmenu submenu={group.submenu} items={group.items} renderItem={renderItem} pathname={pathname} />
            ) : (
              group.items.map(renderItem)
            )}
          </div>
        ))}
      </nav>
    </Drawer>
  )
}

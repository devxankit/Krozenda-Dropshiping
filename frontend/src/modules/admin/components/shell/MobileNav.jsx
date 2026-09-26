import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Icon } from '../../../../components/ui'
import { Drawer } from '../overlay/Drawer'
import { isNavItemActive } from '../../lib/nav'
import { BrandMark, NavCount, NavGroupLabel, navIconClass, navItemClass } from './navStyles'

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
        className={`${navItemClass({ size: 'touch' })} w-full ${hasActive ? '!font-semibold !text-brand-700' : ''}`}
      >
        <Icon name={submenu.icon} className={navIconClass(hasActive)} />
        <span className="truncate">{submenu.label}</span>
        <Icon
          name="chevronDown"
          className={`ml-auto h-3.5 w-3.5 shrink-0 transition-transform ${open ? '' : '-rotate-90'}`}
        />
      </button>
      {open && (
        <div className="ml-[1.1rem] flex animate-fade-in flex-col gap-0.5 border-l border-border pl-2">
          {items.map(renderItem)}
        </div>
      )}
    </>
  )
}

// Below `lg` the sidebar becomes a drawer. Same nav data, same active rule —
// only the container changes.
export function MobileNav({ isOpen, onClose, groups = [], counts = {} }) {
  const { pathname } = useLocation()

  const renderItem = (item) => {
    const count = item.badge ? counts[item.badge] : 0
    const active = isNavItemActive(item, pathname)
    return (
      <NavLink
        key={item.to}
        to={item.to}
        onClick={onClose}
        className={navItemClass({ active, size: 'touch' })}
      >
        <Icon name={item.icon} className={navIconClass(active)} />
        <span className="truncate">{item.label}</span>
        {count > 0 && <NavCount count={count} tone={item.badgeTone} />}
      </NavLink>
    )
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={<BrandMark label="ADMIN" />}
      ariaLabel="Admin navigation"
      side="left"
      width="nav"
    >
      <nav aria-label="Admin navigation" className="flex flex-col gap-0.5 p-2.5">
        {groups.map((group) => (
          <div key={group.id} className="flex flex-col gap-0.5">
            {group.label && <NavGroupLabel>{group.label}</NavGroupLabel>}
            {group.submenu ? (
              <MobileSubmenu
                submenu={group.submenu}
                items={group.items}
                renderItem={renderItem}
                pathname={pathname}
              />
            ) : (
              group.items.map(renderItem)
            )}
          </div>
        ))}
      </nav>
    </Drawer>
  )
}

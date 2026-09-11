import { useMemo } from 'react'
import { Checkbox, Icon } from '../../../../components/ui'
import { NAV_TREE } from '../../constants'

// Driven by NAV_TREE rather than a separate permission list, so a new sidebar
// module is automatically assignable here without touching this file —
// "Permission system dynamic hona chahiye."
export function PermissionPicker({ value = [], onChange }) {
  const selected = new Set(value)

  // Extract all assignable navigation items
  const allAssignableItems = useMemo(() => {
    return NAV_TREE.flatMap((group) =>
      group.items.filter((item) => item.permission && !item.adminOnly),
    )
  }, [])

  const totalSelectedCount = useMemo(() => {
    return allAssignableItems.filter(
      (item) => selected.has(item.permission) || Boolean(item.legacyPermission && selected.has(item.legacyPermission)),
    ).length
  }, [allAssignableItems, selected])

  function toggle(item) {
    const next = new Set(selected)
    const isChecked = next.has(item.permission) || Boolean(item.legacyPermission && next.has(item.legacyPermission))

    if (isChecked) {
      next.delete(item.permission)
      if (item.legacyPermission) next.delete(item.legacyPermission)
    } else {
      next.add(item.permission)
    }

    onChange([...next])
  }

  function selectAll() {
    const allPerms = allAssignableItems.map((item) => item.permission)
    onChange([...new Set(allPerms)])
  }

  function deselectAll() {
    onChange([])
  }

  function toggleGroup(groupItems) {
    const allGroupSelected = groupItems.every(
      (item) => selected.has(item.permission) || Boolean(item.legacyPermission && selected.has(item.legacyPermission)),
    )
    const next = new Set(selected)

    if (allGroupSelected) {
      groupItems.forEach((item) => {
        next.delete(item.permission)
        if (item.legacyPermission) next.delete(item.legacyPermission)
      })
    } else {
      groupItems.forEach((item) => {
        next.add(item.permission)
      })
    }

    onChange([...next])
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Quick Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200/80 bg-slate-50/80 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-200/60">
            <Icon name="check" className="h-3.5 w-3.5 text-brand-600" />
            {totalSelectedCount} of {allAssignableItems.length} modules granted
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={selectAll}
            className="rounded-md px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-white hover:text-brand-600 hover:shadow-xs"
          >
            Select all
          </button>
          <span className="text-slate-300">|</span>
          <button
            type="button"
            onClick={deselectAll}
            className="rounded-md px-2.5 py-1 text-xs font-medium text-slate-500 transition hover:bg-white hover:text-rose-600 hover:shadow-xs"
          >
            Deselect all
          </button>
        </div>
      </div>

      {/* Categorized Permissions Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {NAV_TREE.map((group) => {
          const items = group.items.filter((item) => item.permission && !item.adminOnly)
          if (items.length === 0) return null

          const groupSelectedCount = items.filter(
            (item) => selected.has(item.permission) || Boolean(item.legacyPermission && selected.has(item.legacyPermission)),
          ).length
          const isGroupAllSelected = groupSelectedCount === items.length

          return (
            <div
              key={group.id}
              className="flex flex-col rounded-lg border border-slate-200/80 bg-slate-50/40 p-3 transition-colors hover:border-slate-300 hover:bg-slate-50/70"
            >
              {/* Group Header */}
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 truncate">
                    {group.label || 'Overview'}
                  </span>
                  <span className="rounded-full bg-slate-200/70 px-1.5 py-0.2 text-[10px] font-semibold text-slate-600">
                    {groupSelectedCount}/{items.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => toggleGroup(items)}
                  className="text-2xs font-medium text-brand-600 hover:text-brand-700 hover:underline"
                >
                  {isGroupAllSelected ? 'None' : 'All'}
                </button>
              </div>

              {/* Group Checkboxes */}
              <div className="flex flex-col gap-1.5">
                {items.map((item) => {
                  const isChecked =
                    selected.has(item.permission) ||
                    Boolean(item.legacyPermission && selected.has(item.legacyPermission))

                  return (
                    <label
                      key={item.to}
                      htmlFor={`permission-${item.to}`}
                      className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 text-xs transition-colors cursor-pointer ${
                        isChecked
                          ? 'bg-white font-medium text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:bg-white/60'
                      }`}
                    >
                      <Checkbox
                        id={`permission-${item.to}`}
                        checked={isChecked}
                        onChange={() => toggle(item)}
                      />
                      <span className="truncate">{item.label}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

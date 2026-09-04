import { Input, Tabs } from '../../../../components/ui'

// Tabs and search for the three ledger screens. The statements above them
// have nothing to filter, which is why this is not in AccountingShell itself.
export function LedgerToolbar({ tabs = [], controller, searchPlaceholder = 'Search…', total }) {
  return (
    <div className="flex flex-col gap-3">
      {tabs.length > 0 && (
        <Tabs
          items={tabs.map((tab) => ({ ...tab, count: controller.tabCounts?.[tab.id] }))}
          activeId={controller.tab}
          onChange={controller.changeTab}
        />
      )}
      <div className="flex items-center justify-between gap-3">
        <Input
          id="ledger-search"
          size="control"
          icon="search"
          placeholder={searchPlaceholder}
          containerClassName="w-full max-w-xs"
          value={controller.filters?.search || ''}
          onChange={(event) =>
            controller.changeFilters({ ...controller.filters, search: event.target.value })
          }
        />
        {typeof total === 'number' && (
          <span className="shrink-0 text-xs text-ink-faint">{total} entries</span>
        )}
      </div>
    </div>
  )
}

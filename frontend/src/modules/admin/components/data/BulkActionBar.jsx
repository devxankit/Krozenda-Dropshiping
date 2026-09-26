import { Button } from '../../../../components/ui'

// actions: [{ label, icon?, tone?: 'default' | 'danger', onClick }]
export function BulkActionBar({ count, label = 'selected', actions = [], onClear }) {
  return (
    <div className="flex animate-fade-in flex-wrap items-center gap-3 border-b border-brand-100 bg-brand-50 px-4 py-2.5">
      <span className="tabular text-xs font-semibold text-brand-700">
        {count} {label}
      </span>
      <span className="hidden h-4 w-px bg-brand-200 sm:block" />

      <div className="flex flex-wrap items-center gap-2">
        {actions.map((action) => (
          <Button
            key={action.label}
            variant={action.tone === 'danger' ? 'dangerOutline' : 'secondary'}
            size="sm"
            icon={action.icon}
            onClick={() => action.onClick?.()}
          >
            {action.label}
          </Button>
        ))}
      </div>

      <div className="flex-1" />
      <Button variant="ghost" size="sm" onClick={onClear}>
        Clear selection
      </Button>
    </div>
  )
}

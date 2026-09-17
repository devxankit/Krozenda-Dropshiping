import { NavLink, useLocation } from 'react-router-dom'
import { Button } from '../../../../components/ui'
import { SETTINGS_NAV } from '../../constants'
import { PageBody, PageHeader } from '../shell'
import { ErrorState, PageSkeleton } from '../feedback'
import { FormActions, UnsavedIndicator } from '../forms'

// Ten settings screens behind one sub-navigation. Each page supplies only its
// own sections; the rail, the header, the four states and the save bar are
// decided here so none of them can drift.
export function SettingsShell({
  title,
  description,
  controller,
  changed = [],
  saveNote = 'Saving writes an entry to the audit log',
  actions,
  // A page that can actually persist supplies these. The nine fixture-backed
  // settings screens do not, and keep their existing inert save bar rather
  // than silently pretending to save.
  onSave,
  onDiscard,
  isSaving = false,
  children,
}) {
  const { pathname } = useLocation()

  return (
    <PageBody>
      <PageHeader title={title} description={description} actions={actions} />

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <nav className="flex shrink-0 flex-col gap-px lg:w-49" style={{ width: '12.25rem' }}>
          {SETTINGS_NAV.map((group) => (
            <div key={group.id} className="flex flex-col gap-px">
              <p className="px-3 pb-1 pt-3 text-2xs font-semibold uppercase tracking-wider text-ink-faint first:pt-0">
                {group.label}
              </p>
              {group.items.map((item) => {
                const active = pathname === item.to
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={`flex h-8 items-center rounded-md px-3 text-xs transition-colors ${
                      active
                        ? 'border border-border bg-surface font-semibold text-slate-900'
                        : 'font-medium text-ink-muted hover:bg-surface-muted hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                  </NavLink>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {controller?.isLoading && <PageSkeleton rows={3} />}
          {controller?.error && (
            <ErrorState error={controller.error} onRetry={controller.refetch} />
          )}
          {controller?.data && children(controller.data)}
          {!controller && children()}
        </div>
      </div>

      {changed.length > 0 && (
        <FormActions
          status={<UnsavedIndicator count={changed.length} fields={changed} />}
          note={saveNote}
        >
          <Button variant="quiet" size="control" onClick={onDiscard} disabled={isSaving || !onDiscard}>
            Discard
          </Button>
          <Button
            size="control"
            onClick={onSave ? () => onSave() : undefined}
            isLoading={isSaving}
            disabled={!onSave}
          >
            Save changes
          </Button>
        </FormActions>
      )}
    </PageBody>
  )
}

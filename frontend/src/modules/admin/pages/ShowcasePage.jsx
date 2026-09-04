import { Link } from 'react-router-dom'
import { Badge, Icon } from '../../../components/ui'
import { PageBody, PageHeader } from '../components/shell'
import { SectionCard } from '../components/display'
import { PLACEHOLDER_SCREENS } from '../lib/placeholderScreens'
import { SCREEN_COUNT, SCREEN_GROUPS } from '../lib/screenIndex'

export function ShowcasePage() {
  const pending = PLACEHOLDER_SCREENS.length

  return (
    <PageBody>
      <PageHeader
        title="Screen showcase"
        description={`${SCREEN_COUNT} screens across ${SCREEN_GROUPS.length} groups. Every link opens a real record, not an empty parameter.`}
      >
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge tone="success" dot>
            {SCREEN_COUNT - pending} built
          </Badge>
          {pending > 0 && <Badge tone="warning" dot>{pending} placeholder</Badge>}
          <Badge tone="neutral">Running on fixtures</Badge>
        </div>
      </PageHeader>

      {SCREEN_GROUPS.map((group) => (
        <SectionCard key={group.label} title={group.label} description={group.note}>
          <ul className="grid gap-px bg-border-subtle sm:grid-cols-2 lg:grid-cols-3">
            {group.screens.map((screen) => (
              <li key={screen.to} className="bg-surface">
                <Link
                  to={screen.to}
                  className="flex items-center gap-2.5 px-4 py-2.5 transition-colors hover:bg-surface-muted"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-slate-900">
                      {screen.name}
                    </span>
                    <span className="tabular block truncate text-2xs text-ink-faint">
                      {screen.to}
                    </span>
                  </span>
                  <Icon name="chevronRight" className="h-3.5 w-3.5 shrink-0 text-border-strong" />
                </Link>
              </li>
            ))}
          </ul>
        </SectionCard>
      ))}
    </PageBody>
  )
}

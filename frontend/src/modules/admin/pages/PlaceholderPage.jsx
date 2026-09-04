import { useLocation } from 'react-router-dom'
import { Badge, Icon } from '../../../components/ui'
import { PageBody, PageHeader } from '../components/shell'

// Every one of the 89 routes resolves from phase 02 onward, so navigation is
// walkable end to end before the screens exist. A route that has not been
// built yet says so, and says which phase builds it — rather than rendering a
// blank panel that looks broken.
export function PlaceholderPage({ title, description, phase, builds = [] }) {
  const { pathname } = useLocation()

  return (
    <PageBody>
      <PageHeader title={title} description={description} />

      <div className="rounded-lg border border-dashed border-border-strong bg-surface p-8">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-surface-muted text-ink-faint">
            <Icon name="sliders" className="h-5 w-5" />
          </span>

          <div>
            <p className="text-sm font-semibold text-slate-900">This screen is not built yet</p>
            <p className="mt-1 text-xs text-ink-subtle">
              The route, the navigation entry and the breadcrumb are wired. The screen itself lands
              in {phase}.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <Badge tone="brand">{phase}</Badge>
            <code className="tabular rounded-md bg-surface-sunken px-2 py-1 text-2xs text-ink-muted">
              {pathname}
            </code>
          </div>

          {builds.length > 0 && (
            <ul className="mt-1 flex flex-col gap-1.5 text-left">
              {builds.map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs text-ink-subtle">
                  <Icon name="check" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" />
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </PageBody>
  )
}

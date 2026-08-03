import { Breadcrumb } from './Breadcrumb'

// Per-page wrapper used inside route pages for consistent spacing/heading.
// Sidebar/Topbar are the persistent app chrome mounted once in App.jsx.
export function PageShell({ title, breadcrumbItems, actions, children }) {
  return (
    <div className="flex flex-col gap-6 p-6">
      {breadcrumbItems && <Breadcrumb items={breadcrumbItems} />}
      {(title || actions) && (
        <div className="flex items-center justify-between">
          {title && <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div>{children}</div>
    </div>
  )
}

import { Avatar, Badge, Button, Icon } from '../../../../components/ui'
import { Drawer } from '../overlay/Drawer'

const GENDER_LABELS = Object.freeze({ male: 'Male', female: 'Female', other: 'Other' })

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function StaffDetailDrawer({
  staff,
  isOpen,
  onClose,
  onEdit,
  onPassword,
  onPermissions,
  onToggleStatus,
}) {
  if (!staff) return null

  const isSuperAdmin = staff.role === 'admin'
  const permList = staff.permissions || []

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Staff Profile"
      description="View detailed personal information, account status, and module permissions."
      width="lg"
      footer={
        <div className="flex w-full items-center justify-between">
          <Button
            variant={staff.isActive ? 'danger' : 'primary'}
            size="control"
            onClick={() => onToggleStatus?.(staff)}
          >
            {staff.isActive ? 'Deactivate Account' : 'Activate Account'}
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="control" onClick={onClose}>
              Close
            </Button>
            <Button
              size="control"
              icon="edit"
              onClick={() => {
                onClose()
                onEdit?.(staff)
              }}
            >
              Edit Staff
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-6 p-5">
        {/* Profile Hero Header */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 rounded-xl border border-border bg-gradient-to-r from-slate-50 to-white p-5">
          <div className="relative shrink-0">
            <Avatar
              name={staff.name}
              src={staff.image}
              size="xl"
              shape="circle"
              className="h-20 w-20 rounded-full ring-4 ring-brand-100 shadow-md aspect-square object-cover"
            />
            <span
              className={`absolute bottom-0 right-0 h-4 w-4 rounded-full ring-2 ring-white ${
                staff.isActive ? 'bg-success-500' : 'bg-danger-500'
              }`}
              title={staff.isActive ? 'Active' : 'Inactive'}
            />
          </div>

          <div className="flex flex-1 flex-col items-center sm:items-start text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h3 className="text-lg font-bold text-slate-900">{staff.name}</h3>
              {staff.role === 'admin' ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent-50 px-2.5 py-1 text-xs font-semibold text-accent-700 ring-1 ring-accent-200/70">
                  <Icon name="roles" className="h-3 w-3 text-accent-500 shrink-0" />
                  Admin
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 ring-1 ring-brand-200/70">
                  <Icon name="user" className="h-3 w-3 text-brand-500 shrink-0" />
                  Staff
                </span>
              )}
              {staff.isActive ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-success-50 px-2.5 py-1 text-xs font-medium text-success-700 ring-1 ring-success-200/70">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-success-500" />
                  </span>
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                  <span className="h-2 w-2 rounded-full bg-slate-400" />
                  Inactive
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-500 flex items-center gap-1.5">
              <Icon name="mail" className="h-3.5 w-3.5 text-slate-400" />
              {staff.email}
            </p>

            {/* Quick Action Shortcuts */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onEdit?.(staff)
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-brand-600"
              >
                <Icon name="edit" className="h-3.5 w-3.5" />
                Edit Info
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onPassword?.(staff)
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-warning-600"
              >
                <Icon name="lock" className="h-3.5 w-3.5" />
                Password
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onPermissions?.(staff)
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-brand-600"
              >
                <Icon name="settings" className="h-3.5 w-3.5" />
                Permissions
              </button>
            </div>
          </div>
        </div>

        {/* Personal Details Card */}
        <div className="rounded-xl border border-border bg-surface p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
            Personal Information
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg bg-surface-muted/50 p-3">
              <p className="text-xs text-slate-500">Full Name</p>
              <p className="mt-0.5 font-medium text-slate-900">{staff.name || '—'}</p>
            </div>
            <div className="rounded-lg bg-surface-muted/50 p-3">
              <p className="text-xs text-slate-500">Work Email</p>
              <p className="mt-0.5 font-medium text-slate-900">{staff.email || '—'}</p>
            </div>
            <div className="rounded-lg bg-surface-muted/50 p-3">
              <p className="text-xs text-slate-500">Mobile Number</p>
              <p className="mt-0.5 font-medium text-slate-900">{staff.mobileNumber || '—'}</p>
            </div>
            <div className="rounded-lg bg-surface-muted/50 p-3">
              <p className="text-xs text-slate-500">Gender</p>
              <p className="mt-0.5 font-medium text-slate-900">
                {GENDER_LABELS[staff.gender] || staff.gender || 'Not specified'}
              </p>
            </div>
            <div className="rounded-lg bg-surface-muted/50 p-3">
              <p className="text-xs text-slate-500">Date of Birth</p>
              <p className="mt-0.5 font-medium text-slate-900">{formatDate(staff.dob)}</p>
            </div>
            <div className="rounded-lg bg-surface-muted/50 p-3">
              <p className="text-xs text-slate-500">Joined On</p>
              <p className="mt-0.5 font-medium text-slate-900">{formatDate(staff.createdAt)}</p>
            </div>
          </div>
        </div>

        {/* Sidebar Permissions Overview */}
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Assigned Permissions
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                {isSuperAdmin
                  ? 'Super administrators have full access to all system modules.'
                  : `${permList.length} modules accessible.`}
              </p>
            </div>
            {!isSuperAdmin && (
              <Button
                variant="quiet"
                size="sm"
                icon="settings"
                onClick={() => {
                  onClose()
                  onPermissions?.(staff)
                }}
              >
                Manage
              </Button>
            )}
          </div>

          {isSuperAdmin ? (
            <div className="flex items-center gap-2 rounded-lg bg-accent-50/60 p-3 text-xs text-accent-700">
              <Icon name="shield" className="h-4 w-4" />
              <span>This account is an Administrator with unrestricted panel access.</span>
            </div>
          ) : permList.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {permList.map((perm) => (
                <span
                  key={perm}
                  className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                >
                  <Icon name="check" className="h-3 w-3 text-success-600" />
                  {perm.replace(/^admin\./, '').replace(/\./g, ' · ')}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">No module permissions assigned yet.</p>
          )}
        </div>
      </div>
    </Drawer>
  )
}

import { useState } from 'react'
import { Button, Icon, Input, Modal } from '../../../../components/ui'

// One dialog for every destructive action. `confirmPhrase` turns it into a
// typed confirmation — reserved for actions that move money or delete records
// that cannot be recovered, so the guard still means something when it appears.
//
// The closed case returns before the body mounts, so the typed phrase resets
// by unmounting rather than by an effect that clears it on every open.
export function ConfirmDialog({ isOpen, ...props }) {
  if (!isOpen) return null
  return <ConfirmDialogBody {...props} />
}

function ConfirmDialogBody({
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  confirmPhrase,
  isSubmitting = false,
  children,
}) {
  const [typed, setTyped] = useState('')
  const phraseSatisfied = !confirmPhrase || typed.trim() === confirmPhrase

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="control" onClick={onClose} disabled={isSubmitting}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            size="control"
            onClick={onConfirm}
            disabled={!phraseSatisfied}
            isLoading={isSubmitting}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {description && (
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
              tone === 'danger' ? 'bg-danger-50 text-danger-500' : 'bg-brand-50 text-brand-600'
            }`}
          >
            <Icon name={tone === 'danger' ? 'warning' : 'info'} className="h-[1.125rem] w-[1.125rem]" />
          </span>
          <div className="min-w-0 flex-1 pt-1.5 text-sm leading-relaxed text-ink-muted">{description}</div>
        </div>
      )}
      {children && <div className={description ? 'mt-4' : undefined}>{children}</div>}
      {confirmPhrase && (
        <div className="mt-4">
          <Input
            id="confirm-phrase"
            size="control"
            label={
              <>
                Type <span className="font-semibold text-slate-900">{confirmPhrase}</span> to confirm
              </>
            }
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder={confirmPhrase}
            autoComplete="off"
          />
        </div>
      )}
    </Modal>
  )
}

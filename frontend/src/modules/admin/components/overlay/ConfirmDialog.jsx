import { useState } from 'react'
import { Button, Input, Modal } from '../../../../components/ui'

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
      description={description}
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
      {children}
      {confirmPhrase && (
        <div className="mt-4">
          <Input
            id="confirm-phrase"
            size="control"
            label={
              <>
                Type <span className="font-semibold text-slate-900">{confirmPhrase}</span> to
                confirm
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

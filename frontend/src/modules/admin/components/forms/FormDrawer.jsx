import { useId } from 'react'
import { Button } from '../../../../components/ui'
import { InlineAlert } from '../feedback'
import { Drawer } from '../overlay/Drawer'

// The standard create/edit container. The footer buttons live outside the
// <form> element, so the submit button is tied back to it with `form={id}` —
// that keeps Enter-to-submit working without lifting the form markup into
// the drawer's footer slot.
export function FormDrawer({
  isOpen,
  onClose,
  title,
  description,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  submitTone = 'primary',
  isSubmitting = false,
  canSubmit = true,
  error,
  onSubmit,
  width = 'md',
  children,
}) {
  const formId = useId()

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      width={width}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="quiet" size="control" onClick={onClose} disabled={isSubmitting}>
            {cancelLabel}
          </Button>
          <Button
            type="submit"
            form={formId}
            size="control"
            variant={submitTone}
            isLoading={isSubmitting}
            disabled={!canSubmit}
          >
            {submitLabel}
          </Button>
        </div>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {error && (
          <InlineAlert tone="danger" title="That did not save">
            {error.message}
          </InlineAlert>
        )}
        {children}
      </form>
    </Drawer>
  )
}

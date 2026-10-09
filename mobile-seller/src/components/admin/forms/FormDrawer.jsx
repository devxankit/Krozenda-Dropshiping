import { StyleSheet, View } from 'react-native'
import { Button } from '../../ui'
import { InlineAlert } from '../feedback'
import { Drawer } from '../overlay/Drawer'

// The standard create/edit container. Natively there is no <form>: the footer's submit button
// calls `onSubmit` with a stand-in event ({ preventDefault() {} }) so web handlers
// (`handleSubmit(...)`, `(event) => { event.preventDefault(); ... }`) work unchanged.
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
  side = 'right',
  children,
}) {
  function submit() {
    if (isSubmitting || !canSubmit) return
    onSubmit?.({ preventDefault() {}, stopPropagation() {} })
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      width={width}
      side={side}
      footer={
        <View style={styles.footer}>
          <Button variant="quiet" size="control" onPress={onClose} disabled={isSubmitting}>
            {cancelLabel}
          </Button>
          <Button size="control" variant={submitTone} isLoading={isSubmitting} disabled={!canSubmit} onPress={submit}>
            {submitLabel}
          </Button>
        </View>
      }
    >
      <View style={styles.form}>
        {error ? (
          <InlineAlert tone="danger" title="That did not save">
            {error.message}
          </InlineAlert>
        ) : null}
        {children}
      </View>
    </Drawer>
  )
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  form: { gap: 16, padding: 20 },
})

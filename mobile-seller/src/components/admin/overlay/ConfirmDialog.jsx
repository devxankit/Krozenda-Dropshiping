import { useState } from 'react'
import { StyleSheet, TextInput, View } from 'react-native'
import { Button, Icon, Modal, Text } from '../../ui'
import { colors, fontFamilyFor, radius } from '../../../theme'

// One dialog for every destructive action. `confirmPhrase` turns it into a typed confirmation -
// reserved for actions that move money or delete records that cannot be recovered.
//
// The closed case returns before the body mounts, so the typed phrase resets by unmounting.
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
  const danger = tone === 'danger'

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="control" onPress={onClose} disabled={isSubmitting}>
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            size="control"
            onPress={onConfirm}
            disabled={!phraseSatisfied}
            isLoading={isSubmitting}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {description ? (
        <View style={styles.row}>
          <View style={[styles.iconTile, { backgroundColor: danger ? colors.danger[50] : colors.brand[50] }]}>
            <Icon
              name={danger ? 'warning' : 'info'}
              size={18}
              color={danger ? colors.danger[500] : colors.brand[600]}
            />
          </View>
          <View style={styles.desc}>
            {typeof description === 'string' ? <Text style={styles.descText}>{description}</Text> : description}
          </View>
        </View>
      ) : null}
      {children ? <View style={description ? { marginTop: 16 } : undefined}>{children}</View> : null}
      {confirmPhrase ? (
        <View style={{ marginTop: 16, gap: 6 }}>
          <Text style={styles.label}>
            Type <Text noTranslate style={[styles.label, { fontWeight: '600', color: colors.slate[900] }]}>{confirmPhrase}</Text> to confirm
          </Text>
          <TextInput
            value={typed}
            onChangeText={setTyped}
            placeholder={confirmPhrase}
            placeholderTextColor={colors.ink.faint}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
        </View>
      ) : null}
    </Modal>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconTile: { height: 36, width: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  desc: { flex: 1, minWidth: 0, paddingTop: 6 },
  descText: { fontSize: 14, lineHeight: 22.75, color: colors.ink.muted },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '500', color: colors.slate[700] },
  input: {
    height: 36, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border.DEFAULT,
    backgroundColor: '#fff', paddingHorizontal: 12, fontSize: 14, color: colors.slate[900],
    fontFamily: fontFamilyFor('400'),
  },
})

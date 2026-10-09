import { Children } from 'react'
import { StyleSheet, View } from 'react-native'
import { Icon, Text } from '../../ui'
import { colors, radius } from '../../../theme'

// The form scaffolding every create/edit/settings screen composes from. Fields themselves come
// from components/ui - these are the containers, the rhythm and the footer.

// `columns` is the web's grid column count (applied inline on the web, so it also applies at phone
// width): children are laid out in equal-width rows of `columns`.
export function FormSection({ title, description, badge, columns = 3, children, footer }) {
  const kids = Children.toArray(children)
  const rows = []
  for (let i = 0; i < kids.length; i += columns) rows.push(kids.slice(i, i + columns))
  return (
    <View style={styles.section}>
      {title || badge ? (
        <View style={styles.sectionHead}>
          <View style={{ flex: 1, minWidth: 0 }}>
            {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
            {description ? <Text style={styles.sectionDesc}>{description}</Text> : null}
          </View>
          {badge ? <View style={{ flexShrink: 0 }}>{badge}</View> : null}
        </View>
      ) : null}
      <View style={styles.sectionBody}>
        {rows.map((row, rowIndex) => (
          <View key={`row-${rowIndex}`} style={{ flexDirection: 'row', gap: 16 }}>
            {row.map((child, index) => (
              <View key={child.key ?? index} style={{ flex: 1, minWidth: 0 }}>
                {child}
              </View>
            ))}
          </View>
        ))}
      </View>
      {footer ? <View style={styles.sectionFoot}>{footer}</View> : null}
    </View>
  )
}

// Label + help left, control right.
export function FormRow({ label, description, children, style }) {
  return (
    <View style={[styles.row, style]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {description ? <Text style={styles.rowDesc}>{description}</Text> : null}
      </View>
      <View style={{ flexShrink: 0 }}>{children}</View>
    </View>
  )
}

// steps: [{ id, label, hint, state: 'done' | 'current' | 'todo' }]
export function Stepper({ steps = [] }) {
  return (
    <View style={styles.stepper}>
      {steps.map((step, index) => (
        <View
          key={step.id}
          style={[
            styles.step,
            index > 0 && { borderLeftWidth: 1, borderLeftColor: colors.border.DEFAULT },
            step.state === 'current' && { borderBottomWidth: 2, borderBottomColor: colors.brand[600], backgroundColor: colors.brand[50] + '66' },
          ]}
        >
          <View
            style={[
              styles.stepDot,
              step.state === 'done' && { backgroundColor: colors.success[700] },
              step.state === 'current' && { backgroundColor: colors.brand[600] },
              step.state === 'todo' && { borderWidth: 1, borderColor: colors.border.strong },
            ]}
          >
            {step.state === 'done' ? (
              <Icon name="check" size={12} color="#fff" />
            ) : (
              <Text
                noTranslate
                style={{ fontSize: 11, fontWeight: '700', color: step.state === 'todo' ? colors.ink.faint : '#fff' }}
              >
                {String(index + 1)}
              </Text>
            )}
          </View>
          <View style={{ flexShrink: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={{ fontSize: 12, lineHeight: 16, fontWeight: '600', color: step.state === 'todo' ? colors.ink.subtle : colors.slate[900] }}
            >
              {step.label}
            </Text>
            <Text
              numberOfLines={1}
              style={{ fontSize: 11, lineHeight: 16, fontWeight: step.state === 'current' ? '500' : '400', color: step.state === 'current' ? colors.brand[600] : colors.ink.faint }}
            >
              {step.hint}
            </Text>
          </View>
        </View>
      ))}
    </View>
  )
}

// The bottom bar of a form screen: what is unsaved, a note and the actions.
export function FormActions({ status, note, children }) {
  return (
    <View style={styles.actions}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0, flexShrink: 1 }}>{status}</View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        {note ? <Text style={{ fontSize: 11, lineHeight: 16, color: colors.ink.faint }}>{note}</Text> : null}
        {children}
      </View>
    </View>
  )
}

export function UnsavedIndicator({ count, fields = [] }) {
  if (!count) return <Text style={{ fontSize: 12, lineHeight: 16, color: colors.ink.faint }}>No changes yet</Text>
  return (
    <>
      <View style={{ height: 6, width: 6, borderRadius: 3, backgroundColor: colors.brand[600] }} />
      <Text style={{ fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[900] }}>
        {`${count} unsaved ${count === 1 ? 'change' : 'changes'}`}
      </Text>
      {fields.length > 0 ? (
        <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 12, lineHeight: 16, color: colors.ink.subtle }}>
          {`· ${fields.join(', ')}`}
        </Text>
      ) : null}
    </>
  )
}

export { FormDrawer } from './FormDrawer'

const styles = StyleSheet.create({
  section: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border.DEFAULT, backgroundColor: colors.surface.DEFAULT },
  sectionHead: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16,
    borderBottomWidth: 1, borderBottomColor: colors.border.DEFAULT, paddingHorizontal: 16, paddingVertical: 12,
  },
  sectionTitle: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.slate[900] },
  sectionDesc: { marginTop: 2, fontSize: 12, lineHeight: 16, color: colors.ink.subtle },
  sectionBody: { gap: 16, padding: 16 },
  sectionFoot: { borderTopWidth: 1, borderTopColor: colors.border.DEFAULT, paddingHorizontal: 16, paddingVertical: 12 },
  row: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16,
    borderBottomWidth: 1, borderBottomColor: colors.border.subtle, paddingHorizontal: 16, paddingVertical: 12,
  },
  rowLabel: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[900] },
  rowDesc: { marginTop: 2, fontSize: 11, lineHeight: 15, color: colors.ink.faint },
  stepper: {
    flexDirection: 'row', overflow: 'hidden', borderRadius: radius.lg, borderWidth: 1,
    borderColor: colors.border.DEFAULT, backgroundColor: colors.surface.DEFAULT,
  },
  step: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  stepDot: { height: 22, width: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  actions: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    borderTopWidth: 1, borderTopColor: colors.border.DEFAULT, backgroundColor: colors.surface.DEFAULT,
    paddingHorizontal: 20, paddingVertical: 12,
  },
})

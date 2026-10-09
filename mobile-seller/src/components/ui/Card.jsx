import { Pressable, View, StyleSheet } from 'react-native'
import { colors, radius, shadows } from '../../theme'
import { Text } from './Text'

// Port of components/ui/Card.jsx at phone width (px-3.5 py-2.5 header, p-3 body).
export function Card({ children, style, onPress, onClick, ...props }) {
  const press = onPress || onClick
  const Comp = press ? Pressable : View
  return (
    <Comp {...props} onPress={press} style={[styles.card, shadows.xs, style]}>
      {children}
    </Comp>
  )
}

export function CardHeader({ title, description, actions, style }) {
  return (
    <View style={[styles.header, style]}>
      <View style={{ flexShrink: 1, minWidth: 0 }}>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  )
}

export function CardBody({ children, style }) {
  return <View style={[{ padding: 12 }, style]}>{children}</View>
}

export function CardFooter({ children, style }) {
  return <View style={[styles.footer, style]}>{children}</View>
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, borderWidth: 1, borderColor: 'rgba(226,232,240,0.8)', backgroundColor: colors.surface.DEFAULT },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    columnGap: 12,
    rowGap: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.DEFAULT,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  title: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[900] },
  description: { marginTop: 2, fontSize: 11, lineHeight: 15, color: colors.ink.subtle },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border.DEFAULT,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
})

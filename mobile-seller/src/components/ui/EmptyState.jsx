import { View, StyleSheet } from 'react-native'
import { colors, radius, shadows } from '../../theme'
import { Text } from './Text'
import { Icon } from './Icon'

// Port of components/ui/EmptyState.jsx at phone width.
export function EmptyState({ icon = 'info', title, description, action, style }) {
  return (
    <View style={[styles.box, style]}>
      <View style={[styles.tile, shadows.xs]}>
        <Icon name={icon} size={18} color={colors.slate[400]} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        {description ? <Text style={styles.desc}>{description}</Text> : null}
      </View>
      {action ? <View style={{ marginTop: 2 }}>{action}</View> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(226,232,240,0.9)',
    backgroundColor: 'rgba(248,250,252,0.4)',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  tile: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.xl,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.6)',
  },
  copy: { maxWidth: 384, alignItems: 'center' },
  title: { fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: -0.15, color: colors.slate[900], textAlign: 'center' },
  desc: { marginTop: 2, fontSize: 11, lineHeight: 18, color: colors.slate[500], textAlign: 'center' },
})

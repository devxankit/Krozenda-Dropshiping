import { StyleSheet, View } from 'react-native'
import { Text } from '../../ui'
import { colors, sp } from '../../../theme'

// Every screen's top block: title, one line of context, actions. The breadcrumb is hidden below
// `sm` on the web, so it does not exist here (`trail` is accepted and ignored).
export function PageHeader({ title, description, actions, children }) {
  return (
    <View style={styles.root}>
      <View style={styles.titleBlock}>
        <Text style={styles.title}>{title}</Text>
        {description ? (
          <Text numberOfLines={2} style={styles.description}>
            {description}
          </Text>
        ) : null}
        {children}
      </View>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: sp(1.5) },
  titleBlock: { minWidth: 0 },
  title: { fontSize: 16, lineHeight: 24, fontWeight: '700', letterSpacing: -0.4, color: colors.slate[900] },
  description: { marginTop: 2, fontSize: 12, lineHeight: 18, color: colors.ink.subtle },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: sp(1.5) },
})

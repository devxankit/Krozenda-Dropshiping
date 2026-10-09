import { View, StyleSheet } from 'react-native'
import { colors, radius } from '../../theme'
import { Animated, PressableScale, fadeIn } from './motion'
import { Text } from './Text'
import { Skeleton } from './Skeleton'

// Port of components/ui/AsyncBoundary.jsx: loading / error / empty / content states.

export function ErrorState({ error, title, description, onRetry, style }) {
  const offline = error?.isOffline || error?.code === 'OFFLINE'
  const heading = title || (offline ? "You're offline" : 'That didn’t load')
  const body = description || error?.message || 'Something went wrong while loading this. Please try again.'
  return (
    <Animated.View entering={fadeIn} accessibilityRole="alert" style={[styles.card, style]}>
      <View style={[styles.iconWrap, { backgroundColor: offline ? colors.amber[50] : colors.red[50] }]}>
        <Text noTranslate style={{ fontSize: 20, color: offline ? colors.amber[600] : colors.red[500] }}>
          {offline ? '⚡' : '⚠'}
        </Text>
      </View>
      <View style={{ gap: 4, alignItems: 'center' }}>
        <Text style={styles.title}>{heading}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
      {onRetry ? (
        <PressableScale onPress={onRetry} accessibilityRole="button" style={styles.retry}>
          <Text style={styles.retryText}>Try again</Text>
        </PressableScale>
      ) : null}
    </Animated.View>
  )
}

export function EmptyResult({ icon = '📭', title, description, action, style }) {
  return (
    <Animated.View entering={fadeIn} style={[styles.card, style]}>
      <View style={[styles.iconWrap, { height: 56, width: 56, backgroundColor: colors.blue[50] }]}>
        <Text noTranslate style={{ fontSize: 24 }}>
          {icon}
        </Text>
      </View>
      <View style={{ gap: 4, alignItems: 'center' }}>
        <Text style={styles.title}>{title}</Text>
        {description ? <Text style={styles.body}>{description}</Text> : null}
      </View>
      {action}
    </Animated.View>
  )
}

export function ProductGridSkeleton({ count = 8, style }) {
  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, style]}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.gridCell}>
          <Skeleton style={{ aspectRatio: 1, borderRadius: 0 }} />
          <View style={{ padding: 12, gap: 8 }}>
            <Skeleton style={{ height: 12, width: '80%' }} />
            <Skeleton style={{ height: 12, width: '60%' }} />
            <Skeleton style={{ height: 16, width: '50%' }} />
          </View>
        </View>
      ))}
    </View>
  )
}

export function ListSkeleton({ count = 4, style }) {
  return (
    <View style={[{ gap: 12 }, style]}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.listRow}>
          <Skeleton style={{ height: 64, width: 64, borderRadius: 12 }} />
          <View style={{ flex: 1, gap: 8, paddingVertical: 4 }}>
            <Skeleton style={{ height: 12, width: '75%' }} />
            <Skeleton style={{ height: 12, width: '50%' }} />
            <Skeleton style={{ height: 16, width: '33%' }} />
          </View>
        </View>
      ))}
    </View>
  )
}

// Renders exactly one of loading / error / empty / children.
export function AsyncBoundary({ isLoading, error, isEmpty, onRetry, skeleton, empty, children }) {
  if (isLoading) return skeleton ?? <ListSkeleton />
  if (error) return <ErrorState error={error} onRetry={onRetry} />
  if (isEmpty) return empty ?? <EmptyResult title="Nothing here yet" />
  return children
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.slate[300],
    backgroundColor: '#fff',
    padding: 32,
  },
  iconWrap: { height: 48, width: 48, borderRadius: 9999, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, fontWeight: '700', color: colors.slate[900], textAlign: 'center' },
  body: { fontSize: 12, color: colors.slate[500], textAlign: 'center', maxWidth: 320, lineHeight: 16 },
  retry: { marginTop: 4, borderRadius: radius.xl, backgroundColor: colors.blue[600], paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  gridCell: {
    width: '48%',
    overflow: 'hidden',
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.slate[200],
    backgroundColor: '#fff',
  },
  listRow: {
    flexDirection: 'row',
    gap: 12,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.slate[200],
    backgroundColor: '#fff',
    padding: 16,
  },
})

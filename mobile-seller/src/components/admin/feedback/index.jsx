import { StyleSheet, View } from 'react-native'
import { Button, Icon, Skeleton, Text } from '../../ui'
import { useAuthStore } from '../../../lib/authStore'
import { colors, radius, shadows, sp } from '../../../theme'

// Rule 09: every screen has a loading, empty, error and loaded state. These are the shared three.

const ALERT_TONE = Object.freeze({
  info: { border: colors.brand[200], bg: colors.brand[50], fg: colors.brand[700] },
  success: { border: colors.success[200], bg: colors.success[50], fg: colors.success[700] },
  warning: { border: colors.warning[200], bg: colors.warning[50], fg: colors.warning[700] },
  danger: { border: colors.danger[200], bg: colors.danger[50], fg: colors.danger[700] },
})

const ALERT_ICON = Object.freeze({
  info: 'info',
  success: 'successCircle',
  warning: 'warning',
  danger: 'danger',
})

// `children` may be text or elements; plain strings pick up the tone colour.
export function InlineAlert({ tone = 'info', title, children, action, style }) {
  const t = ALERT_TONE[tone]
  return (
    <View
      accessibilityRole={tone === 'danger' || tone === 'warning' ? 'alert' : undefined}
      style={[styles.alert, { borderColor: t.border, backgroundColor: t.bg }, style]}
    >
      <View style={styles.alertIcon}>
        <Icon name={ALERT_ICON[tone]} size={16} color={t.fg} />
      </View>
      <View style={styles.alertBody}>
        {title ? <Text style={[styles.alertText, styles.alertTitle, { color: t.fg }]}>{title}</Text> : null}
        {typeof children === 'string' || typeof children === 'number' ? (
          <Text style={[styles.alertText, { color: t.fg }]}>{children}</Text>
        ) : (
          children
        )}
      </View>
      {action ? <View style={styles.alertAction}>{action}</View> : null}
    </View>
  )
}

export function ErrorState({ error, onRetry, title = 'This did not load' }) {
  return (
    <View accessibilityRole="alert" style={styles.errorBox}>
      <View style={styles.errorIcon}>
        <Icon name="danger" size={24} color={colors.danger[500]} />
      </View>
      <View style={{ alignItems: 'center' }}>
        <Text style={styles.errorTitle}>{title}</Text>
        <Text style={styles.errorMsg}>
          {error?.message || 'Something went wrong on our side. Try again in a moment.'}
        </Text>
      </View>
      {onRetry ? (
        <Button variant="secondary" size="control" icon="refresh" onPress={onRetry}>
          Try again
        </Button>
      ) : null}
    </View>
  )
}

// Mirrors the real page - header, KPI row (stacked at phone width), a wide panel then a narrow one.
export function PageSkeleton({ rows = 4 }) {
  return (
    <View style={{ gap: sp(5) }} accessibilityLabel="Loading">
      <View style={{ gap: sp(2) }}>
        <Skeleton style={{ height: 12, width: 160 }} />
        <Skeleton style={{ height: 28, width: 256 }} />
        <Skeleton style={{ height: 12, width: 320, maxWidth: '100%' }} />
      </View>
      <View style={{ gap: sp(4) }}>
        {Array.from({ length: 4 }, (_, index) => (
          <View key={`tile-${index}`} style={styles.skCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Skeleton style={{ height: 12, width: 96 }} />
              <Skeleton style={{ height: 32, width: 32, borderRadius: radius.lg }} />
            </View>
            <Skeleton style={{ height: 28, width: 128 }} />
            <Skeleton style={{ height: 12, width: 80 }} />
          </View>
        ))}
      </View>
      <View style={{ gap: sp(4) }}>
        <View style={styles.skCard}>
          <Skeleton style={{ height: 16, width: 160 }} />
          <Skeleton style={{ height: 224, width: '100%' }} />
        </View>
        <View style={styles.skCard}>
          <Skeleton style={{ height: 16, width: 128 }} />
          {Array.from({ length: rows }, (_, index) => (
            <Skeleton key={`row-${index}`} style={{ height: 40, width: '100%' }} />
          ))}
        </View>
      </View>
    </View>
  )
}

// Hides an action the signed-in role cannot perform. `fallback` is for cases where a disabled
// control communicates more than a missing one.
export function PermissionGate({ permission, permissions = [], mode = 'any', fallback = null, children }) {
  const granted = useAuthStore((state) => state.permissions) || []
  const required = permission ? [permission] : permissions

  if (required.length === 0) return children

  const allowed =
    mode === 'all'
      ? required.every((item) => granted.includes(item))
      : required.some((item) => granted.includes(item))

  return allowed ? children : fallback
}

// An empty RESULT, not a failure: the window picked has no rows.
export function NoData({ message = 'No data in this window', hint }) {
  return (
    <View style={styles.noData}>
      <Icon name="activity" size={20} color={colors.border.strong} />
      <Text style={styles.noDataMsg}>{message}</Text>
      {hint ? <Text style={styles.noDataHint}>{hint}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  alert: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: radius.lg, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  alertIcon: { marginTop: 2 },
  alertBody: { flex: 1, minWidth: 0 },
  alertText: { fontSize: 12, lineHeight: 19.5 },
  alertTitle: { fontWeight: '600' },
  alertAction: { flexShrink: 0 },
  errorBox: {
    alignItems: 'center', justifyContent: 'center', gap: 16, borderRadius: radius.lg, borderWidth: 1,
    borderStyle: 'dashed', borderColor: colors.danger[200], backgroundColor: colors.danger[50] + '66',
    paddingHorizontal: 24, paddingVertical: 48,
  },
  errorIcon: {
    height: 48, width: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.xl,
    backgroundColor: colors.danger[50], borderWidth: 1, borderColor: colors.danger[200],
  },
  errorTitle: { fontSize: 16, lineHeight: 24, fontWeight: '600', color: colors.slate[900], textAlign: 'center' },
  errorMsg: { marginTop: 4, maxWidth: 448, fontSize: 14, lineHeight: 22, color: colors.ink.subtle, textAlign: 'center' },
  skCard: {
    gap: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border.DEFAULT,
    backgroundColor: colors.surface.DEFAULT, padding: 16, ...shadows.card,
  },
  noData: { flex: 1, minHeight: 96, alignItems: 'center', justifyContent: 'center', gap: 6 },
  noDataMsg: { fontSize: 12, lineHeight: 16, fontWeight: '500', color: colors.ink.subtle, textAlign: 'center' },
  noDataHint: { maxWidth: 320, fontSize: 11, lineHeight: 16, color: colors.ink.faint, textAlign: 'center' },
})

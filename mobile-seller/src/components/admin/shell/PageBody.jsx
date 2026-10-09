import { RefreshControl, ScrollView, StyleSheet } from 'react-native'
import { colors, sp } from '../../../theme'

// The one page container (web: flex-col gap-2.5 px-3 py-2.5 at phone width). Natively it is also the
// page's scroll container. `className`/`width` are web-only and ignored. Pass `refreshing` +
// `onRefresh` for pull-to-refresh.
export function PageBody({ children, style, contentStyle, refreshing, onRefresh, ...rest }) {
  return (
    <ScrollView
      {...rest}
      style={[styles.scroll, style]}
      contentContainerStyle={[styles.content, contentStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={Boolean(refreshing)}
            onRefresh={onRefresh}
            colors={[colors.brand[600]]}
            tintColor={colors.brand[600]}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { flexGrow: 1, gap: sp(2.5), paddingHorizontal: sp(3), paddingVertical: sp(2.5) },
})

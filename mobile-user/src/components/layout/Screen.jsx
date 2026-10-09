import { View, ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../theme'
import { BottomNavbar } from './BottomNavbar'

// Page container. Mirrors the web screens' root (min-h-screen bg-slate-50) with safe-area handling.
//   scroll    - wrap children in a ScrollView (default true). Use scroll={false} for screens that
//               render their own FlatList/SectionList.
//   nav       - render the bottom tab bar and reserve space for it (screens that are NOT tabs)
//   tab       - a screen inside the tab navigator: the navigator draws the bar below it, so no padding here
//   header    - node rendered above the content, outside the scroll area (sticky header)
//   footer    - node pinned under the content (sticky bottom action bar)
//   keyboard  - wrap in KeyboardAvoidingView (forms)
export const NAV_HEIGHT = 62

export function Screen({
  children,
  scroll = true,
  nav = false,
  tab = false,
  activeTab,
  header,
  footer,
  keyboard = false,
  background = colors.slate[50],
  contentStyle,
  refreshControl,
  topInset = true,
  onScroll,
  scrollRef,
}) {
  const insets = useSafeAreaInsets()
  const bottomPad = tab ? 0 : nav ? NAV_HEIGHT + insets.bottom : footer ? 0 : insets.bottom
  const body = scroll ? (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1 }}
      contentContainerStyle={[{ flexGrow: 1, paddingBottom: bottomPad }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
      onScroll={onScroll}
      scrollEventThrottle={onScroll ? 16 : undefined}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1, paddingBottom: bottomPad }, contentStyle]}>{children}</View>
  )
  const inner = (
    <View style={[styles.root, { backgroundColor: background, paddingTop: topInset ? insets.top : 0 }]}>
      {header}
      {body}
      {footer ? <View style={{ paddingBottom: nav ? 0 : insets.bottom }}>{footer}</View> : null}
      {nav ? <BottomNavbar activeTab={activeTab} /> : null}
    </View>
  )
  if (!keyboard) return inner
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {inner}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({ root: { flex: 1 } })

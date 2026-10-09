import { useEffect, useState } from 'react'
import { Animated, Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native'
import { Redirect, Stack, usePathname, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuthStore } from '../../lib/authStore'
import { disconnectRealtime } from '../../lib/realtime'
import { unregisterPushToken } from '../../lib/push'
import { toast } from '../../lib/toast'
import { colors, shadows } from '../../theme'
import { AUTH_ROUTES, SELLER_ROUTES } from '../../config/routes'
import { VendorTopbar } from '../../modules/vendor-shared/components/shell/VendorTopbar'
import { VendorSidebar } from '../../modules/vendor-shared/components/shell/VendorSidebar'
import { VendorBottomNav } from '../../modules/vendor-shared/components/shell/VendorBottomNav'
import { PageSkeleton } from '../../components/admin/feedback'
import {
  useVendorProfileController,
  useVendorPushRefresh,
  useVendorRealtime,
} from '../../modules/vendor-shared/controllers/useVendorController'
import { VENDOR_ONBOARDING_ALLOWED } from '../../modules/vendor-shared/constants'

// Mobile drawer (85vw, max 18rem, slides in from the left over a dimmed page). The panel mounts per
// open, so the slide-in runs on mount.
function DrawerPanel({ width, onClose, onSignOut }) {
  const [x] = useState(() => new Animated.Value(-width))
  useEffect(() => {
    Animated.timing(x, { toValue: 0, duration: 200, useNativeDriver: true }).start()
  }, [x])
  return (
    <Animated.View style={[{ width, height: '100%', backgroundColor: colors.surface.DEFAULT, transform: [{ translateX: x }] }, shadows['2xl']]}>
      <DrawerBody onClose={onClose} onSignOut={onSignOut} />
    </Animated.View>
  )
}

function NavDrawer({ visible, onClose, onSignOut }) {
  const { width } = useWindowDimensions()
  const drawerWidth = Math.min(width * 0.85, 288)
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(15,23,42,0.4)' }]} onPress={onClose} accessibilityLabel="Close navigation" />
        <DrawerPanel width={drawerWidth} onClose={onClose} onSignOut={onSignOut} />
      </View>
    </Modal>
  )
}

function DrawerBody({ onClose, onSignOut }) {
  const insets = useSafeAreaInsets()
  return (
    <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <VendorSidebar onToggle={onClose} onNavigate={onClose} onSignOut={onSignOut} />
    </View>
  )
}

// A PENDING / UNDER_REVIEW / REJECTED seller may only reach the screens that exist to get them approved;
// everything else redirects to the status page (port of VendorOnboardingGate).
function useOnboardingGate() {
  const pathname = usePathname()
  const router = useRouter()
  const { data: vendor, isLoading, isError } = useVendorProfileController()
  const blocked =
    !isLoading &&
    !isError &&
    Boolean(vendor) &&
    vendor.verificationStatus !== 'APPROVED' &&
    !VENDOR_ONBOARDING_ALLOWED.some((suffix) => pathname.endsWith(`/${suffix}`) || pathname.includes(`/${suffix}/`))
  useEffect(() => {
    if (blocked) router.replace(SELLER_ROUTES.STATUS)
  }, [blocked, router])
  return { isLoading, blocked }
}

function Panel() {
  const router = useRouter()
  const clearSession = useAuthStore((s) => s.clearSession)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { isLoading, blocked } = useOnboardingGate()

  // One websocket for the whole panel, opened here because this is the only component guaranteed to be
  // mounted for as long as the seller is signed in.
  useVendorRealtime()
  useVendorPushRefresh()

  const handleSignOut = async () => {
    // Before clearing the session: the socket is authenticated with the token about to be thrown away,
    // and so is the push token registration.
    disconnectRealtime()
    await unregisterPushToken()
    clearSession()
    toast.info('Signed Out', 'You have been signed out of your vendor portal.')
    router.replace(AUTH_ROUTES.LOGIN)
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface.muted }}>
      <VendorTopbar onOpenMobileNav={() => setDrawerOpen(true)} onSignOut={handleSignOut} />
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: colors.surface.muted } }} />
        {isLoading || blocked ? (
          <View style={[StyleSheet.absoluteFill, { padding: 12, backgroundColor: colors.surface.muted }]}>
            <PageSkeleton rows={3} />
          </View>
        ) : null}
      </View>
      <VendorBottomNav onOpenMobileNav={() => setDrawerOpen(true)} />
      <NavDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} onSignOut={handleSignOut} />
    </View>
  )
}

// RoleGuard (seller.access): without a seller session everything redirects to the seller login.
export default function PanelLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const permissions = useAuthStore((s) => s.permissions)
  if (!isAuthenticated || !permissions.includes('seller.access')) return <Redirect href={AUTH_ROUTES.LOGIN} />
  return <Panel />
}

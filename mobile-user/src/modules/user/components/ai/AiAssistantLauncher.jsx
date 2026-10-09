import { useEffect, useState } from 'react'
import { Animated, Pressable, StyleSheet, View } from 'react-native'
import { useGlobalSearchParams, usePathname, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AUTH_ROUTES } from '../../../../config/routes'
import { useAuthStore } from '../../../../lib/authStore'
import { useLanguageStore } from '../../../../lib/i18n'
import { Text } from '../../../../components/ui/Text'
import { colors } from '../../../../theme'
import { GradientFill } from '../../../auth/components/GradientFill'
import { useAiAssistantController } from '../../controllers/useAiAssistantController'
import { AiAvatar } from './AiAvatar'
import { AiChatPanel } from './AiChatPanel'

// The account owns the UI language (Customer.language): whenever a session lands - sign-in, app start,
// token refresh - adopt it, or save this device's choice when the account has none. This is the
// web's TranslationProvider effect; the launcher is the one component mounted for the whole app, so
// it hosts it here.
function useAdoptAccountLanguage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const accountLanguage = useAuthStore((s) => s.user?.language)
  const adoptFromAccount = useLanguageStore((s) => s.adoptFromAccount)
  useEffect(() => {
    if (!isAuthenticated) return
    adoptFromAccount(accountLanguage ?? null)
  }, [isAuthenticated, accountLanguage, adoptFromAccount])
}

function Pulse({ children, style }) {
  const [v] = useState(() => new Animated.Value(1))
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 0.5, duration: 1000, useNativeDriver: true }),
        Animated.timing(v, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [v])
  return (
    <Animated.View pointerEvents="none" style={[style, { opacity: v }]}>
      {children}
    </Animated.View>
  )
}

/**
 * The floating AI entry point, mounted once for the whole app (src/app/_layout.js) so it survives
 * navigation and stays put while a screen scrolls.
 *
 * Shown to signed-out visitors too, exactly like the web: half the buyer app (dashboard, catalog,
 * product pages) is public, so hiding the button there makes the feature look broken rather than gated.
 * Everything it can answer is account data, so a guest who taps it is sent to sign in and returned to
 * the screen they were on (the web passes `state.from`; here it is the `redirect` param).
 *
 * The web mounts it inside the buyer routes only (the login routes sit outside), so it is hidden on
 * /auth/*.
 */
export function AiAssistantLauncher() {
  useAdoptAccountLanguage()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const router = useRouter()
  const pathname = usePathname()
  const params = useGlobalSearchParams()
  const insets = useSafeAreaInsets()
  const [isOpen, setIsOpen] = useState(false)
  // Tracks whether the assistant has ever been opened this session, purely to keep the history request
  // off the critical path for customers who never touch it.
  const [hasOpened, setHasOpened] = useState(false)

  // Owned here rather than inside the panel so an in-progress conversation survives closing and
  // reopening the sheet - the panel unmounts, this does not. Gated on `isAuthenticated` as well, so a
  // guest never fires a history request that could only come back 401.
  const assistant = useAiAssistantController({ historyEnabled: hasOpened && isAuthenticated })

  const open = () => {
    if (!isAuthenticated) {
      const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => typeof v === 'string')).toString()
      router.push({ pathname: AUTH_ROUTES.LOGIN, params: { redirect: qs ? `${pathname}?${qs}` : pathname } })
      return
    }
    setHasOpened(true)
    setIsOpen(true)
  }

  if (pathname.startsWith('/auth')) return null
  // Signing out while the chat is open must not leave the sheet on screen.
  const panelOpen = isOpen && isAuthenticated

  return (
    <>
      {!panelOpen && (
        // fixed bottom-[calc(76px+safe-area)] right-4 h-14 w-14
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          <Pressable
            onPress={open}
            accessibilityLabel="Open AI Assistant"
            style={({ pressed }) => [styles.fab, { bottom: 76 + insets.bottom }, pressed && { transform: [{ scale: 0.95 }] }]}
          >
            {/* Ambient pulse halo */}
            <Pulse style={styles.halo}>
              <View style={{ flex: 1, borderRadius: 32, backgroundColor: 'rgba(96,165,250,0.4)' }} />
            </Pulse>

            <View style={styles.ring}>
              <GradientFill colors={[colors.blue[500], colors.indigo[600], colors.blue[700]]} />
              <AiAvatar size={52} iconSize={28} style={{ margin: 2 }} />
            </View>

            {/* Gold AI badge */}
            <View style={styles.badge}>
              <GradientFill colors={[colors.amber[400], colors.amber[500]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
              <Text noTranslate style={styles.badgeText}>AI</Text>
            </View>
          </Pressable>
        </View>
      )}

      {panelOpen && <AiChatPanel assistant={assistant} onClose={() => setIsOpen(false)} />}
    </>
  )
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    width: 56,
    height: 56,
  },
  halo: { position: 'absolute', top: -4, left: -4, right: -4, bottom: -4 },
  ring: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
    elevation: 10,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.65,
    shadowRadius: 12,
    backgroundColor: colors.blue[600],
  },
  badge: {
    position: 'absolute',
    right: -4,
    top: -4,
    overflow: 'hidden',
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#fff',
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  badgeText: { fontSize: 9, lineHeight: 12, fontWeight: '800', letterSpacing: 0.4, color: colors.slate[900] },
})

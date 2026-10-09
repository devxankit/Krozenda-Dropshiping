import { useEffect, useState } from 'react'
import { BackHandler, View } from 'react-native'
import { Stack, useRouter, useNavigationContainerRef } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { Notifications } from '../lib/expoNotifications'
import * as SystemUI from 'expo-system-ui'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { onlineManager } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import NetInfo from '@react-native-community/netinfo'
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans'
import { queryClient, persistOptions } from '../lib/queryClient'
import { bootstrapSession } from '../lib/session'
import { linkToRoute, ensureChannel } from '../lib/push'
import { ToastHost } from '../components/ui/ToastHost'
import { NetworkBanner } from '../components/common/NetworkBanner'
import { ExitDialog } from '../components/common/ExitDialog'
import { AiAssistantLauncher } from '../modules/user/components/ai'
import { colors } from '../theme'

SplashScreen.preventAutoHideAsync().catch(() => {})

// react-query's online state follows the device connection (the web uses window online/offline).
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((s) => setOnline(s.isConnected !== false && s.isInternetReachable !== false)),
)

export default function RootLayout() {
  const router = useRouter()
  const navRef = useNavigationContainerRef()
  const [ready, setReady] = useState(false)
  const [exitOpen, setExitOpen] = useState(false)
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  })

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.slate[50]).catch(() => {})
    bootstrapSession().finally(() => setReady(true))
    ensureChannel().catch(() => {})
  }, [])

  useEffect(() => {
    if (ready && fontsLoaded) SplashScreen.hideAsync().catch(() => {})
  }, [ready, fontsLoaded])

  // Android back: follow the navigation stack; on the root screen ask before exiting (the Flutter
  // wrapper's ExitDialog).
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (navRef.isReady() && navRef.canGoBack()) return false
      setExitOpen(true)
      return true
    })
    return () => sub.remove()
  }, [navRef])

  // Push taps -> in-app route (data.link is an absolute or /app/... URL).
  useEffect(() => {
    if (!Notifications) return undefined
    const open = (response) => {
      const data = response?.notification?.request?.content?.data || {}
      const route = linkToRoute(data.link)
      if (route) router.push(route)
    }
    Notifications.getLastNotificationResponseAsync().then((r) => r && open(r)).catch(() => {})
    const sub = Notifications.addNotificationResponseReceivedListener(open)
    return () => sub.remove()
  }, [router])

  if (!ready || !fontsLoaded) return <View style={{ flex: 1, backgroundColor: '#fff' }} />

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.slate[50] }, animation: 'fade_from_bottom' }} />
          <AiAssistantLauncher />
          <NetworkBanner />
          <ToastHost />
          <ExitDialog visible={exitOpen} onCancel={() => setExitOpen(false)} onExit={() => BackHandler.exitApp()} />
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

import { Tabs, useRouter } from 'expo-router'
import { BottomNavbarView, TAB_ROUTE_NAMES } from '../../components/layout/BottomNavbar'
import { AUTH_ROUTES } from '../../config/routes'
import { useAuthStore } from '../../lib/authStore'
import { colors } from '../../theme'

// The five bottom-bar destinations as ONE navigator. Before, each was a separate full screen that
// drew its own bar and was torn down and rebuilt (router.replace) on every tap. Now the bar is
// created once, a tab keeps its scroll position and data after the first visit, and switching is a
// show/hide with no animation.
const TAB_BY_ROUTE = Object.fromEntries(Object.entries(TAB_ROUTE_NAMES).map(([id, name]) => [name, id]))
const NEEDS_LOGIN = new Set(['orders', 'wishlist', 'profile'])

function TabBar({ state, navigation }) {
  const router = useRouter()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const current = TAB_BY_ROUTE[state.routes[state.index].name] || 'home'

  const onPressTab = (tab) => {
    if (NEEDS_LOGIN.has(tab.id) && !isAuthenticated) {
      router.push({ pathname: AUTH_ROUTES.LOGIN, params: { redirect: tab.route } })
      return
    }
    navigation.navigate(TAB_ROUTE_NAMES[tab.id])
  }

  return <BottomNavbarView current={current} onPressTab={onPressTab} floating={false} />
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        animation: 'none',
        sceneStyle: { backgroundColor: colors.slate[50] },
      }}
    >
      <Tabs.Screen name="dashboard" />
      <Tabs.Screen name="categories" />
      <Tabs.Screen name="orders" />
      <Tabs.Screen name="wishlist" />
      <Tabs.Screen name="profile" />
    </Tabs>
  )
}

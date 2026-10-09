import { useRef, useState } from 'react'
import { Pressable, TextInput, View, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { Screen } from '../../../../components/layout/Screen'
import { Sheet } from '../../../../components/ui/Sheet'
import { Text } from '../../../../components/ui/Text'
import { Icon } from '../../../../components/ui/Icon'
import { SmartImage } from '../../../../components/ui/SmartImage'
import { AUTH_ROUTES, USER_ROUTES } from '../../../../config/routes'
import { useAuthStore } from '../../../../lib/authStore'
import { unregisterPushToken } from '../../../../lib/push'
import { useProfileController } from '../../controllers/useProfileController'
import { useWalletController } from '../../controllers/useWalletController'
import { toast } from '../../../../lib/toast'
import { colors, fontFamilyFor, radius, shadows } from '../../../../theme'

const QUICK_AMOUNTS = [200, 500, 1000, 2000]

function AddMoneyModal({ open, onClose, onConfirm, isSubmitting }) {
  const [amount, setAmount] = useState('500')
  const [error, setError] = useState(null)
  const submittingRef = useRef(false)

  const handleConfirm = async () => {
    const value = Number(amount)
    if (!Number.isFinite(value) || value < 10) {
      setError('Enter an amount of at least ₹10')
      return
    }
    // Synchronous guard: `isSubmitting` only updates after a re-render, so a fast double tap could start two top-ups.
    if (submittingRef.current) return
    submittingRef.current = true
    setError(null)
    try {
      await onConfirm(value)
      onClose()
    } catch (err) {
      setError(err?.message || 'Payment could not be completed. Please try again.')
    } finally {
      submittingRef.current = false
    }
  }

  return (
    <Sheet visible={open} onClose={onClose}>
      <View style={styles.modalHead}>
        <Text style={{ fontSize: 14, fontWeight: '800', color: colors.slate[900] }}>Add Money to Wallet</Text>
        <Pressable onPress={onClose} style={{ padding: 6, borderRadius: 9999 }}>
          <Icon name="HiXMark" size={20} color={colors.slate[500]} />
        </Pressable>
      </View>
      <View style={{ padding: 20, gap: 16 }}>
        <View>
          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.slate[500], marginBottom: 4 }}>Enter Amount</Text>
          <View style={styles.amountBox}>
            <Text noTranslate style={{ fontSize: 14, fontWeight: '800', color: colors.slate[500], marginRight: 4 }}>
              ₹
            </Text>
            <TextInput
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
              style={{ flex: 1, fontSize: 16, fontFamily: fontFamilyFor('800'), color: colors.slate[900], paddingVertical: 0 }}
            />
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {QUICK_AMOUNTS.map((value) => (
            <Pressable key={value} onPress={() => setAmount(String(value))} style={styles.quick}>
              <Text noTranslate style={{ fontSize: 12, fontWeight: '700', color: colors.slate[700] }}>
                ₹{value}
              </Text>
            </Pressable>
          ))}
        </View>
        {error ? <Text style={{ fontSize: 12, fontWeight: '600', color: colors.red[600] }}>{error}</Text> : null}
        <Pressable
          onPress={handleConfirm}
          disabled={isSubmitting}
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: pressed ? colors.blue[700] : colors.blue[600], opacity: isSubmitting ? 0.6 : 1 },
          ]}
        >
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff', letterSpacing: 0.3 }}>
            {isSubmitting ? 'Processing...' : 'Proceed to Pay'}
          </Text>
        </Pressable>
      </View>
    </Sheet>
  )
}

function DeleteAccountModal({ open, onClose, onConfirm, isSubmitting }) {
  const [error, setError] = useState(null)

  const handleDelete = async () => {
    setError(null)
    try {
      await onConfirm()
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to delete account. Please try again.')
    }
  }

  return (
    <Sheet visible={open} onClose={onClose}>
      <View style={{ padding: 24, alignItems: 'center', gap: 16 }}>
        <View style={styles.deleteIcon}>
          <Icon name="HiTrash" size={28} color={colors.red[600]} />
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.slate[900] }}>Delete Account?</Text>
          <Text style={{ fontSize: 12, color: colors.slate[500], marginTop: 6, lineHeight: 19, textAlign: 'center' }}>
            Are you sure you want to permanently delete your account? This action cannot be undone. All your profile
            data, saved addresses, and order history will be permanently deleted.
          </Text>
        </View>
        {error ? (
          <View style={styles.errorBox}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.red[600] }}>{error}</Text>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 12, paddingTop: 8 }}>
          <Pressable
            onPress={onClose}
            disabled={isSubmitting}
            style={({ pressed }) => [styles.modalBtn, { backgroundColor: pressed ? colors.slate[200] : colors.slate[100] }]}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.slate[700] }}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleDelete}
            disabled={isSubmitting}
            style={({ pressed }) => [
              styles.modalBtn,
              shadows.md,
              { backgroundColor: pressed ? colors.red[700] : colors.red[600], opacity: isSubmitting ? 0.6 : 1 },
            ]}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>
              {isSubmitting ? 'Deleting...' : 'Yes, Delete'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Sheet>
  )
}

export function ProfileDashboardScreen({ onNavigateMenu = () => {} }) {
  const router = useRouter()
  const authUser = useAuthStore((state) => state.user)
  const { profile, deleteAccount, isDeletingAccount } = useProfileController()
  const { balance, topup, isToppingUp } = useWalletController()
  const [showAddMoney, setShowAddMoney] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const user = {
    name: profile?.name || authUser?.name || 'Customer',
    mobile: profile?.mobileNumber || authUser?.mobileNumber || authUser?.phone || '',
    email: profile?.email || authUser?.email || '',
    image: profile?.image || authUser?.image || null,
  }

  const handleAddMoney = (amount) =>
    topup(amount, { name: user.name, email: user.email, contact: user.mobile })
      .then(() => toast.success('Wallet Recharged', `₹${amount.toLocaleString('en-IN')} added to your wallet.`))
      .catch((err) => {
        if (!/cancel/i.test(err?.message || '')) {
          toast.error('Top-up Failed', err)
        }
      })

  const handleDeleteAccount = async () => {
    try {
      await deleteAccount()
      useAuthStore.getState().clearSession()
      toast.info('Account Deleted', 'Your account was deleted.')
      router.replace(AUTH_ROUTES.LOGIN)
    } catch (err) {
      toast.error('Could not delete account', err)
    }
  }

  const orderShortcuts = [
    { label: 'All Orders', icon: 'HiShoppingBag', route: USER_ROUTES.ORDERS },
    { label: 'Processing', icon: 'HiArrowPath', route: USER_ROUTES.ORDERS },
    { label: 'Shipped', icon: 'HiTruck', route: USER_ROUTES.ORDERS },
    { label: 'Delivered', icon: 'HiCheckCircle', route: USER_ROUTES.ORDERS },
    { label: 'Cancelled', icon: 'HiXCircle', route: USER_ROUTES.ORDERS },
  ]

  const menuItems = [
    { label: 'Edit Profile', icon: 'HiPencilSquare', route: USER_ROUTES.PROFILE_EDIT },
    { label: 'My Addresses', icon: 'HiMapPin', route: USER_ROUTES.ADDRESSES },
    { label: 'My Wallet', icon: 'HiWallet', route: USER_ROUTES.WALLET },
    { label: 'Wishlist', icon: 'HiHeart', route: USER_ROUTES.WISHLIST },
    { label: 'Coupons & Offers', icon: 'HiTag', route: USER_ROUTES.COUPONS },
    { label: 'My Reviews', icon: 'HiStar', route: '/reviews' },
    { label: 'Returns & Replacements', icon: 'HiArrowPath', route: USER_ROUTES.RETURNS },
    { label: 'Support Center', icon: 'HiQuestionMarkCircle', route: USER_ROUTES.SUPPORT },
    { label: 'Settings', icon: 'HiCog6Tooth', route: USER_ROUTES.SETTINGS },
    { label: 'Logout', icon: 'HiArrowRightOnRectangle', route: AUTH_ROUTES.LOGIN, isLogout: true },
    { label: 'Delete Account', icon: 'HiTrash', isDelete: true },
  ]

  const onMenuPress = async (item) => {
    if (item.isDelete) {
      setShowDeleteModal(true)
      return
    }
    onNavigateMenu(item.label)
    if (item.isLogout) {
      await unregisterPushToken()
      useAuthStore.getState().clearSession()
      toast.info('Signed Out', 'You have been signed out safely.')
      router.replace(item.route)
      return
    }
    router.push(item.route)
  }

  const header = (
    <View style={styles.topBar}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: colors.slate[900] }}>My Profile</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable onPress={() => router.push(USER_ROUTES.NOTIFICATIONS)} style={styles.topBtn}>
          <Icon name="HiBell" size={20} color={colors.slate[700]} />
        </Pressable>
        <Pressable onPress={() => router.push(USER_ROUTES.SETTINGS)} style={styles.topBtn}>
          <Icon name="HiCog6Tooth" size={20} color={colors.slate[700]} />
        </Pressable>
      </View>
    </View>
  )

  return (
    <Screen tab header={header}>
      <View style={{ padding: 16, gap: 16 }}>
        {/* User info banner */}
        <View style={[styles.banner, shadows.md]}>
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="profileGrad" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={colors.blue[900]} />
                <Stop offset="0.5" stopColor={colors.blue[800]} />
                <Stop offset="1" stopColor={colors.indigo[900]} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#profileGrad)" />
          </Svg>
          <View style={{ padding: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <View style={[styles.avatar, shadows.md]}>
                {user.image ? (
                  <SmartImage src={user.image} alt={`${user.name || 'Your'} profile photo`} ratio={1} fit="cover" style={{ width: '100%', height: '100%' }} />
                ) : (
                  <Text noTranslate style={{ fontSize: 24, fontWeight: '800', color: colors.blue[900] }}>
                    {user.name.charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text noTranslate style={{ fontSize: 16, fontWeight: '800', color: '#fff', flexShrink: 1 }}>
                    {user.name}
                  </Text>
                  <Icon name="HiCheckBadge" size={16} color={colors.amber[400]} />
                </View>
                <Text noTranslate style={{ fontSize: 12, fontWeight: '500', color: colors.blue[200] }}>
                  {user.mobile}
                </Text>
                <Text noTranslate style={{ fontSize: 11, color: colors.blue[300] }}>
                  {user.email}
                </Text>
              </View>
            </View>

            {/* Wallet card */}
            <View style={styles.walletCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={styles.walletIcon}>
                  <Icon name="HiWallet" size={20} color={colors.slate[950]} />
                </View>
                <View>
                  <Text style={{ fontSize: 10, fontWeight: '500', color: colors.blue[200] }}>Krozenda Wallet</Text>
                  <Text noTranslate style={{ fontSize: 14, fontWeight: '800', color: '#fff' }}>
                    ₹{balance.toLocaleString('en-IN')}
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => setShowAddMoney(true)}
                style={({ pressed }) => [styles.addMoney, shadows.sm, pressed && { backgroundColor: colors.slate[100] }]}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.blue[900] }}>Add Money</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* My Orders shortcuts */}
        <View style={[styles.card, shadows.xs, { padding: 16, gap: 12 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.slate[900], textTransform: 'uppercase', letterSpacing: 0.6 }}>
              My Orders
            </Text>
            <Pressable onPress={() => router.push(USER_ROUTES.ORDERS)}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.blue[600] }}>View All →</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', gap: 4, paddingTop: 4 }}>
            {orderShortcuts.map((item) => (
              <Pressable key={item.label} onPress={() => router.push(item.route)} style={{ flex: 1, alignItems: 'center' }}>
                <View style={styles.shortcutIcon}>
                  <Icon name={item.icon} size={20} color={colors.slate[700]} />
                </View>
                <Text numberOfLines={1} style={{ fontSize: 10, fontWeight: '600', color: colors.slate[700], marginTop: 4, width: '100%', textAlign: 'center' }}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Menu list */}
        <View style={[styles.card, shadows.xs]}>
          {menuItems.map((item, idx) => {
            const danger = item.isDelete || item.isLogout
            return (
              <Pressable
                key={item.label}
                onPress={() => onMenuPress(item)}
                style={({ pressed }) => [
                  styles.menuRow,
                  idx > 0 && { borderTopWidth: 1, borderTopColor: colors.slate[100] },
                  pressed && { backgroundColor: colors.slate[50] },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={[styles.menuIcon, { backgroundColor: danger ? colors.red[50] : colors.slate[100] }]}>
                    <Icon name={item.icon} size={16} color={danger ? colors.red[600] : colors.slate[700]} />
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: danger ? colors.red[600] : colors.slate[800] }}>
                    {item.label}
                  </Text>
                </View>
                <Icon name="HiChevronRight" size={16} color={colors.slate[400]} />
              </Pressable>
            )
          })}
        </View>
      </View>

      <AddMoneyModal open={showAddMoney} onClose={() => setShowAddMoney(false)} onConfirm={handleAddMoney} isSubmitting={isToppingUp} />
      <DeleteAccountModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteAccount}
        isSubmitting={isDeletingAccount}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[200],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topBtn: { padding: 6, borderRadius: 9999 },
  banner: { borderRadius: radius['3xl'], overflow: 'hidden' },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 9999,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  walletCard: {
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: radius['2xl'],
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  walletIcon: { width: 36, height: 36, borderRadius: radius.xl, backgroundColor: colors.amber[400], alignItems: 'center', justifyContent: 'center' },
  addMoney: { backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.xl },
  card: { backgroundColor: '#fff', borderRadius: radius['2xl'], borderWidth: 1, borderColor: 'rgba(226,232,240,0.8)' },
  shortcutIcon: { width: 40, height: 40, borderRadius: radius.xl, backgroundColor: colors.slate[100], alignItems: 'center', justifyContent: 'center' },
  menuRow: { padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  menuIcon: { width: 32, height: 32, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
  modalHead: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.slate[50],
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: radius.xl,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  quick: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.slate[200] },
  primaryBtn: { width: '100%', paddingVertical: 12, borderRadius: radius.xl, alignItems: 'center' },
  deleteIcon: { width: 56, height: 56, borderRadius: radius['2xl'], backgroundColor: colors.red[100], alignItems: 'center', justifyContent: 'center' },
  errorBox: { padding: 10, backgroundColor: colors.red[50], borderWidth: 1, borderColor: colors.red[200], borderRadius: radius.xl, alignSelf: 'stretch' },
  modalBtn: { flex: 1, paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.xl, alignItems: 'center' },
})

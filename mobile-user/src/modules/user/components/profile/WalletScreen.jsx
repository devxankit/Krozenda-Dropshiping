import { useRef, useState } from 'react'
import { Pressable, TextInput, View, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { Screen } from '../../../../components/layout/Screen'
import { Sheet } from '../../../../components/ui/Sheet'
import { Skeleton } from '../../../../components/ui/Skeleton'
import { Text } from '../../../../components/ui/Text'
import { Icon } from '../../../../components/ui/Icon'
import { Animated, enterFade } from '../../../../components/ui/motion'
import { USER_ROUTES } from '../../../../config/routes'
import { useWalletController } from '../../controllers/useWalletController'
import { useProfileController } from '../../controllers/useProfileController'
import { useAuthStore } from '../../../../lib/authStore'
import { toast } from '../../../../lib/toast'
import { colors, fontFamilyFor, radius, shadows } from '../../../../theme'

const QUICK_AMOUNTS = [200, 500, 1000, 2000, 5000]

// Maps transaction source to display label + icon + color
const SOURCE_META = {
  TOPUP: { label: 'Wallet Top-up', icon: 'HiCreditCard', bg: colors.blue[50], fg: colors.blue[600] },
  ORDER_PAYMENT: { label: 'Order Payment', icon: 'HiShoppingBag', bg: colors.purple[50], fg: colors.purple[600] },
  ORDER_REFUND: { label: 'Order Refund', icon: 'HiArrowPath', bg: colors.emerald[50], fg: colors.emerald[600] },
}

const STATUS_META = {
  SUCCESS: { label: 'Success', icon: 'HiCheckCircle', color: colors.emerald[600] },
  PENDING: { label: 'Pending', icon: 'HiClock', color: colors.amber[500] },
  FAILED: { label: 'Failed', icon: 'HiExclamationCircle', color: colors.red[500] },
}

// bg-gradient-to-br: top-left -> bottom-right
function GradientBg({ id, stops }) {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          {stops.map(([offset, color]) => (
            <Stop key={offset} offset={offset} stopColor={color} />
          ))}
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  )
}

// --- Add Money Modal ---------------------------------------------------------------------------

function AddMoneyModal({ open, onClose, onConfirm, isSubmitting }) {
  const [amount, setAmount] = useState('500')
  const [error, setError] = useState(null)
  const [focused, setFocused] = useState(false)
  const submittingRef = useRef(false)

  const handleConfirm = async () => {
    const value = Number(amount)
    if (!Number.isFinite(value) || value < 10) {
      setError('Please enter an amount of at least ₹10')
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={styles.walletBadge}>
            <Icon name="HiWallet" size={20} color={colors.slate[900]} />
          </View>
          <Text style={{ fontSize: 14, fontWeight: '800', color: colors.slate[900] }}>Add Money to Wallet</Text>
        </View>
        <Pressable onPress={onClose} style={{ padding: 6, borderRadius: 9999 }}>
          <Icon name="HiXMark" size={20} color={colors.slate[500]} />
        </Pressable>
      </View>

      <View style={{ padding: 20, gap: 16 }}>
        <View>
          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.slate[500], marginBottom: 6 }}>Enter Amount</Text>
          <View
            style={[
              styles.amountBox,
              { borderColor: focused ? colors.blue[500] : colors.slate[200], backgroundColor: focused ? '#fff' : colors.slate[50] },
            ]}
          >
            <Text noTranslate style={{ fontSize: 18, fontWeight: '800', color: colors.slate[400], marginRight: 6 }}>
              ₹
            </Text>
            <TextInput
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="0"
              placeholderTextColor={colors.slate[400]}
              style={{ flex: 1, fontSize: 20, fontFamily: fontFamilyFor('800'), color: colors.slate[900], paddingVertical: 0 }}
            />
          </View>
        </View>

        <View>
          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.slate[400], marginBottom: 8 }}>Quick Select</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {QUICK_AMOUNTS.map((value) => {
              const active = Number(amount) === value
              return (
                <Pressable
                  key={value}
                  onPress={() => setAmount(String(value))}
                  style={[
                    styles.quick,
                    active
                      ? { borderColor: colors.blue[500], backgroundColor: colors.blue[50] }
                      : { borderColor: colors.slate[200], backgroundColor: '#fff' },
                  ]}
                >
                  <Text noTranslate style={{ fontSize: 12, fontWeight: '700', color: active ? colors.blue[700] : colors.slate[600] }}>
                    ₹{value.toLocaleString('en-IN')}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.red[600] }}>{error}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={handleConfirm}
          disabled={isSubmitting}
          style={({ pressed }) => [
            styles.proceed,
            shadows.md,
            { backgroundColor: pressed ? colors.blue[700] : colors.blue[600], opacity: isSubmitting ? 0.6 : 1 },
          ]}
        >
          <Text noTranslate style={{ fontSize: 14, fontWeight: '700', color: '#fff', letterSpacing: 0.3 }}>
            {isSubmitting ? 'Processing…' : `Add ₹${Number(amount || 0).toLocaleString('en-IN')} →`}
          </Text>
        </Pressable>

        <Text style={{ textAlign: 'center', fontSize: 11, color: colors.slate[400] }}>
          Secured by Razorpay · UPI, Cards & Net Banking accepted
        </Text>
      </View>
    </Sheet>
  )
}

// --- Transaction item --------------------------------------------------------------------------

function TransactionItem({ tx }) {
  const isCredit = tx.type === 'CREDIT'
  const source = SOURCE_META[tx.source] || SOURCE_META.TOPUP
  const statusMeta = STATUS_META[tx.status?.toUpperCase?.()] || STATUS_META.SUCCESS

  const date = new Date(tx.createdAt)
  const dateStr = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  const timeStr = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 4 }}>
      <View style={[styles.sourceIcon, { backgroundColor: source.bg }]}>
        <Icon name={source.icon} size={20} color={source.fg} />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 12, fontWeight: '700', color: colors.slate[900] }}>
            {source.label}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Icon name={statusMeta.icon} size={12} color={statusMeta.color} />
            <Text style={{ fontSize: 10, fontWeight: '600', color: statusMeta.color }}>{statusMeta.label}</Text>
          </View>
        </View>
        <Text noTranslate style={{ fontSize: 11, color: colors.slate[400], marginTop: 2 }}>
          {dateStr} · {timeStr}
        </Text>
        <Text noTranslate style={{ fontSize: 10, color: colors.slate[400], marginTop: 2 }}>
          Balance: ₹{tx.balanceAfter.toLocaleString('en-IN')}
        </Text>
      </View>

      <View style={{ alignItems: 'flex-end' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Icon name={isCredit ? 'HiArrowDownLeft' : 'HiArrowUpRight'} size={16} color={isCredit ? colors.emerald[600] : colors.red[500]} />
          <Text noTranslate style={{ fontSize: 14, fontWeight: '800', color: isCredit ? colors.emerald[600] : colors.red[500] }}>
            ₹{tx.amount.toLocaleString('en-IN')}
          </Text>
        </View>
        <Text style={{ fontSize: 10, fontWeight: '700', color: isCredit ? colors.emerald[500] : colors.red[400] }}>
          {isCredit ? 'Credit' : 'Debit'}
        </Text>
      </View>
    </View>
  )
}

function EmptyTransactions({ onAddMoney }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 64, paddingHorizontal: 16 }}>
      <View style={styles.emptyIcon}>
        <Text noTranslate style={{ fontSize: 36 }}>
          💸
        </Text>
      </View>
      <Text style={{ fontSize: 14, fontWeight: '800', color: colors.slate[900] }}>No transactions yet</Text>
      <Text style={{ fontSize: 12, color: colors.slate[400], marginTop: 6, maxWidth: 320, textAlign: 'center' }}>
        Add money to your Krozenda Wallet to pay faster at checkout — no OTP needed!
      </Text>
      <Pressable
        onPress={onAddMoney}
        style={({ pressed }) => [styles.emptyBtn, shadows.sm, { backgroundColor: pressed ? colors.blue[700] : colors.blue[600] }]}
      >
        <Icon name="HiPlus" size={16} color="#fff" />
        <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>Add Money Now</Text>
      </Pressable>
    </View>
  )
}

// --- Main screen -------------------------------------------------------------------------------

export function WalletScreen() {
  const router = useRouter()
  const authUser = useAuthStore((state) => state.user)
  const { profile } = useProfileController()
  const { balance, transactions, isLoading, topup, isToppingUp } = useWalletController()
  const [showAddMoney, setShowAddMoney] = useState(false)

  const user = {
    name: profile?.name || authUser?.name || 'Customer',
    email: profile?.email || authUser?.email || '',
    mobile: profile?.mobileNumber || authUser?.mobileNumber || authUser?.phone || '',
  }

  const handleTopup = (amount) =>
    topup(amount, { name: user.name, email: user.email, contact: user.mobile })
      .then(() => toast.success('Money Added!', `₹${amount.toLocaleString('en-IN')} credited to your Krozenda Wallet.`))
      .catch((err) => {
        if (!/cancel/i.test(err?.message || '')) {
          toast.error('Top-up Failed', err)
        }
      })

  // Split into credits and debits for the summary stats
  const totalCredited = transactions
    .filter((tx) => tx.type === 'CREDIT' && tx.status?.toUpperCase() !== 'FAILED')
    .reduce((sum, tx) => sum + tx.amount, 0)

  const totalSpent = transactions
    .filter((tx) => tx.type === 'DEBIT' && tx.status?.toUpperCase() !== 'FAILED')
    .reduce((sum, tx) => sum + tx.amount, 0)

  const goBack = () => {
    if (router.canGoBack()) router.back()
    else router.replace(USER_ROUTES.DASHBOARD)
  }

  const header = (
    <View style={styles.topBar}>
      <Pressable onPress={goBack} accessibilityLabel="Go back" style={styles.backBtn}>
        <Icon name="HiArrowLeft" size={20} color={colors.slate[800]} />
      </Pressable>
      <Text style={{ fontSize: 16, fontWeight: '700', color: colors.slate[900] }}>My Wallet</Text>
    </View>
  )

  return (
    <Screen nav activeTab="profile" header={header}>
      <View style={{ padding: 16, gap: 16 }}>
        {/* Balance hero card */}
        <View style={[styles.hero, shadows.xl]}>
          <GradientBg id="walletHero" stops={[[0, colors.blue[900]], [0.5, colors.blue[800]], [1, colors.indigo[900]]]} />
          <View style={[styles.circle, { top: -24, right: -24, width: 128, height: 128 }]} />
          <View style={[styles.circle, { bottom: -32, left: -16, width: 160, height: 160 }]} />

          <View style={{ padding: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <View style={styles.heroBadge}>
                    <Icon name="HiWallet" size={16} color={colors.slate[900]} />
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.blue[200], textTransform: 'uppercase', letterSpacing: 1.8 }}>
                    Krozenda Wallet
                  </Text>
                </View>
                <Text noTranslate style={{ fontSize: 11, fontWeight: '500', color: colors.blue[300], marginTop: 8 }}>
                  {user.name}
                </Text>
              </View>

              <Pressable
                onPress={() => setShowAddMoney(true)}
                style={({ pressed }) => [styles.heroAdd, { backgroundColor: pressed ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.15)' }]}
              >
                <Icon name="HiPlus" size={14} color="#fff" />
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>Add Money</Text>
              </Pressable>
            </View>

            <View>
              <Text style={{ fontSize: 11, fontWeight: '500', color: colors.blue[300], marginBottom: 2 }}>Available Balance</Text>
              {isLoading ? (
                <Skeleton style={{ height: 36, width: 144, borderRadius: radius.xl, backgroundColor: 'rgba(255,255,255,0.1)' }} />
              ) : (
                <Text noTranslate style={{ fontSize: 36, lineHeight: 40, fontWeight: '800', color: '#fff', letterSpacing: -0.9 }}>
                  ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Stats row */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={[styles.stat, shadows.sm]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <View style={[styles.statIcon, { backgroundColor: colors.emerald[50] }]}>
                <Icon name="HiArrowDownLeft" size={16} color={colors.emerald[600]} />
              </View>
              <Text style={styles.statLabel}>Total Added</Text>
            </View>
            <Text noTranslate style={{ fontSize: 18, fontWeight: '800', color: colors.emerald[600] }}>
              ₹{totalCredited.toLocaleString('en-IN')}
            </Text>
          </View>

          <View style={[styles.stat, shadows.sm]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <View style={[styles.statIcon, { backgroundColor: colors.red[50] }]}>
                <Icon name="HiArrowUpRight" size={16} color={colors.red[500]} />
              </View>
              <Text style={styles.statLabel}>Total Spent</Text>
            </View>
            <Text noTranslate style={{ fontSize: 18, fontWeight: '800', color: colors.red[500] }}>
              ₹{totalSpent.toLocaleString('en-IN')}
            </Text>
          </View>
        </View>

        {/* Transaction history */}
        <View style={[styles.history, shadows.sm]}>
          <View style={styles.historyHead}>
            <Text style={{ fontSize: 12, fontWeight: '800', color: colors.slate[900], textTransform: 'uppercase', letterSpacing: 0.6 }}>
              Transaction History
            </Text>
            {transactions.length > 0 ? (
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.slate[400] }}>
                <Text noTranslate style={{ fontSize: 11, fontWeight: '700', color: colors.slate[400] }}>
                  {transactions.length}
                </Text>
                {' transactions'}
              </Text>
            ) : null}
          </View>

          {isLoading ? (
            <View style={{ paddingHorizontal: 16 }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
                    i > 0 && { borderTopWidth: 1, borderTopColor: colors.slate[100] },
                  ]}
                >
                  <Skeleton style={{ width: 40, height: 40, borderRadius: radius.xl }} />
                  <View style={{ flex: 1, gap: 8 }}>
                    <Skeleton style={{ height: 12, width: 128 }} />
                    <Skeleton style={{ height: 10, width: 96 }} />
                  </View>
                  <Skeleton style={{ height: 16, width: 64 }} />
                </View>
              ))}
            </View>
          ) : transactions.length === 0 ? (
            <EmptyTransactions onAddMoney={() => setShowAddMoney(true)} />
          ) : (
            <View style={{ paddingHorizontal: 16 }}>
              {transactions.map((tx, i) => (
                <Animated.View
                  key={tx.id}
                  entering={enterFade(i)}
                  style={i > 0 && { borderTopWidth: 1, borderTopColor: colors.slate[100] }}
                >
                  <TransactionItem tx={tx} />
                </Animated.View>
              ))}
            </View>
          )}
        </View>

        {/* How it works */}
        <View style={{ borderRadius: radius['3xl'], overflow: 'hidden' }}>
          <GradientBg id="walletHow" stops={[[0, colors.slate[800]], [1, colors.slate[900]]]} />
          <View style={{ padding: 20 }}>
            <Text style={{ fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, color: colors.slate[300], marginBottom: 12 }}>
              How Krozenda Wallet Works
            </Text>
            <View style={{ gap: 10 }}>
              {[
                { emoji: '⚡', text: 'Pay instantly at checkout — no OTP, no redirects' },
                { emoji: '🔄', text: 'Refunds are credited to your wallet automatically' },
                { emoji: '🔒', text: 'Your money is safe — protected by Razorpay' },
              ].map((item) => (
                <View key={item.text} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                  <Text noTranslate style={{ fontSize: 16, lineHeight: 24 }}>
                    {item.emoji}
                  </Text>
                  <Text style={{ flex: 1, fontSize: 12, lineHeight: 19.5, color: colors.slate[300] }}>{item.text}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>

      <AddMoneyModal open={showAddMoney} onClose={() => setShowAddMoney(false)} onConfirm={handleTopup} isSubmitting={isToppingUp} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[200],
    ...shadows.sm,
  },
  backBtn: { height: 36, width: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg },
  modalHead: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  walletBadge: { width: 36, height: 36, borderRadius: radius.xl, backgroundColor: colors.amber[400], alignItems: 'center', justifyContent: 'center' },
  amountBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderRadius: radius['2xl'], paddingHorizontal: 16, paddingVertical: 12 },
  quick: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.xl, borderWidth: 1 },
  errorBox: { backgroundColor: colors.red[50], borderWidth: 1, borderColor: colors.red[200], borderRadius: radius.xl, paddingHorizontal: 12, paddingVertical: 8 },
  proceed: { width: '100%', paddingVertical: 14, borderRadius: radius['2xl'], alignItems: 'center' },
  sourceIcon: { width: 40, height: 40, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { width: 80, height: 80, borderRadius: radius['3xl'], backgroundColor: colors.slate[100], alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyBtn: { marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 10, borderRadius: radius['2xl'] },
  hero: { borderRadius: radius['3xl'], overflow: 'hidden' },
  circle: { position: 'absolute', borderRadius: 9999, backgroundColor: 'rgba(255,255,255,0.05)' },
  heroBadge: { width: 32, height: 32, borderRadius: radius.xl, backgroundColor: colors.amber[400], alignItems: 'center', justifyContent: 'center' },
  heroAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  stat: { flex: 1, backgroundColor: '#fff', borderRadius: radius['2xl'], borderWidth: 1, borderColor: 'rgba(226,232,240,0.8)', padding: 16 },
  statIcon: { width: 28, height: 28, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  statLabel: { fontSize: 11, fontWeight: '700', color: colors.slate[400], textTransform: 'uppercase', letterSpacing: 0.3 },
  history: { backgroundColor: '#fff', borderRadius: radius['2xl'], borderWidth: 1, borderColor: 'rgba(226,232,240,0.8)', overflow: 'hidden' },
  historyHead: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
})

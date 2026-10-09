import { useState } from 'react'
import { View, Pressable, ActivityIndicator, StyleSheet } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Screen } from '../../../../components/layout/Screen'
import { Text } from '../../../../components/ui/Text'
import { Icon } from '../../../../components/ui/Icon'
import { Skeleton } from '../../../../components/ui/Skeleton'
import { USER_ROUTES, userPath } from '../../../../config/routes'
import { toast } from '../../../../lib/toast'
import { colors, shadows } from '../../../../theme'
import { useOrderInvoiceController } from '../../controllers/useOrdersController'
import { OrderInvoices, printInvoice, shareInvoicePdf } from './TaxInvoiceDocument'

export function InvoicePreviewScreen() {
  const router = useRouter()
  const { orderId } = useLocalSearchParams()
  const { invoice, isLoading, isError } = useOrderInvoiceController(orderId)
  const [busy, setBusy] = useState(false)

  const onBack = () => (router.canGoBack() ? router.back() : router.replace(USER_ROUTES.DASHBOARD))

  if (isLoading) {
    return (
      <Screen contentStyle={{ padding: 16, gap: 12 }}>
        <Skeleton style={{ height: 24, width: '50%' }} />
        <Skeleton style={{ height: 14, width: '35%' }} />
        <Skeleton style={{ height: 180, width: '100%', borderRadius: 16 }} />
        <Skeleton style={{ height: 120, width: '100%', borderRadius: 16 }} />
      </Screen>
    )
  }

  if (isError || !invoice) {
    return (
      <Screen contentStyle={[styles.center, { paddingHorizontal: 24, gap: 16 }]}>
        <Text style={styles.unavailable}>Invoice unavailable</Text>
        <Pressable onPress={onBack} style={styles.backCta}>
          <Text style={styles.backCtaText}>Back</Text>
        </Pressable>
      </Screen>
    )
  }

  const handlePrint = async () => {
    try {
      await printInvoice(invoice)
    } catch (err) {
      toast.error('Could not print the invoice', err)
    }
  }

  // Web: window.print() then opens the order. Native: render a PDF, open the share sheet, then
  // show the order.
  const handleDownload = async () => {
    if (busy) return
    setBusy(true)
    try {
      await shareInvoicePdf(invoice)
      router.push(userPath.order(orderId))
    } catch (err) {
      toast.error('Could not create the invoice PDF', err)
    } finally {
      setBusy(false)
    }
  }

  const header = (
    <View style={styles.headerBar}>
      <View style={styles.headerLeft}>
        <Pressable onPress={onBack} style={styles.iconBtn} accessibilityLabel="Back">
          <Icon name="HiArrowLeft" size={20} color={colors.slate[700]} />
        </Pressable>
        <Text style={styles.headerTitle}>Invoice Preview</Text>
      </View>
      <Pressable onPress={handlePrint} style={styles.iconBtn} accessibilityLabel="Print">
        <Icon name="HiPrinter" size={20} color={colors.slate[700]} />
      </Pressable>
    </View>
  )

  const footer = (
    <View style={styles.footerBar}>
      <Pressable
        onPress={handleDownload}
        disabled={busy}
        style={({ pressed }) => [styles.cta, { backgroundColor: pressed ? colors.blue[700] : colors.blue[600], opacity: busy ? 0.7 : 1 }]}
      >
        {busy ? <ActivityIndicator size="small" color="#fff" /> : <Icon name="HiArrowDownTray" size={16} color="#fff" />}
        <Text style={styles.ctaText}>Download PDF Invoice</Text>
      </Pressable>
    </View>
  )

  return (
    <Screen header={header} footer={footer} contentStyle={{ padding: 16, gap: 16 }}>
      <OrderInvoices data={invoice} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  loading: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[400] },
  unavailable: { fontSize: 16, lineHeight: 24, fontWeight: '700', color: colors.slate[900] },
  backCta: { backgroundColor: colors.blue[600], paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  backCtaText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: '#fff' },
  headerBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[200],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shadows.xs,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBtn: { padding: 6, borderRadius: 9999 },
  headerTitle: { fontSize: 16, lineHeight: 24, fontWeight: '700', color: colors.slate[900] },
  footerBar: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: colors.slate[200],
    padding: 12,
    ...shadows.lg,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    ...shadows.md,
  },
  ctaText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: '#fff', letterSpacing: 0.3 },
})

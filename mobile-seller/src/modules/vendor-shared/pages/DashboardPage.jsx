import { StyleSheet, Text as RNText, View } from 'react-native'
import { Skeleton } from '../../../components/ui'
import { PageBody } from '../../../components/admin/shell'
import { colors, fonts } from '../../../theme'
import { useVendorAnalyticsController, useVendorDashboardController, useVendorOrdersController } from '../controllers/useVendorController'
import { MobileSellerDashboard } from '../components/dashboard/MobileSellerDashboard'

// At phone width the web renders only <MobileSellerDashboard> (the desktop dashboard is `hidden lg:block`).
export function VendorDashboardPage() {
  const { data: summary, isLoading, isError, error } = useVendorDashboardController()
  const { data: analytics, isLoading: isAnalyticsLoading } = useVendorAnalyticsController()
  const orders = useVendorOrdersController()

  if (isLoading || isAnalyticsLoading) {
    return (
      <PageBody>
        <Skeleton style={{ height: 160, width: '100%' }} />
      </PageBody>
    )
  }

  if (isError) {
    return (
      <PageBody>
        <View style={styles.error}>
          <RNText style={styles.errorText}>{error?.message || 'Failed to load vendor dashboard'}</RNText>
        </View>
      </PageBody>
    )
  }

  return <MobileSellerDashboard summary={summary} analytics={analytics} orders={orders} />
}

const styles = StyleSheet.create({
  error: { padding: 16, borderRadius: 12, backgroundColor: colors.danger[50] },
  errorText: { fontSize: 12, lineHeight: 16, fontWeight: '600', fontFamily: fonts[600], color: colors.danger[700] },
})

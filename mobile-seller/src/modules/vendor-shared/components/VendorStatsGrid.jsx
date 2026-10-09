import { StyleSheet, View } from 'react-native'
import { Text } from '../../../components/ui'
import { formatIndian } from '../../../lib/format'
import { colors, radius } from '../../../theme'

// Presentational: takes already-fetched data as props. (Not rendered by any seller screen on the
// web either; ported for parity.)
export function VendorStatsGrid({ summary }) {
  const stats = [
    { label: 'Total Orders', value: summary.totalOrders },
    { label: 'Pending Orders', value: summary.pendingOrders },
    { label: 'Total Revenue', value: `₹${formatIndian(summary.totalRevenue)}` },
    { label: 'Pending Settlement', value: `₹${formatIndian(summary.pendingSettlement)}` },
  ]

  return (
    <View style={{ gap: 16 }}>
      {stats.map((stat) => (
        <View key={stat.label} style={styles.card}>
          <Text style={styles.label}>{stat.label}</Text>
          <Text noTranslate style={styles.value}>
            {stat.value}
          </Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border.DEFAULT, backgroundColor: colors.surface.DEFAULT, padding: 16 },
  label: { fontSize: 14, lineHeight: 20, color: colors.slate[500] },
  value: { marginTop: 4, fontSize: 24, lineHeight: 32, fontWeight: '600', color: colors.slate[900] },
})

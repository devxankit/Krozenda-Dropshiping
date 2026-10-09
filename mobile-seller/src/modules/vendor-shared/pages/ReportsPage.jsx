import { useState } from 'react'
import { Platform, Pressable, StyleSheet, View } from 'react-native'
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import { Button, Text } from '../../../components/ui'
import { PageBody, PageHeader } from '../../../components/admin/shell'
import { StatTile } from '../../../components/admin/StatTile'
import { SectionCard } from '../../../components/admin/display'
import { MoneyCell } from '../../../components/admin/display/cells'
import { downloadCsv, rupees } from '../../../lib/exportCsv'
import { formatIndian } from '../../../lib/format'
import { toast } from '../../../lib/toast'
import { colors, sp } from '../../../theme'
import { useVendorReportsController } from '../controllers/useVendorController'

const rupeesText = (paise) => `₹${formatIndian(paise / 100)}`

function toInputDate(date) {
  return date.toISOString().slice(0, 10)
}

function defaultRange() {
  const to = new Date()
  const from = new Date(to)
  from.setDate(from.getDate() - 30)
  return { from: toInputDate(from), to: toInputDate(to) }
}

// 'YYYY-MM-DD' <-> Date at local noon (avoids day shifts from time zones)
function parseInputDate(value) {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

function formatLocalDate(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// Native counterpart of <input type="date" min max>.
function DateField({ value, onChange, min, max }) {
  const date = parseInputDate(value)
  const minimumDate = min ? parseInputDate(min) : undefined
  const maximumDate = max ? parseInputDate(max) : undefined
  const apply = (_event, picked) => {
    if (picked) onChange(formatLocalDate(picked))
  }

  if (Platform.OS === 'ios') {
    return (
      <View style={styles.dateBox}>
        <DateTimePicker
          value={date}
          mode="date"
          display="compact"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={apply}
          style={{ alignSelf: 'flex-start' }}
        />
      </View>
    )
  }

  return (
    <Pressable
      onPress={() =>
        DateTimePickerAndroid.open({ value: date, mode: 'date', minimumDate, maximumDate, onChange: apply })
      }
      style={styles.dateBox}
    >
      <Text noTranslate style={styles.dateText}>
        {value}
      </Text>
    </Pressable>
  )
}

export function ReportsPage() {
  const [range, setRange] = useState(defaultRange)
  const [exporting, setExporting] = useState(false)
  const { data, isLoading } = useVendorReportsController(range)

  const handleExport = async () => {
    if (!data || exporting) return
    setExporting(true)
    try {
      await downloadCsv(`sales-report-${range.from}-to-${range.to}.csv`, [
        {
          title: 'Daily sales',
          columns: [
            { header: 'Date', value: (row) => row.date },
            { header: 'Orders', value: (row) => row.orders },
            { header: 'Units', value: (row) => row.units },
            { header: 'Revenue (INR)', value: (row) => rupees(row.revenue) },
          ],
          rows: data.dailySales,
        },
        {
          title: 'Product performance',
          columns: [
            { header: 'Product', value: (row) => row.name },
            { header: 'Units sold', value: (row) => row.unitsSold },
            { header: 'Revenue (INR)', value: (row) => rupees(row.revenue) },
          ],
          rows: data.productPerformance,
        },
      ])
    } catch {
      toast.error('Could not export the report')
    } finally {
      setExporting(false)
    }
  }

  return (
    <PageBody>
      <PageHeader
        title="Reports"
        description="Sales, orders and product performance for a date range you pick."
        actions={
          <View style={styles.controls}>
            <DateField value={range.from} max={range.to} onChange={(from) => setRange((r) => ({ ...r, from }))} />
            <DateField
              value={range.to}
              min={range.from}
              max={toInputDate(new Date())}
              onChange={(to) => setRange((r) => ({ ...r, to }))}
            />
            <Button
              variant="secondary"
              size="control"
              icon="download"
              onPress={handleExport}
              disabled={!data}
              isLoading={exporting}
              style={{ width: '100%' }}
            >
              Export CSV
            </Button>
          </View>
        }
      />

      {isLoading || !data ? (
        <Text style={styles.muted}>Loading report…</Text>
      ) : (
        <>
          <View style={styles.tiles}>
            <StatTile label="Revenue" value={rupeesText(data.totals.revenue)} tone="brand" />
            <StatTile label="Orders" value={data.totals.orders} />
            <StatTile label="Units sold" value={data.totals.units} />
            <StatTile label="Avg. order value" value={rupeesText(data.totals.avgOrderValue)} />
          </View>

          <SectionCard title="Daily sales" description={`${range.from} to ${range.to}`}>
            <View>
              {data.dailySales.length === 0 ? <Text style={styles.empty}>No sales in this period.</Text> : null}
              {data.dailySales.map((d, idx) => (
                <View key={d.date} style={[styles.row, idx > 0 && styles.divider]}>
                  <Text noTranslate style={styles.rowName}>
                    {d.date}
                  </Text>
                  <View style={styles.rowRight}>
                    <Text noTranslate style={styles.muted}>
                      {d.orders} orders
                    </Text>
                    <Text noTranslate style={styles.muted}>
                      {d.units} units
                    </Text>
                    <MoneyCell amount={d.revenue} compact style={styles.money} />
                  </View>
                </View>
              ))}
            </View>
          </SectionCard>

          <SectionCard title="Product performance" description="Top 20 by revenue in this period">
            <View>
              {data.productPerformance.length === 0 ? (
                <Text style={styles.empty}>No product sales in this period.</Text>
              ) : null}
              {data.productPerformance.map((p, idx) => (
                <View key={p.productId || p.name} style={[styles.row, idx > 0 && styles.divider]}>
                  <Text noTranslate style={[styles.rowName, { flex: 1 }]}>
                    {idx + 1}. {p.name}
                  </Text>
                  <View style={styles.rowRight}>
                    <Text noTranslate style={styles.muted}>
                      {p.unitsSold} sold
                    </Text>
                    <MoneyCell amount={p.revenue} compact style={styles.money} />
                  </View>
                </View>
              ))}
            </View>
          </SectionCard>

          <SectionCard title="Order status mix" description="Across order lines in this period">
            <View style={styles.mix}>
              {Object.entries(data.orderStatusBreakdown).map(([status, count]) => (
                <View key={status} style={styles.mixCell}>
                  <View style={styles.mixBox}>
                    <Text noTranslate style={styles.mixCount}>
                      {count}
                    </Text>
                    <Text noTranslate style={styles.mixLabel}>
                      {status}
                    </Text>
                  </View>
                </View>
              ))}
              {Object.keys(data.orderStatusBreakdown).length === 0 ? (
                <Text style={[styles.muted, { width: '100%', padding: sp(1.5) }]}>No orders in this period.</Text>
              ) : null}
            </View>
          </SectionCard>
        </>
      )}
    </PageBody>
  )
}

const styles = StyleSheet.create({
  muted: { fontSize: 12, lineHeight: 16, color: colors.ink.subtle },
  controls: { width: '100%', gap: sp(2) },
  dateBox: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    paddingHorizontal: sp(2),
    paddingVertical: 6,
    backgroundColor: colors.surface.DEFAULT,
    justifyContent: 'center',
  },
  dateText: { fontSize: 12, lineHeight: 16, color: colors.slate[900] },
  tiles: { gap: sp(3) },
  empty: { padding: sp(4), fontSize: 12, lineHeight: 16, color: colors.ink.subtle },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: sp(3), paddingHorizontal: sp(4), paddingVertical: sp(3) },
  divider: { borderTopWidth: 1, borderTopColor: colors.border.DEFAULT },
  rowName: { minWidth: 0, fontSize: 12, lineHeight: 16, fontWeight: '500', color: colors.slate[900] },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: sp(4), flexShrink: 0 },
  money: { fontSize: 12, lineHeight: 16 },
  mix: { flexDirection: 'row', flexWrap: 'wrap', padding: sp(2) },
  mixCell: { width: '50%', padding: sp(1.5) },
  mixBox: { borderRadius: 12, borderWidth: 1, borderColor: colors.border.DEFAULT, padding: sp(3), alignItems: 'center' },
  mixCount: { fontSize: 18, lineHeight: 28, fontWeight: '700', color: colors.slate[900] },
  mixLabel: { fontSize: 11, lineHeight: 16, color: colors.ink.subtle },
})

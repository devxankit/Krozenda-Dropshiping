import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Tabs, Text } from '../../../components/ui'
import { PageBody, PageHeader } from '../../../components/admin/shell'
import { DataTable } from '../../../components/admin/data/DataTable'
import { MoneyCell } from '../../../components/admin/display/cells'
import { colors, radius, shadows, sp } from '../../../theme'
import { useVendorEarningsController } from '../controllers/useVendorController'
import { EARNING_COLUMNS, PAYOUT_COLUMNS } from '../tableColumns/financeColumns'

function Tile({ label, value, caption, tone }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{String(label).toUpperCase()}</Text>
      <View style={{ marginTop: 4 }}>
        <MoneyCell amount={value} style={[styles.tileValue, tone ? { color: tone } : null]} />
      </View>
      {caption ? (
        <Text numberOfLines={1} style={styles.tileCaption}>
          {caption}
        </Text>
      ) : null}
    </View>
  )
}

export function EarningsPage() {
  const { summary, entries, payouts, isLoading, isLoadingPayouts } = useVendorEarningsController()
  const [tab, setTab] = useState('earnings')

  return (
    <PageBody>
      <PageHeader
        title="Earnings & Settlements"
        description="Your sales, commission and what has actually been paid out — read from the same ledger the platform settles from."
      />

      {summary ? (
        <View style={styles.grid}>
          <View style={styles.cell}>
            <Tile label="Net earnings" value={summary.netEarnings} caption={`on ${summary.deliveredOrdersCount} delivered items`} />
          </View>
          <View style={styles.cell}>
            <Tile
              label="Paid out"
              value={summary.paidAmount}
              tone={colors.success[600]}
              caption={`${summary.completedPayoutsCount} completed ${summary.completedPayoutsCount === 1 ? 'payout' : 'payouts'}`}
            />
          </View>
          <View style={styles.cell}>
            <Tile label="In settlement" value={summary.inBatchAmount} tone={colors.brand[600]} caption="Batched, transfer not sent yet" />
          </View>
          <View style={styles.cell}>
            <Tile label="Awaiting settlement" value={summary.unsettledAmount} tone={colors.warning[600]} caption="Delivered, not yet batched" />
          </View>
        </View>
      ) : null}

      {summary ? (
        <View style={styles.note}>
          <Text style={styles.noteText}>
            Commission rate:{' '}
            <Text noTranslate style={[styles.noteText, { fontWeight: '600', color: colors.slate[800] }]}>
              {summary.commissionRateType === 'FIXED'
                ? `₹${summary.commissionRateValue} per unit`
                : `${summary.commissionRatePercent}%`}
            </Text>
            . Lines marked “estimate” are cash-on-delivery orders awaiting courier remittance.
          </Text>
        </View>
      ) : null}

      <Tabs
        items={[
          { id: 'earnings', label: 'Earnings', count: entries.length },
          { id: 'payouts', label: 'Payouts', count: payouts.length },
        ]}
        activeId={tab}
        onChange={setTab}
      />

      <View style={{ marginTop: sp(1.5) }}>
        {tab === 'earnings' ? (
          <DataTable
            columns={EARNING_COLUMNS}
            data={entries}
            getRowKey={(row) => row.id}
            isLoading={isLoading}
            emptyTitle="No earnings yet"
            emptyDescription="Earnings from delivered orders will show up here."
          />
        ) : (
          <DataTable
            columns={PAYOUT_COLUMNS}
            data={payouts}
            getRowKey={(row) => row.id}
            isLoading={isLoadingPayouts}
            emptyTitle="No payouts yet"
            emptyDescription="Once a settlement batch is approved and paid, the transfer shows up here with its UTR."
          />
        )}
      </View>
    </PageBody>
  )
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: sp(2), marginBottom: 12 },
  cell: { width: '48.5%', flexGrow: 1, minWidth: 0 },
  tile: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.8)',
    backgroundColor: colors.surface.DEFAULT,
    padding: 12,
    ...shadows['2xs'],
  },
  tileLabel: { fontSize: 10, lineHeight: 16, fontWeight: '600', letterSpacing: 1, color: colors.ink.subtle },
  tileValue: { fontSize: 16, lineHeight: 24, fontWeight: '700', letterSpacing: -0.4 },
  tileCaption: { marginTop: 2, fontSize: 10, lineHeight: 16, color: colors.ink.subtle },
  note: {
    marginBottom: 12,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.7)',
    backgroundColor: 'rgba(248,250,252,0.7)',
    padding: 10,
  },
  noteText: { fontSize: 11, lineHeight: 18, color: colors.ink.subtle },
})

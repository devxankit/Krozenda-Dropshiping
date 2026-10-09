import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Badge, Button, Input, Select, Text } from '../../../../components/ui'
import { Drawer } from '../../../../components/admin/overlay'
import { InlineAlert } from '../../../../components/admin/feedback'
import { useCreateShipmentController, usePickupLocationsController } from '../../controllers/useShippingController'
import { formatWeightKg } from '../../../../lib/shipping/presentation'
import { toast } from '../../../../lib/toast'
import { colors, radius } from '../../../../theme'

// "Verify Package" - Decision B, as a screen.
//
// The backend suggests dimensions from the product, then the seller's default,
// then the platform's. Whatever the seller confirms here is SNAPSHOTTED onto
// the shipment. The volumetric and chargeable figures shown here are a
// PREVIEW; the backend recomputes both from the dimensions it receives.

export function CreateShipmentDrawer({ orderId, isOpen, onClose, onCreated }) {
  const controller = useCreateShipmentController(orderId)
  const pickups = usePickupLocationsController()
  const [pickupLocationId, setPickupLocationId] = useState('')
  const [loadedFor, setLoadedFor] = useState(null)
  const [failure, setFailure] = useState('')

  // Fetch the suggestion once per order, when the drawer actually opens - it
  // reads product dimensions, and there is no reason to do that for an order
  // the seller never opens.
  if (isOpen && orderId && loadedFor !== orderId) {
    setLoadedFor(orderId)
    setFailure('')
    controller.loadSuggestion().catch(() => {})
    const preferred = pickups.registered.find((l) => l.isDefault) || pickups.registered[0]
    setPickupLocationId(preferred?.id || '')
  }

  const close = () => {
    setLoadedFor(null)
    onClose()
  }

  const pkg = controller.confirmedPackage
  const canSubmit = Boolean(pkg && pickupLocationId && !controller.isCreating)

  const submit = async () => {
    setFailure('')
    try {
      const created = await controller.createShipment({
        pickupLocationId,
        package: {
          lengthCm: Number(pkg.lengthCm),
          breadthCm: Number(pkg.breadthCm),
          heightCm: Number(pkg.heightCm),
          actualWeightKg: Number(pkg.actualWeightKg),
        },
      })
      toast.success('Shipment created successfully')
      onCreated?.(created)
      close()
    } catch (error) {
      toast.error('Could not create shipment', error)
      setFailure(error?.message || 'The shipment could not be created.')
    }
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={close}
      title="Create shipment"
      description="Confirm the package, then we book it with the courier."
      width="lg"
      footer={
        <>
          <Button variant="quiet" size="control" onPress={close} disabled={controller.isCreating}>
            Cancel
          </Button>
          <Button size="control" onPress={submit} isLoading={controller.isCreating} disabled={!canSubmit}>
            Create shipment
          </Button>
        </>
      }
    >
      <View style={styles.body}>
        {!pickups.hasRegistered ? (
          <InlineAlert tone="danger" title="No registered pickup address">
            A parcel needs an address the courier has accepted. Add and register one under Shipping settings first.
          </InlineAlert>
        ) : null}

        <PickupPicker pickups={pickups} value={pickupLocationId} onChange={setPickupLocationId} />

        {controller.isSuggesting ? (
          <Text style={styles.muted}>Working out the package size…</Text>
        ) : controller.suggestionError ? (
          <InlineAlert tone="danger" title="Could not work out the package">
            {controller.suggestionError?.message || 'Enter the dimensions manually below.'}
          </InlineAlert>
        ) : pkg ? (
          <PackageForm controller={controller} />
        ) : null}

        {controller.suggestion ? <ContentsSummary suggestion={controller.suggestion} /> : null}

        {failure ? (
          <InlineAlert tone="danger" title="Could not create the shipment">
            {failure}
          </InlineAlert>
        ) : null}
      </View>
    </Drawer>
  )
}

function PickupPicker({ pickups, value, onChange }) {
  const unregistered = pickups.items.filter((l) => l.registrationStatus !== 'REGISTERED')

  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.sectionTitle}>Collect from</Text>
      <Select
        size="control"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={!pickups.hasRegistered}
        placeholder="Select a pickup address…"
        // Only registered addresses are offered: an unregistered one is
        // refused at the carrier.
        options={pickups.registered.map((location) => ({
          value: location.id,
          label: `${location.nickname} — ${location.city} ${location.pincode}${location.isDefault ? ' (default)' : ''}`,
        }))}
      />
      {unregistered.length > 0 ? (
        <Text style={styles.faint}>
          {`${unregistered.length} address${unregistered.length === 1 ? '' : 'es'} not shown — not yet registered with the courier.`}
        </Text>
      ) : null}
    </View>
  )
}

function PackageForm({ controller }) {
  const { confirmedPackage: pkg, updatePackageField, preview, isEstimate } = controller

  return (
    <View style={{ gap: 12 }}>
      <View style={styles.rowBetween}>
        <Text style={styles.sectionTitle}>Package</Text>
        <Badge tone={isEstimate ? 'warning' : 'success'} size="sm">
          {isEstimate ? 'Estimated' : 'From product data'}
        </Badge>
      </View>

      {isEstimate ? (
        <InlineAlert tone="warning" title="Check these numbers">
          Some of your products have no saved dimensions, so these are defaults. The courier bills on what it measures —
          if these are wrong, you are charged the difference.
        </InlineAlert>
      ) : null}

      <View style={styles.grid}>
        <NumberField label="Length (cm)" value={pkg.lengthCm} onChange={(v) => updatePackageField('lengthCm', v)} />
        <NumberField label="Breadth (cm)" value={pkg.breadthCm} onChange={(v) => updatePackageField('breadthCm', v)} />
      </View>
      <View style={styles.grid}>
        <NumberField label="Height (cm)" value={pkg.heightCm} onChange={(v) => updatePackageField('heightCm', v)} />
        <NumberField label="Weight (kg)" value={pkg.actualWeightKg} onChange={(v) => updatePackageField('actualWeightKg', v)} />
      </View>

      {preview ? (
        <View style={styles.previewBox}>
          <View style={styles.rowBetween}>
            <Text style={styles.previewLabel}>Volumetric weight</Text>
            <Text noTranslate style={styles.previewValue}>
              {formatWeightKg(preview.volumetricWeightKg)}
            </Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={[styles.previewLabel, { fontWeight: '500', color: colors.slate[900] }]}>You are billed for</Text>
            <Text noTranslate style={[styles.previewValue, { fontWeight: '600' }]}>
              {formatWeightKg(preview.chargeableWeightKg)}
            </Text>
          </View>
          <Text style={[styles.faint, { marginTop: 4 }]}>
            {`Couriers charge on whichever is higher — the real weight or (L × B × H) ÷ ${preview.divisor}.`}
          </Text>
        </View>
      ) : null}
    </View>
  )
}

function ContentsSummary({ suggestion }) {
  const missing = suggestion.items.filter((item) => !item.hasDimensions)
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.sectionTitle}>{`In this parcel (${suggestion.items.length})`}</Text>
      <View>
        {suggestion.items.map((item, index) => (
          <View
            key={item.productId}
            style={[styles.itemRow, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border.DEFAULT }]}
          >
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 12, lineHeight: 16, color: colors.slate[900] }}>
              {item.name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <Text noTranslate style={{ fontSize: 12, lineHeight: 16, color: colors.ink.subtle }}>
                × {item.quantity}
              </Text>
              {!item.hasDimensions ? (
                <Badge tone="warning" size="sm">
                  no size saved
                </Badge>
              ) : null}
            </View>
          </View>
        ))}
      </View>
      {missing.length > 0 ? (
        <Text style={styles.faint}>
          {`Saving dimensions on ${missing.length === 1 ? 'this product' : 'these products'} makes future parcels accurate without this step.`}
        </Text>
      ) : null}
    </View>
  )
}

function NumberField({ label, value, onChange }) {
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Input label={label} type="number" inputMode="decimal" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
    </View>
  )
}

const styles = StyleSheet.create({
  body: { gap: 20, padding: 20 },
  sectionTitle: { fontSize: 12, lineHeight: 16, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3, color: colors.ink.faint },
  muted: { fontSize: 12, lineHeight: 16, color: colors.ink.subtle },
  faint: { fontSize: 11, lineHeight: 16, color: colors.ink.faint },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  grid: { flexDirection: 'row', gap: 12 },
  previewBox: { gap: 4, borderRadius: radius.lg, backgroundColor: colors.surface.muted, padding: 12 },
  previewLabel: { fontSize: 12, lineHeight: 16, color: colors.ink.subtle },
  previewValue: { fontSize: 12, lineHeight: 16, color: colors.slate[900], fontVariant: ['tabular-nums'] },
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 8 },
})

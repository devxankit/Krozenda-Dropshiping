import { useState } from 'react'
import { Badge, Button, Input, Select } from '../../../../components/ui'
import { Drawer } from '../../../admin/components/overlay/Drawer'
import { InlineAlert } from '../../../admin/components/feedback'
import { useCreateShipmentController, usePickupLocationsController } from '../../controllers/useShippingController'
import { formatWeightKg } from '../../../../lib/shipping/presentation'
import { toast } from '../../../../lib/toast'

// "Verify Package" — Decision B, as a screen.
//
// The backend suggests dimensions from the product, then the seller's default,
// then the platform's. Whatever the seller confirms here is SNAPSHOTTED onto
// the shipment, so editing the product tomorrow cannot change what this parcel
// was billed at. That is why this step exists at all rather than shipping the
// suggestion silently: the carrier bills on these numbers, and a wrong weight
// is a real charge on a real invoice.
//
// The volumetric and chargeable figures shown here are a PREVIEW. The backend
// recomputes both from the dimensions it receives and ignores anything the
// client claims, so a tampered preview cannot produce a cheaper parcel.

export function CreateShipmentDrawer({ orderId, isOpen, onClose, onCreated }) {
  const controller = useCreateShipmentController(orderId)
  const pickups = usePickupLocationsController()
  const [pickupLocationId, setPickupLocationId] = useState('')
  const [loadedFor, setLoadedFor] = useState(null)
  const [failure, setFailure] = useState('')

  // Fetch the suggestion once per order, when the drawer actually opens — it
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
        <div className="flex items-center justify-end gap-2">
          <Button variant="quiet" size="control" onClick={close} disabled={controller.isCreating}>
            Cancel
          </Button>
          <Button size="control" onClick={submit} isLoading={controller.isCreating} disabled={!canSubmit}>
            Create shipment
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {!pickups.hasRegistered && (
          <InlineAlert tone="danger" title="No registered pickup address">
            A parcel needs an address the courier has accepted. Add and register one under Shipping settings first.
          </InlineAlert>
        )}

        <PickupPicker
          pickups={pickups}
          value={pickupLocationId}
          onChange={setPickupLocationId}
        />

        {controller.isSuggesting ? (
          <p className="text-xs text-ink-subtle">Working out the package size…</p>
        ) : controller.suggestionError ? (
          <InlineAlert tone="danger" title="Could not work out the package">
            {controller.suggestionError?.message || 'Enter the dimensions manually below.'}
          </InlineAlert>
        ) : (
          pkg && <PackageForm controller={controller} />
        )}

        {controller.suggestion && <ContentsSummary suggestion={controller.suggestion} />}

        {failure && (
          <InlineAlert tone="danger" title="Could not create the shipment">
            {failure}
          </InlineAlert>
        )}
      </div>
    </Drawer>
  )
}

function PickupPicker({ pickups, value, onChange }) {
  const unregistered = pickups.items.filter((l) => l.registrationStatus !== 'REGISTERED')

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Collect from</h3>
      <Select
        size="control"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={!pickups.hasRegistered}
        placeholder="Select a pickup address…"
        // Only registered addresses are offered: an unregistered one is
        // refused at the carrier, and offering it just moves the failure
        // later, after the seller has filled in the whole form.
        options={pickups.registered.map((location) => ({
          value: location.id,
          label: `${location.nickname} — ${location.city} ${location.pincode}${location.isDefault ? ' (default)' : ''}`,
        }))}
      />
      {unregistered.length > 0 && (
        <p className="text-2xs text-ink-faint">
          {unregistered.length} address{unregistered.length === 1 ? '' : 'es'} not shown — not yet registered with the
          courier.
        </p>
      )}
    </section>
  )
}

function PackageForm({ controller }) {
  const { confirmedPackage: pkg, updatePackageField, preview, isEstimate } = controller

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Package</h3>
        <Badge tone={isEstimate ? 'warning' : 'success'} size="sm">
          {isEstimate ? 'Estimated' : 'From product data'}
        </Badge>
      </div>

      {isEstimate && (
        <InlineAlert tone="warning" title="Check these numbers">
          Some of your products have no saved dimensions, so these are defaults. The courier bills on what it measures —
          if these are wrong, you are charged the difference.
        </InlineAlert>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <NumberField label="Length (cm)" value={pkg.lengthCm} onChange={(v) => updatePackageField('lengthCm', v)} />
        <NumberField label="Breadth (cm)" value={pkg.breadthCm} onChange={(v) => updatePackageField('breadthCm', v)} />
        <NumberField label="Height (cm)" value={pkg.heightCm} onChange={(v) => updatePackageField('heightCm', v)} />
        <NumberField
          label="Weight (kg)"
          value={pkg.actualWeightKg}
          step="0.01"
          onChange={(v) => updatePackageField('actualWeightKg', v)}
        />
      </div>

      {preview && (
        <div className="flex flex-col gap-1 rounded-lg bg-surface-muted p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-ink-subtle">Volumetric weight</span>
            <span className="tabular text-slate-900">{formatWeightKg(preview.volumetricWeightKg)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-900">You are billed for</span>
            <span className="tabular font-semibold text-slate-900">{formatWeightKg(preview.chargeableWeightKg)}</span>
          </div>
          <p className="mt-1 text-2xs text-ink-faint">
            Couriers charge on whichever is higher — the real weight or (L × B × H) ÷ {preview.divisor}.
          </p>
        </div>
      )}
    </section>
  )
}

function ContentsSummary({ suggestion }) {
  const missing = suggestion.items.filter((item) => !item.hasDimensions)
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
        In this parcel ({suggestion.items.length})
      </h3>
      <ul className="flex flex-col divide-y divide-border">
        {suggestion.items.map((item) => (
          <li key={item.productId} className="flex items-center justify-between gap-3 py-2 text-xs">
            <span className="min-w-0 truncate text-slate-900">{item.name}</span>
            <span className="flex shrink-0 items-center gap-2 text-ink-subtle">
              × {item.quantity}
              {!item.hasDimensions && (
                <Badge tone="warning" size="sm">
                  no size saved
                </Badge>
              )}
            </span>
          </li>
        ))}
      </ul>
      {missing.length > 0 && (
        <p className="text-2xs text-ink-faint">
          Saving dimensions on {missing.length === 1 ? 'this product' : 'these products'} makes future parcels accurate
          without this step.
        </p>
      )}
    </section>
  )
}

function NumberField({ label, value, onChange, step = '0.1' }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-2xs font-medium text-slate-700">{label}</span>
      <Input
        type="number"
        min="0"
        step={step}
        inputMode="decimal"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}

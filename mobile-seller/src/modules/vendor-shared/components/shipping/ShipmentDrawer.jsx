import { useState } from 'react'
import { Linking, ScrollView, StyleSheet, View } from 'react-native'
import { Directory, File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { Badge, Button, Skeleton, Text, Textarea } from '../../../../components/ui'
import { Drawer } from '../../../../components/admin/overlay'
import { FormDrawer } from '../../../../components/admin/forms/FormDrawer'
import { InlineAlert } from '../../../../components/admin/feedback'
import { useShipmentController } from '../../controllers/useShippingController'
import { toast } from '../../../../lib/toast'
import {
  formatCarrierRupees,
  formatDateTime,
  formatWeightKg,
  shipmentStatusPresentation,
} from '../../../../lib/shipping/presentation'
import { colors, fontFamilyFor, radius } from '../../../../theme'

// One parcel: what it is, where it is, and the single next action available on
// it. The sequence (create -> AWB -> pickup) is the backend's; this only ever
// offers the step the backend would currently accept.
//
// The web component also has an `isAdmin` mode (internal details, super-admin
// delete). The seller app never passes it, so those branches are unreachable
// here and are not ported.

export function ShipmentDrawer({ shipmentId, isOpen, onClose }) {
  const controller = useShipmentController(shipmentId, { scope: 'vendor' })
  const { shipment } = controller
  // 'cancel' | 'return' | null. Both are confirmed before they fire: each one
  // spends a real carrier call and changes a real parcel.
  const [confirming, setConfirming] = useState(null)

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        title={shipment ? `Shipment ${shipment.id.slice(-8).toUpperCase()}` : 'Shipment'}
        description={shipment ? `Order ${shipment.orderId.slice(-8).toUpperCase()}` : undefined}
        width="lg"
        footer={<ShipmentActions controller={controller} onClose={onClose} onConfirm={setConfirming} />}
      >
        <View style={styles.body}>
          {controller.isLoading ? (
            <View style={{ gap: 12 }}>
              <Skeleton style={{ height: 96, width: '100%', borderRadius: radius.lg }} />
              <Skeleton style={{ height: 160, width: '100%', borderRadius: radius.lg }} />
            </View>
          ) : controller.error ? (
            <InlineAlert tone="danger" title="Could not load this shipment">
              {controller.error?.message || 'Try again in a moment.'}
            </InlineAlert>
          ) : !shipment ? null : (
            <View style={{ gap: 20 }}>
              <ReconciliationNotice shipment={shipment} />
              <StatusSummary shipment={shipment} />
              <ParcelDetails shipment={shipment} />
              <ItemList shipment={shipment} />
              <ShipmentDocuments controller={controller} />
              <NdrSection controller={controller} />
              <TrackingSection controller={controller} />
            </View>
          )}
        </View>
      </Drawer>

      <ConfirmCancel isOpen={confirming === 'cancel'} onClose={() => setConfirming(null)} controller={controller} />
      <ConfirmReturn isOpen={confirming === 'return'} onClose={() => setConfirming(null)} controller={controller} />
    </>
  )
}

// Cancelling is irreversible from the seller's side and, once an AWB exists,
// is a request rather than an act - so the dialog says which of the two this is.
function ConfirmCancel({ isOpen, onClose, controller }) {
  const [reason, setReason] = useState('')
  const [failure, setFailure] = useState('')
  const hasAwb = Boolean(controller.shipment?.awbCode)

  const submit = async () => {
    setFailure('')
    try {
      await controller.cancelShipment({ reason: reason.trim() })
      toast.success('Shipment cancelled successfully')
      setReason('')
      onClose()
    } catch (error) {
      toast.error('Could not cancel shipment', error)
      setFailure(error?.message || 'The courier did not accept the cancellation.')
    }
  }

  return (
    <FormDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Cancel this shipment?"
      submitLabel="Cancel shipment"
      submitTone="danger"
      cancelLabel="Keep it"
      isSubmitting={controller.isCancelling}
      onSubmit={submit}
    >
      <View style={{ gap: 16 }}>
        <InlineAlert tone={hasAwb ? 'warning' : 'info'} title={hasAwb ? 'The courier has to confirm this' : 'Nothing has shipped yet'}>
          {hasAwb
            ? 'An AWB has been issued, so the courier processes the cancellation in the background. The parcel stays "cancellation requested" until they confirm it.'
            : 'No AWB has been issued, so this stops before anything is collected.'}
        </InlineAlert>

        <View style={{ gap: 6 }}>
          <Text style={styles.fieldLabel}>Reason (optional)</Text>
          <Textarea
            rows={3}
            value={reason}
            maxLength={500}
            placeholder="Buyer changed their mind, out of stock…"
            onChange={(e) => setReason(e.target.value)}
          />
          <Text style={styles.faint}>Kept for support. A cancellation with no reason is unanswerable weeks later.</Text>
        </View>

        {failure ? (
          <InlineAlert tone="danger" title="Could not cancel">
            {failure}
          </InlineAlert>
        ) : null}
      </View>
    </FormDrawer>
  )
}

// A return is a NEW parcel travelling the other way, not an undo.
function ConfirmReturn({ isOpen, onClose, controller }) {
  const [reason, setReason] = useState('')
  const [failure, setFailure] = useState('')

  const submit = async () => {
    setFailure('')
    try {
      await controller.createReturn({ reason: reason.trim() })
      toast.success('Return booked successfully')
      setReason('')
      onClose()
    } catch (error) {
      toast.error('Could not book return', error)
      setFailure(error?.message || 'The courier did not accept the return.')
    }
  }

  return (
    <FormDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Book a return"
      description="The courier collects from the buyer and brings it back to you."
      submitLabel="Book return"
      isSubmitting={controller.isCreatingReturn}
      canSubmit={reason.trim().length > 0 && !controller.isCreatingReturn}
      onSubmit={submit}
    >
      <View style={{ gap: 16 }}>
        <InlineAlert tone="info" title="This creates a second parcel">
          The original shipment keeps its own AWB and history. The return gets its own tracking, travelling from the
          buyer back to your pickup address.
        </InlineAlert>

        <View style={{ gap: 6 }}>
          <Text style={styles.fieldLabel}>Reason</Text>
          <Textarea
            rows={3}
            value={reason}
            maxLength={500}
            placeholder="Wrong size, damaged in transit…"
            onChange={(e) => setReason(e.target.value)}
          />
        </View>

        {failure ? (
          <InlineAlert tone="danger" title="Could not book the return">
            {failure}
          </InlineAlert>
        ) : null}
      </View>
    </FormDrawer>
  )
}

// A parcel whose create call timed out MAY already exist at the carrier.
function ReconciliationNotice({ shipment }) {
  if (!shipment.reconciliationRequired) return null
  return (
    <InlineAlert tone="danger" title="Check Shiprocket before doing anything else">
      {shipment.reconciliationNote || 'A carrier call timed out and may have partly succeeded.'}
    </InlineAlert>
  )
}

function StatusSummary({ shipment }) {
  const presentation = shipmentStatusPresentation(shipment.status)
  return (
    <View style={styles.summary}>
      <View style={styles.wrapRow}>
        <Badge tone={presentation.tone} dot>
          {presentation.label}
        </Badge>
        {shipment.shipmentType === 'RETURN' ? <Badge tone="warning">Return</Badge> : null}
        {shipment.carrierStatus ? (
          <Text style={styles.faint}>{`carrier says: ${shipment.carrierStatus}`}</Text>
        ) : null}
      </View>

      {shipment.awbCode ? (
        <View style={[styles.wrapRow, { alignItems: 'baseline', columnGap: 12, rowGap: 4 }]}>
          <Text style={{ fontSize: 14, lineHeight: 20, fontWeight: '500', color: colors.slate[900] }}>
            {shipment.courierName || 'Courier assigned'}
          </Text>
          <Text noTranslate style={[styles.mono, { color: colors.ink.subtle }]}>
            {shipment.awbCode}
          </Text>
          {shipment.trackingUrl ? (
            <Text
              onPress={() => Linking.openURL(shipment.trackingUrl).catch(() => toast.error('Could not open the link'))}
              style={{ fontSize: 12, lineHeight: 16, fontWeight: '500', color: colors.brand[700], textDecorationLine: 'underline' }}
            >
              Track on carrier site
            </Text>
          ) : null}
        </View>
      ) : null}

      {shipment.errorMessage && !shipment.reconciliationRequired ? (
        <Text style={{ fontSize: 12, lineHeight: 16, color: colors.danger[600] }}>{shipment.errorMessage}</Text>
      ) : null}
    </View>
  )
}

function ParcelDetails({ shipment }) {
  const pkg = shipment.package
  return (
    <Section title="Parcel">
      <View style={styles.fieldGrid}>
        <Field label="From">{shipment.pickupLocation || shipment.pickupPincode || '—'}</Field>
        <Field label="To">
          {`${shipment.deliveryCity || '—'}${shipment.deliveryPincode ? ` ${shipment.deliveryPincode}` : ''}`}
        </Field>
        <Field label="Payment">
          {`${shipment.paymentMethod}${
            shipment.paymentMethod === 'COD' && shipment.collectableAmount > 0
              ? ` · collect ${formatCarrierRupees(shipment.collectableAmount)}`
              : ''
          }`}
        </Field>

        {pkg ? (
          <>
            <Field label="Size">{`${pkg.lengthCm} × ${pkg.breadthCm} × ${pkg.heightCm} cm`}</Field>
            <Field label="Actual weight">{formatWeightKg(pkg.actualWeightKg)}</Field>
            <Field
              label="Billed weight"
              extra={
                // Why the billed weight can exceed the real one - the single
                // most common shipping-invoice surprise for a new seller.
                pkg.chargeableWeightKg > pkg.actualWeightKg
                  ? `volumetric ${formatWeightKg(pkg.volumetricWeightKg)} (÷${pkg.volumetricDivisor})`
                  : null
              }
            >
              {formatWeightKg(pkg.chargeableWeightKg)}
            </Field>
          </>
        ) : null}

        <Field label="Created">{formatDateTime(shipment.createdAt)}</Field>
        {shipment.pickupScheduledAt ? <Field label="Pickup">{formatDateTime(shipment.pickupScheduledAt)}</Field> : null}
        {shipment.deliveredAt ? <Field label="Delivered">{formatDateTime(shipment.deliveredAt)}</Field> : null}
      </View>
    </Section>
  )
}

function ItemList({ shipment }) {
  return (
    <Section title={`Contents (${shipment.itemCount})`}>
      <View>
        {shipment.items.map((item, index) => (
          <View
            key={item.productId}
            style={[styles.itemRow, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border.DEFAULT }]}
          >
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 12, lineHeight: 16, color: colors.slate[900] }}>
              {item.name}
            </Text>
            <Text noTranslate style={{ flexShrink: 0, fontSize: 12, lineHeight: 16, color: colors.ink.subtle }}>
              × {item.quantity} · {formatCarrierRupees(item.unitPrice)}
            </Text>
          </View>
        ))}
      </View>
    </Section>
  )
}

function TrackingSection({ controller }) {
  const { shipment, tracking, refreshTracking, isRefreshing, refreshError, lastRefresh } = controller

  if (!shipment?.awbCode) {
    return (
      <Section title="Tracking">
        <Text style={styles.body12}>
          Tracking starts once an AWB is assigned. Nothing has been handed to the courier yet.
        </Text>
      </Section>
    )
  }

  const events = tracking?.events ?? []

  return (
    <Section
      title="Tracking"
      action={
        <Button
          variant="quiet"
          size="sm"
          onPress={async () => {
            try {
              const res = await refreshTracking()
              if (res?.newEvents > 0) {
                toast.success(`Tracking updated: ${res.newEvents} new update${res.newEvents > 1 ? 's' : ''}`)
              } else {
                toast.info('Tracking is up to date')
              }
            } catch (err) {
              toast.error('Failed to refresh tracking', err)
            }
          }}
          isLoading={isRefreshing}
        >
          Refresh from carrier
        </Button>
      }
    >
      {refreshError ? (
        <View style={{ marginBottom: 12 }}>
          <InlineAlert tone="warning" title="Could not reach the carrier">
            {refreshError?.message || 'The last known status is still shown below.'}
          </InlineAlert>
        </View>
      ) : null}

      {lastRefresh && lastRefresh.newEvents === 0 && !refreshError ? (
        <Text style={[styles.faint, { marginBottom: 12 }]}>No new updates from the carrier.</Text>
      ) : null}

      {tracking?.lastSyncedAt ? (
        <Text style={[styles.faint, { marginBottom: 12 }]}>{`Last checked ${formatDateTime(tracking.lastSyncedAt)}`}</Text>
      ) : null}

      {events.length === 0 ? (
        <Text style={styles.body12}>No carrier scans yet. The first one usually appears after pickup.</Text>
      ) : (
        <View>
          {/* Newest first: the current state is what someone opening this
              wants, and the history is below it. */}
          {[...events].reverse().map((event, index) => (
            <View key={`${event.occurredAt}-${event.carrierStatus}-${index}`} style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ alignItems: 'center' }}>
                <View
                  style={{
                    marginTop: 6,
                    height: 8,
                    width: 8,
                    borderRadius: 4,
                    backgroundColor: index === 0 ? colors.brand[600] : colors.border.DEFAULT,
                  }}
                />
                {index < events.length - 1 ? <View style={{ width: 1, flex: 1, backgroundColor: colors.border.DEFAULT }} /> : null}
              </View>
              <View style={{ flex: 1, minWidth: 0, paddingBottom: 16 }}>
                <Text style={{ fontSize: 12, lineHeight: 16, fontWeight: '500', color: colors.slate[900] }}>
                  {event.carrierStatus}
                </Text>
                <Text noTranslate style={styles.faint}>
                  {`${formatDateTime(event.occurredAt)}${event.location ? ` · ${event.location}` : ''}`}
                </Text>
                {event.description && event.description !== event.carrierStatus ? (
                  <Text style={{ marginTop: 2, fontSize: 11, lineHeight: 16, color: colors.ink.subtle }}>{event.description}</Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      )}
    </Section>
  )
}

// Downloads the carrier document into the cache and hands it to the OS share
// sheet (save to Files, print, WhatsApp...). If the download or sharing is not
// possible the document is opened in the browser instead.
async function openDocument(url, type, shipmentId) {
  const target = /^https?:/i.test(url) ? url : null
  if (!target) throw new Error('The document link is not valid.')
  try {
    const dir = new Directory(Paths.cache, 'shipment-documents')
    if (!dir.exists) dir.create({ intermediates: true })
    const file = new File(dir, `${type.toLowerCase()}-${String(shipmentId).slice(-8)}.pdf`)
    if (file.exists) file.delete()
    const downloaded = await File.downloadFileAsync(target, file)
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(downloaded.uri, { mimeType: 'application/pdf', dialogTitle: type })
      return
    }
  } catch {
    // Fall through to the browser.
  }
  await Linking.openURL(target)
}

// Carrier documents. Separate from ShipmentActions because these are not part
// of the parcel's forward sequence - a seller reprints a label at any point
// after an AWB exists, and doing so changes nothing about the shipment.
function ShipmentDocuments({ controller }) {
  const { shipment, canPrintLabel, canPrintInvoice, documents, isFetchingDocument } = controller
  const [pending, setPending] = useState(null)

  if (!shipment || shipment.reconciliationRequired) return null

  const available = [
    canPrintLabel && { type: 'LABEL', label: 'Shipping label', url: documents.label },
    canPrintLabel && { type: 'MANIFEST', label: 'Manifest', url: documents.manifest },
    canPrintInvoice && { type: 'INVOICE', label: 'Tax invoice', url: documents.invoice },
  ].filter(Boolean)

  if (available.length === 0) return null

  async function open(type, cachedUrl) {
    setPending(type)
    try {
      const url = cachedUrl || (await controller.fetchDocument({ type })).url
      await openDocument(url, type, shipment.id)
    } catch (err) {
      toast.error('Could not get document', err)
    } finally {
      setPending(null)
    }
  }

  return (
    <Section title="Documents">
      <View style={{ gap: 12 }}>
        <View style={styles.wrapRow}>
          {available.map((doc) => (
            <Button
              key={doc.type}
              variant="secondary"
              size="sm"
              icon="print"
              onPress={() => open(doc.type, doc.url)}
              isLoading={pending === doc.type || (isFetchingDocument && pending === doc.type)}
              disabled={pending !== null}
            >
              {doc.label}
            </Button>
          ))}
        </View>

        {controller.documentError ? (
          <InlineAlert tone="danger" title="Could not get that document">
            {controller.documentError?.message || 'The courier could not produce it. Try again shortly.'}
          </InlineAlert>
        ) : null}
      </View>
    </Section>
  )
}

// Non-delivery. The courier tried and could not deliver; the seller decides
// whether to try again or take it back. Collapsed until asked for, because
// reading it costs a real carrier call.
function NdrSection({ controller }) {
  const [isOpen, setIsOpen] = useState(false)
  const [comments, setComments] = useState('')

  if (!controller.canHandleNdr) return null
  // Shiprocket answers a parcel with no failed attempt with just a message
  // ("Invalid AWB", "No data found") - that is "nothing on record", not data.
  const ndr = controller.ndr
  const hasNdrData =
    ndr && typeof ndr === 'object' && Object.keys(ndr).some((key) => !['message', 'status', 'status_code'].includes(key))
  const isNdr = controller.shipment?.status === 'NDR' || hasNdrData

  async function open() {
    setIsOpen(true)
    try {
      await controller.fetchNdr()
    } catch {
      // Surfaced through ndrError below.
    }
  }

  async function answer(action) {
    try {
      await controller.actOnNdr({ action, comments })
      toast.success(action === 'return' ? 'Return requested with courier' : 'Re-attempt requested with courier')
      setComments('')
    } catch (err) {
      toast.error('The courier did not accept that', err)
      // Surfaced through ndrActionError below.
    }
  }

  return (
    <Section
      title="Delivery attempts"
      action={
        !isOpen ? (
          <Button variant="quiet" size="sm" onPress={open} isLoading={controller.isFetchingNdr}>
            Check with courier
          </Button>
        ) : null
      }
    >
      {!isOpen ? (
        <Text style={styles.faintSubtle}>If the courier could not deliver, check here and tell them what to do next.</Text>
      ) : (
        <View style={{ gap: 12 }}>
          {controller.isFetchingNdr ? <Skeleton style={{ height: 64, width: '100%', borderRadius: radius.lg }} /> : null}

          {controller.ndrError ? (
            <InlineAlert tone="danger" title="Could not reach the courier">
              {controller.ndrError?.message || 'Try again in a moment.'}
            </InlineAlert>
          ) : null}

          {!controller.isFetchingNdr && !controller.ndrError ? (
            <>
              {hasNdrData ? (
                // The carrier's payload, shown as-is. Its shape is theirs.
                <ScrollView nestedScrollEnabled style={styles.pre}>
                  <Text noTranslate style={{ fontFamily: fontFamilyFor('400'), fontSize: 11, lineHeight: 16, color: colors.ink.muted }}>
                    {JSON.stringify(controller.ndr, null, 2)}
                  </Text>
                </ScrollView>
              ) : (
                <Text style={styles.faintSubtle}>The courier has no failed delivery on record for this parcel.</Text>
              )}

              {isNdr ? (
                <>
                  <Textarea
                    label="Note for the courier (optional)"
                    rows={2}
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    placeholder="e.g. buyer confirmed they will be home after 6pm"
                  />

                  <View style={[styles.wrapRow, { justifyContent: 'flex-end' }]}>
                    <Button size="sm" variant="secondary" onPress={() => answer('return')} isLoading={controller.isActingOnNdr}>
                      Send it back
                    </Button>
                    <Button size="sm" onPress={() => answer('re-attempt')} isLoading={controller.isActingOnNdr}>
                      Try delivery again
                    </Button>
                  </View>
                </>
              ) : null}

              {controller.ndrActionDone ? (
                <InlineAlert tone="success" title="Sent to the courier">
                  They will confirm on the next tracking update — this is an instruction, not an outcome.
                </InlineAlert>
              ) : null}

              {controller.ndrActionError ? (
                <InlineAlert tone="danger" title="The courier did not accept that">
                  {controller.ndrActionError?.message || 'Try again in a moment.'}
                </InlineAlert>
              ) : null}
            </>
          ) : null}
        </View>
      )}
    </Section>
  )
}

// Exactly one forward action is offered at a time, because exactly one is
// valid at a time. A parcel needing reconciliation offers none.
function ShipmentActions({ controller, onClose, onConfirm }) {
  const { shipment, needsReconciliation, canAssignAwb, canSchedulePickup, canCancel, canReturn } = controller

  if (!shipment) return null

  return (
    <View style={{ width: '100%', gap: 8 }}>
      {controller.awbError || controller.pickupError ? (
        <InlineAlert tone="danger" title="That did not go through">
          {(controller.awbError || controller.pickupError)?.message || 'Try again in a moment.'}
        </InlineAlert>
      ) : null}

      <View style={styles.footerRow}>
        <Button variant="quiet" size="control" onPress={onClose}>
          Close
        </Button>

        {/* Cancelling and returning are mutually exclusive by definition: a
            parcel is either still stoppable or already delivered. */}
        {canCancel && !needsReconciliation ? (
          <Button variant="dangerOutline" size="control" onPress={() => onConfirm('cancel')}>
            Cancel shipment
          </Button>
        ) : null}
        {canReturn ? (
          <Button variant="secondary" size="control" onPress={() => onConfirm('return')}>
            Book return
          </Button>
        ) : null}

        {needsReconciliation ? (
          <Text style={{ fontSize: 11, lineHeight: 16, color: colors.danger[600] }}>Resolve in Shiprocket first</Text>
        ) : controller.canRestock ? (
          // RTO: the courier brought it back. Only once it is physically back.
          <Button
            size="control"
            icon="inventory"
            onPress={async () => {
              try {
                await controller.restock()
                toast.success('Put back into stock')
              } catch (err) {
                toast.error('Could not restock', err)
              }
            }}
            isLoading={controller.isRestocking}
          >
            Put back in stock
          </Button>
        ) : canAssignAwb ? (
          <Button
            size="control"
            onPress={async () => {
              try {
                await controller.assignAwb({})
                toast.success('AWB assigned successfully')
              } catch (err) {
                toast.error('Failed to assign AWB', err)
              }
            }}
            isLoading={controller.isAssigningAwb}
          >
            Assign AWB
          </Button>
        ) : canSchedulePickup ? (
          <Button
            size="control"
            onPress={async () => {
              try {
                await controller.schedulePickup()
                toast.success('Pickup scheduled successfully')
              } catch (err) {
                toast.error('Failed to schedule pickup', err)
              }
            }}
            isLoading={controller.isSchedulingPickup}
          >
            Schedule pickup
          </Button>
        ) : null}
      </View>
    </View>
  )
}

function Section({ title, action, children }) {
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {action}
      </View>
      {children}
    </View>
  )
}

function Field({ label, extra, children }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldTerm}>{label}</Text>
      <Text style={{ fontSize: 12, lineHeight: 16, color: colors.slate[900] }}>{children}</Text>
      {extra ? <Text style={styles.faint}>{extra}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingVertical: 16 },
  summary: {
    gap: 12,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    backgroundColor: colors.surface.muted,
    padding: 16,
  },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  footerRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sectionTitle: { fontSize: 12, lineHeight: 16, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3, color: colors.ink.faint },
  fieldGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 12 },
  field: { width: '47%', minWidth: 0, gap: 2 },
  fieldTerm: { fontSize: 11, lineHeight: 16, textTransform: 'uppercase', letterSpacing: 0.3, color: colors.ink.faint },
  fieldLabel: { fontSize: 12, lineHeight: 16, fontWeight: '500', color: colors.slate[700] },
  faint: { fontSize: 11, lineHeight: 16, color: colors.ink.faint },
  faintSubtle: { fontSize: 11, lineHeight: 16, color: colors.ink.subtle },
  body12: { fontSize: 12, lineHeight: 16, color: colors.ink.subtle },
  mono: { fontFamily: fontFamilyFor('400'), fontSize: 12, lineHeight: 16, fontVariant: ['tabular-nums'] },
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 8 },
  pre: {
    maxHeight: 160,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    padding: 10,
  },
})

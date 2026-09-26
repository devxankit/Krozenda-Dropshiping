import { useState } from 'react'
import { Badge, Button, Skeleton, Textarea } from '../../../../components/ui'
import { Drawer } from '../../../admin/components/overlay/Drawer'
import { FormDrawer } from '../../../admin/components/forms/FormDrawer'
import { ConfirmDialog } from '../../../admin/components/overlay/ConfirmDialog'
import { useAuthStore } from '../../../../lib/authStore'
import { InlineAlert } from '../../../admin/components/feedback'
import { useShipmentController } from '../../controllers/useShippingController'
import { toast } from '../../../../lib/toast'
import {
  formatCarrierRupees,
  formatDateTime,
  formatWeightKg,
  shipmentStatusPresentation,
} from '../../../../lib/shipping/presentation'

// One parcel: what it is, where it is, and the single next action available on
// it. The sequence (create → AWB → pickup) is the backend's; this only ever
// offers the step the backend would currently accept, and the backend still
// refuses anything out of order.
//
// `isAdmin` widens what is shown — the account type and carrier costs — but
// never to a credential. There is no shape in which this component can render
// a carrier email or password, because no endpoint it calls returns one.

export function ShipmentDrawer({ shipmentId, isOpen, onClose, isAdmin = false }) {
  // An admin drawer must call the admin routes; a vendor token would be
  // rejected by them, and an admin token by the vendor ones.
  const controller = useShipmentController(shipmentId, { scope: isAdmin ? 'admin' : 'vendor' })
  const { shipment } = controller
  // 'cancel' | 'return' | null. Both are confirmed before they fire: each one
  // spends a real carrier call and changes a real parcel.
  const [confirming, setConfirming] = useState(null)
  // Deleting a parcel record is a super-admin action, on the admin screen only.
  const isSuperAdmin = useAuthStore((state) => state.roles.includes('admin'))
  const canDeleteHere = isAdmin && isSuperAdmin && controller.canDelete

  return (
    <>
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={shipment ? `Shipment ${shipment.id.slice(-8).toUpperCase()}` : 'Shipment'}
      description={shipment ? `Order ${shipment.orderId.slice(-8).toUpperCase()}` : undefined}
      width="lg"
      footer={
        <ShipmentActions controller={controller} onClose={onClose} onConfirm={setConfirming} canDelete={canDeleteHere} />
      }
    >
      {/* The Drawer leaves padding to its content. */}
      <div className="px-5 py-4">
      {controller.isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      ) : controller.error ? (
        <InlineAlert tone="danger" title="Could not load this shipment">
          {controller.error?.message || 'Try again in a moment.'}
        </InlineAlert>
      ) : !shipment ? null : (
        <div className="flex flex-col gap-5">
          <ReconciliationNotice shipment={shipment} />
          <StatusSummary shipment={shipment} />
          <ParcelDetails shipment={shipment} isAdmin={isAdmin} />
          <ItemList shipment={shipment} />
          <ShipmentDocuments controller={controller} />
          <NdrSection controller={controller} />
          <TrackingSection controller={controller} />
          {isAdmin && <InternalDetails shipment={shipment} />}
        </div>
      )}
      </div>
    </Drawer>

    <ConfirmDialog
      isOpen={confirming === 'delete'}
      onClose={() => setConfirming(null)}
      onConfirm={async () => {
        try {
          await controller.deleteShipment()
          toast.success('Shipment deleted')
          setConfirming(null)
          onClose()
        } catch (err) {
          toast.error('Could not delete shipment', err)
        }
      }}
      isSubmitting={controller.isDeleting}
      title="Delete this shipment record?"
      description="Only a cancelled, failed or never-sent parcel can be deleted. The order itself is not touched."
      confirmLabel="Delete"
    />

    <ConfirmCancel
      isOpen={confirming === 'cancel'}
      onClose={() => setConfirming(null)}
      controller={controller}
    />
    <ConfirmReturn
      isOpen={confirming === 'return'}
      onClose={() => setConfirming(null)}
      controller={controller}
    />
    </>
  )
}

// Cancelling is irreversible from the seller's side and, once an AWB exists,
// is a request rather than an act — so the dialog says which of the two this
// is, instead of a generic "are you sure".
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
      <div className="flex flex-col gap-4">
        <InlineAlert tone={hasAwb ? 'warning' : 'info'} title={hasAwb ? 'The courier has to confirm this' : 'Nothing has shipped yet'}>
          {hasAwb
            ? 'An AWB has been issued, so the courier processes the cancellation in the background. The parcel stays "cancellation requested" until they confirm it.'
            : 'No AWB has been issued, so this stops before anything is collected.'}
        </InlineAlert>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-slate-700">Reason (optional)</span>
          <Textarea
            rows={3}
            value={reason}
            maxLength={500}
            placeholder="Buyer changed their mind, out of stock…"
            onChange={(e) => setReason(e.target.value)}
          />
          <span className="text-2xs text-ink-faint">Kept for support. A cancellation with no reason is unanswerable weeks later.</span>
        </label>

        {failure && (
          <InlineAlert tone="danger" title="Could not cancel">
            {failure}
          </InlineAlert>
        )}
      </div>
    </FormDrawer>
  )
}

// A return is a NEW parcel travelling the other way, not an undo — the dialog
// says so, because sellers expect "return" to reverse the original shipment.
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
      <div className="flex flex-col gap-4">
        <InlineAlert tone="info" title="This creates a second parcel">
          The original shipment keeps its own AWB and history. The return gets its own tracking, travelling from the
          buyer back to your pickup address.
        </InlineAlert>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-slate-700">Reason</span>
          <Textarea
            rows={3}
            value={reason}
            maxLength={500}
            placeholder="Wrong size, damaged in transit…"
            onChange={(e) => setReason(e.target.value)}
          />
        </label>

        {failure && (
          <InlineAlert tone="danger" title="Could not book the return">
            {failure}
          </InlineAlert>
        )}
      </div>
    </FormDrawer>
  )
}

// The most important thing on this screen when it applies: a parcel whose
// create call timed out MAY already exist at the carrier. Retrying blind
// creates a second real, billable parcel — so the note says what to check.
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
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-muted p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={presentation.tone} dot>
          {presentation.label}
        </Badge>
        {shipment.shipmentType === 'RETURN' && <Badge tone="warning">Return</Badge>}
        {shipment.carrierStatus && <span className="text-2xs text-ink-faint">carrier says: {shipment.carrierStatus}</span>}
      </div>

      {shipment.awbCode && (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-sm font-medium text-slate-900">{shipment.courierName || 'Courier assigned'}</span>
          <span className="font-mono text-xs text-ink-subtle">{shipment.awbCode}</span>
          {shipment.trackingUrl && (
            <a
              href={shipment.trackingUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-xs font-medium text-brand-700 underline-offset-2 hover:underline"
            >
              Track on carrier site
            </a>
          )}
        </div>
      )}

      {shipment.errorMessage && !shipment.reconciliationRequired && (
        <p className="text-xs text-danger-600">{shipment.errorMessage}</p>
      )}
    </div>
  )
}

function ParcelDetails({ shipment, isAdmin }) {
  const pkg = shipment.package
  return (
    <Section title="Parcel">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        <Field label="From">{shipment.pickupLocation || shipment.pickupPincode || '—'}</Field>
        <Field label="To">
          {shipment.deliveryCity || '—'}
          {shipment.deliveryPincode ? ` ${shipment.deliveryPincode}` : ''}
        </Field>
        <Field label="Payment">
          {shipment.paymentMethod}
          {shipment.paymentMethod === 'COD' && shipment.collectableAmount > 0
            ? ` · collect ${formatCarrierRupees(shipment.collectableAmount)}`
            : ''}
        </Field>

        {pkg && (
          <>
            <Field label="Size">
              {pkg.lengthCm} × {pkg.breadthCm} × {pkg.heightCm} cm
            </Field>
            <Field label="Actual weight">{formatWeightKg(pkg.actualWeightKg)}</Field>
            <Field label="Billed weight">
              {formatWeightKg(pkg.chargeableWeightKg)}
              {/* Why the billed weight can exceed the real one — the single
                  most common shipping-invoice surprise for a new seller. */}
              {pkg.chargeableWeightKg > pkg.actualWeightKg && (
                <span className="block text-2xs text-ink-faint">
                  volumetric {formatWeightKg(pkg.volumetricWeightKg)} (÷{pkg.volumetricDivisor})
                </span>
              )}
            </Field>
          </>
        )}

        <Field label="Created">{formatDateTime(shipment.createdAt)}</Field>
        {shipment.pickupScheduledAt && <Field label="Pickup">{formatDateTime(shipment.pickupScheduledAt)}</Field>}
        {shipment.deliveredAt && <Field label="Delivered">{formatDateTime(shipment.deliveredAt)}</Field>}

        {isAdmin && shipment.shippingAccountType && (
          <Field label="Shipped on">
            {shipment.shippingAccountType === 'SELLER' ? 'Seller own account' : 'Platform account'}
          </Field>
        )}
      </dl>
    </Section>
  )
}

function ItemList({ shipment }) {
  return (
    <Section title={`Contents (${shipment.itemCount})`}>
      <ul className="flex flex-col divide-y divide-border">
        {shipment.items.map((item) => (
          <li key={item.productId} className="flex items-center justify-between gap-3 py-2 text-xs">
            <span className="min-w-0 truncate text-slate-900">{item.name}</span>
            <span className="shrink-0 text-ink-subtle">
              × {item.quantity} · {formatCarrierRupees(item.unitPrice)}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  )
}

function TrackingSection({ controller }) {
  const { shipment, tracking, refreshTracking, isRefreshing, refreshError, lastRefresh } = controller

  if (!shipment?.awbCode) {
    return (
      <Section title="Tracking">
        <p className="text-xs text-ink-subtle">
          Tracking starts once an AWB is assigned. Nothing has been handed to the courier yet.
        </p>
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
          onClick={async () => {
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
      {refreshError && (
        <div className="mb-3">
          <InlineAlert tone="warning" title="Could not reach the carrier">
            {refreshError?.message || 'The last known status is still shown below.'}
          </InlineAlert>
        </div>
      )}

      {lastRefresh && lastRefresh.newEvents === 0 && !refreshError && (
        <p className="mb-3 text-2xs text-ink-faint">No new updates from the carrier.</p>
      )}

      {tracking?.lastSyncedAt && (
        <p className="mb-3 text-2xs text-ink-faint">Last checked {formatDateTime(tracking.lastSyncedAt)}</p>
      )}

      {events.length === 0 ? (
        <p className="text-xs text-ink-subtle">
          No carrier scans yet. The first one usually appears after pickup.
        </p>
      ) : (
        <ol className="flex flex-col gap-0">
          {/* Newest first: the current state is what someone opening this
              wants, and the history is below it. */}
          {[...events].reverse().map((event, index) => (
            <li key={`${event.occurredAt}-${event.carrierStatus}-${index}`} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${index === 0 ? 'bg-brand-600' : 'bg-border'}`} />
                {index < events.length - 1 && <span className="w-px flex-1 bg-border" />}
              </div>
              <div className="min-w-0 pb-4">
                <p className="text-xs font-medium text-slate-900">
                  {/* The carrier's own wording is what a buyer sees in their
                      SMS, so it is shown. `event.status` is ours and may be
                      null when the carrier sent something unrecognised — that
                      is displayed as-is rather than guessed into a status. */}
                  {event.carrierStatus}
                </p>
                <p className="text-2xs text-ink-faint">
                  {formatDateTime(event.occurredAt)}
                  {event.location ? ` · ${event.location}` : ''}
                </p>
                {event.description && event.description !== event.carrierStatus && (
                  <p className="mt-0.5 text-2xs text-ink-subtle">{event.description}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Section>
  )
}

function InternalDetails({ shipment }) {
  return (
    <Section title="Internal">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        <Field label="Carrier order id">{shipment.carrierOrderId || '—'}</Field>
        <Field label="Carrier shipment id">{shipment.carrierShipmentId || '—'}</Field>
        <Field label="Retries">{shipment.retryCount ?? 0}</Field>
        {/* Kept separate on purpose: what the carrier bills and what the buyer
            paid are different numbers, and collapsing them hides the margin. */}
        <Field label="Carrier cost">{formatCarrierRupees(shipment.carrierShippingCost)}</Field>
        <Field label="Buyer paid">{formatCarrierRupees(shipment.customerShippingCharge)}</Field>
        <Field label="Margin">{formatCarrierRupees(shipment.platformShippingMargin)}</Field>
      </dl>

      {shipment.statusHistory?.length > 0 && (
        <ol className="mt-4 flex flex-col gap-1 border-t border-border pt-3">
          {shipment.statusHistory.map((entry, index) => (
            <li key={`${entry.status}-${entry.at}-${index}`} className="flex justify-between gap-3 text-2xs">
              <span className="text-slate-700">
                {shipmentStatusPresentation(entry.status).label}
                {entry.note ? ` — ${entry.note}` : ''}
              </span>
              <span className="shrink-0 text-ink-faint">
                {formatDateTime(entry.at)} · {entry.source}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Section>
  )
}

// Carrier documents. Separate from ShipmentActions because these are not part
// of the parcel's forward sequence — a seller reprints a label at any point
// after an AWB exists, and doing so changes nothing about the shipment.
//
// The tab is opened synchronously inside the click (a popup blocker only
// allows it there) and pointed at the document once its URL arrives. A URL
// already on the shipment opens straight away. `noopener` is NOT passed to
// window.open: with it the call always returns null, which made every open
// look "blocked" — the opener link is cut by hand instead.
function ShipmentDocuments({ controller }) {
  const { shipment, canPrintLabel, canPrintInvoice, documents, isFetchingDocument } = controller
  const [pending, setPending] = useState(null)
  const [blocked, setBlocked] = useState(null)

  if (!shipment || shipment.reconciliationRequired) return null

  const available = [
    canPrintLabel && { type: 'LABEL', label: 'Shipping label', url: documents.label },
    canPrintLabel && { type: 'MANIFEST', label: 'Manifest', url: documents.manifest },
    canPrintInvoice && { type: 'INVOICE', label: 'Tax invoice', url: documents.invoice },
  ].filter(Boolean)

  if (available.length === 0) return null

  async function open(type, cachedUrl) {
    setBlocked(null)
    const tab = window.open(cachedUrl || '', '_blank')
    if (tab) tab.opener = null
    if (cachedUrl) {
      if (!tab) setBlocked({ type, url: cachedUrl })
      return
    }

    setPending(type)
    try {
      const result = await controller.fetchDocument({ type })
      if (tab && !tab.closed) {
        tab.location.href = result.url
      } else {
        // Popup blocked — show the link instead of silently doing nothing.
        setBlocked({ type, url: result.url })
        toast.info('Popup blocked. Click the link to view the document.')
      }
    } catch (err) {
      tab?.close()
      toast.error('Could not get document', err)
    } finally {
      setPending(null)
    }
  }

  return (
    <Section title="Documents">
      <div className="flex flex-wrap items-center gap-2">
        {available.map((doc) => (
          <Button
            key={doc.type}
            variant="secondary"
            size="sm"
            icon="print"
            onClick={() => open(doc.type, doc.url)}
            isLoading={isFetchingDocument && pending === doc.type}
          >
            {doc.label}
          </Button>
        ))}
      </div>

      {blocked && (
        <p className="text-2xs text-ink-subtle">
          Your browser blocked the new tab.{' '}
          <a
            href={blocked.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-brand-700 underline"
          >
            Open the document
          </a>
        </p>
      )}

      {controller.documentError && (
        <InlineAlert tone="danger" title="Could not get that document">
          {controller.documentError?.message || 'The courier could not produce it. Try again shortly.'}
        </InlineAlert>
      )}
    </Section>
  )
}

// Non-delivery. The courier tried and could not deliver; the seller decides
// whether to try again or take it back.
//
// Collapsed until asked for, because reading it costs a real carrier call and
// most parcels never have one. Left unanswered, couriers return the parcel by
// default — which is why this is worth surfacing at all rather than letting
// the seller find out from the return freight.
function NdrSection({ controller }) {
  const [isOpen, setIsOpen] = useState(false)
  const [comments, setComments] = useState('')

  if (!controller.canHandleNdr) return null
  // Shiprocket answers a parcel with no failed attempt with just a message
  // ("Invalid AWB", "No data found") — that is "nothing on record", not data.
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
          <Button variant="quiet" size="sm" onClick={open} isLoading={controller.isFetchingNdr}>
            Check with courier
          </Button>
        ) : null
      }
    >
      {!isOpen ? (
        <p className="text-2xs text-ink-subtle">
          If the courier could not deliver, check here and tell them what to do next.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {controller.isFetchingNdr && <Skeleton className="h-16 w-full rounded-lg" />}

          {controller.ndrError && (
            <InlineAlert tone="danger" title="Could not reach the courier">
              {controller.ndrError?.message || 'Try again in a moment.'}
            </InlineAlert>
          )}

          {!controller.isFetchingNdr && !controller.ndrError && (
            <>
              {hasNdrData ? (
                // The carrier's payload, shown as-is. Its shape is theirs, and
                // pretending to understand every field would go stale the
                // first time they add one.
                <pre className="admin-scroll max-h-40 overflow-auto rounded-lg border border-border bg-surface-subtle p-2.5 text-2xs text-ink-muted">
                  {JSON.stringify(controller.ndr, null, 2)}
                </pre>
              ) : (
                <p className="text-2xs text-ink-subtle">
                  The courier has no failed delivery on record for this parcel.
                </p>
              )}

              {isNdr && (
              <>
              <Textarea
                id="ndr-comments"
                label="Note for the courier (optional)"
                rows={2}
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="e.g. buyer confirmed they will be home after 6pm"
              />

              <div className="flex items-center justify-end gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => answer('return')}
                  isLoading={controller.isActingOnNdr}
                >
                  Send it back
                </Button>
                <Button size="sm" onClick={() => answer('re-attempt')} isLoading={controller.isActingOnNdr}>
                  Try delivery again
                </Button>
              </div>
              </>
              )}

              {controller.ndrActionDone && (
                <InlineAlert tone="success" title="Sent to the courier">
                  They will confirm on the next tracking update — this is an instruction, not an outcome.
                </InlineAlert>
              )}

              {controller.ndrActionError && (
                <InlineAlert tone="danger" title="The courier did not accept that">
                  {controller.ndrActionError?.message || 'Try again in a moment.'}
                </InlineAlert>
              )}
            </>
          )}
        </div>
      )}
    </Section>
  )
}

// Exactly one forward action is offered at a time, because exactly one is
// valid at a time. A parcel needing reconciliation offers none.
function ShipmentActions({ controller, onClose, onConfirm, canDelete = false }) {
  const { shipment, needsReconciliation, canAssignAwb, canSchedulePickup, canCancel, canReturn } = controller

  if (!shipment) return null

  return (
    <div className="flex flex-col gap-2">
      {(controller.awbError || controller.pickupError) && (
        <InlineAlert tone="danger" title="That did not go through">
          {(controller.awbError || controller.pickupError)?.message || 'Try again in a moment.'}
        </InlineAlert>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button variant="quiet" size="control" onClick={onClose}>
          Close
        </Button>

        {canDelete && (
          <Button variant="dangerOutline" size="control" icon="delete" onClick={() => onConfirm('delete')}>
            Delete
          </Button>
        )}

        {/* Cancelling and returning are mutually exclusive by definition: a
            parcel is either still stoppable or already delivered. */}
        {canCancel && !needsReconciliation && (
          <Button variant="dangerOutline" size="control" onClick={() => onConfirm('cancel')}>
            Cancel shipment
          </Button>
        )}
        {canReturn && (
          <Button variant="secondary" size="control" onClick={() => onConfirm('return')}>
            Book return
          </Button>
        )}

        {needsReconciliation ? (
          <span className="text-2xs text-danger-600">Resolve in Shiprocket first</span>
        ) : controller.canRestock ? (
          // RTO: the courier brought it back. Only once it is physically back.
          <Button
            size="control"
            icon="inventory"
            onClick={async () => {
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
            onClick={async () => {
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
            onClick={async () => {
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
      </div>
    </div>
  )
}

function Section({ title, action, children }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

function Field({ label, children }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-2xs uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className="text-xs text-slate-900">{children}</dd>
    </div>
  )
}

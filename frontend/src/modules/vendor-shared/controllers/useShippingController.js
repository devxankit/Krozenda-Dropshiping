import { useCallback, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useListController } from '../../admin/controllers/useListController'
import {
  assignAwb,
  cancelShipment,
  checkServiceability,
  createReturn,
  connectShiprocket,
  createPickupLocation,
  createShipment,
  disconnectShiprocket,
  fetchPickupLocations,
  fetchShipment,
  fetchShipments,
  fetchShippingIntegration,
  fetchTracking,
  refreshTracking,
  registerPickupLocation,
  removePickupLocation,
  schedulePickup,
  setDefaultPickupLocation,
  suggestPackage,
  updatePickupLocation,
} from '../services/shippingService'

// Layer rule: controllers/ hold orchestration and are the only thing pages/
// call into. Nothing below imports axios; nothing above knows a carrier exists.

// Mirrors shipmentService.CANCELLABLE_STATUSES on the backend. The backend is
// still the authority and will refuse anything else; this only decides whether
// the button is worth showing.
const CANCELLABLE_STATUSES = [
  'PENDING',
  'READY_TO_SHIP',
  'SERVICEABILITY_CHECKED',
  'SHIPMENT_CREATED',
  'COURIER_ASSIGNED',
  'AWB_ASSIGNED',
  'PICKUP_SCHEDULED',
]

const INTEGRATION_KEY = ['vendor', 'shipping', 'integration']
const PICKUP_KEY = ['vendor', 'shipping', 'pickup-locations']
const SHIPMENTS_KEY = ['vendor', 'shipments']

// ---------------------------------------------------------------------------
// Carrier account
// ---------------------------------------------------------------------------

export function useShippingIntegrationController() {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: INTEGRATION_KEY, queryFn: fetchShippingIntegration })
  const invalidate = () => queryClient.invalidateQueries({ queryKey: INTEGRATION_KEY })

  const connectMutation = useMutation({ mutationFn: connectShiprocket, onSuccess: invalidate })
  const disconnectMutation = useMutation({ mutationFn: disconnectShiprocket, onSuccess: invalidate })

  const integration = query.data?.integration ?? null
  const policy = query.data?.policy ?? null

  return {
    integration,
    policy,
    capabilities: query.data?.capabilities ?? {},
    canStoreCredentials: query.data?.canStoreCredentials ?? false,

    isConnected: Boolean(integration?.isActive && integration?.status === 'CONNECTED'),
    // Connected but the last carrier call failed — the seller can still see
    // their parcels, but a new one will be refused until this is fixed.
    isUnhealthy: Boolean(integration?.isActive && integration?.status === 'FAILED'),
    // Which account new parcels will actually use, which is the question a
    // seller is really asking on this screen.
    effectiveAccount: resolveEffectiveAccount(integration, policy),

    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,

    connect: connectMutation.mutateAsync,
    isConnecting: connectMutation.isPending,
    connectError: connectMutation.error,

    disconnect: disconnectMutation.mutateAsync,
    isDisconnecting: disconnectMutation.isPending,
  }
}

// Mirrors shippingAccountResolver's precedence on the backend. Kept in sync by
// being derived from the same two facts the backend uses, not by duplicating
// its branch list.
function resolveEffectiveAccount(integration, policy) {
  if (!policy?.shippingEnabled) return 'DISABLED'
  if (policy.sellerOwnAccountEnabled && integration?.isActive && integration.status === 'CONNECTED') return 'SELLER'
  if (policy.platformFallbackEnabled) return 'PLATFORM'
  return 'NONE'
}

// ---------------------------------------------------------------------------
// Pickup locations
// ---------------------------------------------------------------------------

export function usePickupLocationsController() {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: PICKUP_KEY, queryFn: fetchPickupLocations })
  const invalidate = () => queryClient.invalidateQueries({ queryKey: PICKUP_KEY })

  const createMutation = useMutation({ mutationFn: createPickupLocation, onSuccess: invalidate })
  const updateMutation = useMutation({ mutationFn: ({ id, body }) => updatePickupLocation(id, body), onSuccess: invalidate })
  const defaultMutation = useMutation({ mutationFn: setDefaultPickupLocation, onSuccess: invalidate })
  const registerMutation = useMutation({ mutationFn: registerPickupLocation, onSuccess: invalidate })
  const removeMutation = useMutation({ mutationFn: removePickupLocation, onSuccess: invalidate })

  const items = query.data?.items ?? []

  return {
    items,
    total: query.data?.total ?? 0,
    // False when the backend has not verified the carrier's add-location
    // endpoint. The UI must then tell the seller to register the address in
    // the Shiprocket panel instead of offering a button that returns 501.
    registrationSupported: query.data?.registrationSupported ?? false,
    // Only a REGISTERED location can ship. Surfaced separately because a
    // seller with three addresses and none registered gets a confusing
    // "no pickup location" error at shipment time otherwise.
    registered: items.filter((l) => l.registrationStatus === 'REGISTERED'),
    hasRegistered: items.some((l) => l.registrationStatus === 'REGISTERED'),

    isLoading: query.isLoading,
    error: query.error,

    addLocation: createMutation.mutateAsync,
    editLocation: (id, body) => updateMutation.mutateAsync({ id, body }),
    makeDefault: defaultMutation.mutateAsync,
    register: registerMutation.mutateAsync,
    isRegistering: registerMutation.isPending,
    registerError: registerMutation.error,
    removeLocation: removeMutation.mutateAsync,
    isSaving: createMutation.isPending || updateMutation.isPending,
    saveError: createMutation.error || updateMutation.error,
  }
}

// ---------------------------------------------------------------------------
// Shipment list
// ---------------------------------------------------------------------------

export const SHIPMENT_TABS = [
  { id: 'all', label: 'All' },
  { id: 'to_ship', label: 'To ship' },
  { id: 'in_transit', label: 'In transit' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'attention', label: 'Needs attention' },
  { id: 'returns', label: 'Returns' },
  { id: 'cancelled', label: 'Cancelled' },
]

export function useShipmentsController() {
  return useListController({ queryKey: SHIPMENTS_KEY, queryFn: fetchShipments, defaultTab: 'all' })
}

// The shipments already booked against ONE order. Used by the order drawer to
// answer "has this been shipped yet, and how?" without the seller having to
// leave for the shipping list and search for it.
export function useOrderShipmentsController(orderId) {
  const query = useQuery({
    queryKey: [...SHIPMENTS_KEY, 'by-order', orderId],
    queryFn: () => fetchShipments({ filters: { search: orderId }, page: 1, rowsPerPage: 50 }),
    enabled: Boolean(orderId),
  })

  return {
    shipments: query.data?.items ?? [],
    hasShipments: (query.data?.items?.length ?? 0) > 0,
    isLoading: query.isLoading,
    error: query.error,
  }
}

// ---------------------------------------------------------------------------
// One shipment: the create -> AWB -> pickup sequence, and its tracking
// ---------------------------------------------------------------------------

// `scope` selects which audience's routes to call: a vendor token is rejected
// by the admin routes and vice versa, and this controller backs a drawer that
// both panels render. It is part of the query key too, so an admin and a
// seller looking at the same shipment do not share a cache entry.
export function useShipmentController(shipmentId, { scope = 'vendor' } = {}) {
  const queryClient = useQueryClient()
  const enabled = Boolean(shipmentId)

  const shipmentQuery = useQuery({
    queryKey: [...SHIPMENTS_KEY, scope, shipmentId],
    queryFn: () => fetchShipment(shipmentId, scope),
    enabled,
  })

  const trackingQuery = useQuery({
    queryKey: [...SHIPMENTS_KEY, scope, shipmentId, 'tracking'],
    queryFn: () => fetchTracking(shipmentId, scope),
    // Only once there is an AWB: before that the carrier has nothing to say,
    // and the endpoint would answer with an empty timeline on every open.
    enabled: enabled && Boolean(shipmentQuery.data?.awbCode),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: SHIPMENTS_KEY })
    // The admin list lives under its own key, so a cancel from the admin
    // drawer has to refresh that too.
    queryClient.invalidateQueries({ queryKey: ['admin', 'shipping'] })
  }

  const awbMutation = useMutation({ mutationFn: (body) => assignAwb(shipmentId, body, scope), onSuccess: invalidate })
  const pickupMutation = useMutation({ mutationFn: () => schedulePickup(shipmentId, scope), onSuccess: invalidate })
  const refreshMutation = useMutation({ mutationFn: () => refreshTracking(shipmentId, scope), onSuccess: invalidate })
  const cancelMutation = useMutation({ mutationFn: (body) => cancelShipment(shipmentId, body, scope), onSuccess: invalidate })
  const returnMutation = useMutation({ mutationFn: (body) => createReturn(shipmentId, body, scope), onSuccess: invalidate })

  const shipment = shipmentQuery.data ?? null

  return {
    shipment,
    tracking: trackingQuery.data ?? null,
    isLoading: shipmentQuery.isLoading,
    error: shipmentQuery.error,

    // What the seller may do next, derived in one place so no button has to
    // re-derive the sequence. Mirrors the backend's preconditions; the backend
    // is still the authority and will refuse anything out of order.
    canAssignAwb: Boolean(shipment && !shipment.awbCode && !shipment.reconciliationRequired &&
      ['SHIPMENT_CREATED', 'COURIER_ASSIGNED'].includes(shipment.status)),
    canSchedulePickup: Boolean(shipment && shipment.awbCode && !shipment.pickupScheduledAt &&
      !shipment.reconciliationRequired && shipment.status === 'AWB_ASSIGNED'),
    // A timed-out create. Nothing may be retried until a human has checked the
    // carrier panel, or the retry creates a second real parcel.
    needsReconciliation: Boolean(shipment?.reconciliationRequired),

    // Cancelling is only meaningful before a courier physically has the
    // parcel. After that the instrument is an RTO, which the carrier drives.
    canCancel: Boolean(
      shipment &&
        !shipment.reconciliationRequired &&
        CANCELLABLE_STATUSES.includes(shipment.status)
    ),
    // A return is raised against a DELIVERED parcel, and only a forward one.
    canReturn: Boolean(shipment && shipment.shipmentType === 'FORWARD' && shipment.status === 'DELIVERED'),

    cancelShipment: cancelMutation.mutateAsync,
    isCancelling: cancelMutation.isPending,
    cancelError: cancelMutation.error,

    createReturn: returnMutation.mutateAsync,
    isCreatingReturn: returnMutation.isPending,
    returnError: returnMutation.error,

    assignAwb: awbMutation.mutateAsync,
    isAssigningAwb: awbMutation.isPending,
    awbError: awbMutation.error,

    schedulePickup: pickupMutation.mutateAsync,
    isSchedulingPickup: pickupMutation.isPending,
    pickupError: pickupMutation.error,

    refreshTracking: refreshMutation.mutateAsync,
    isRefreshing: refreshMutation.isPending,
    refreshError: refreshMutation.error,
    lastRefresh: refreshMutation.data ?? null,
  }
}

// ---------------------------------------------------------------------------
// Creating a shipment from an order
// ---------------------------------------------------------------------------

// Generates the key ONCE per attempt and reuses it across retries, which is the
// whole point: a retry with a fresh key is a second parcel. It is regenerated
// only after a success, or when the seller starts a different order.
function newIdempotencyKey() {
  const random =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, '')
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
  return `ship-${random}`.slice(0, 64)
}

export function useCreateShipmentController(orderId) {
  const queryClient = useQueryClient()
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey)
  const [confirmedPackage, setConfirmedPackage] = useState(null)

  // Decision B: the suggestion is a STARTING POINT the seller confirms. It is
  // fetched on demand, not on render, because it reads product dimensions and
  // the seller may never open this panel.
  const suggestionMutation = useMutation({
    mutationFn: () => suggestPackage(orderId),
    onSuccess: (data) => setConfirmedPackage(data.package),
  })

  const serviceabilityMutation = useMutation({ mutationFn: checkServiceability })

  const createMutation = useMutation({
    mutationFn: (body) => createShipment({ ...body, orderId, idempotencyKey }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SHIPMENTS_KEY })
      queryClient.invalidateQueries({ queryKey: ['vendor', 'orders'] })
      // A new attempt after a success is a genuinely new parcel and must not
      // reuse the key that created the last one.
      setIdempotencyKey(newIdempotencyKey())
    },
  })

  const suggestion = suggestionMutation.data ?? null

  // The seller edits dimensions; the volumetric and chargeable figures are
  // RECOMPUTED by the backend from what is sent, so the preview here is
  // advisory. It uses the divisor the backend reported, not a hardcoded 5000.
  const preview = useMemo(() => {
    if (!confirmedPackage) return null
    const divisor = confirmedPackage.volumetricDivisor || suggestion?.package?.volumetricDivisor || 5000
    const volumetric =
      (Number(confirmedPackage.lengthCm) * Number(confirmedPackage.breadthCm) * Number(confirmedPackage.heightCm)) / divisor
    const actual = Number(confirmedPackage.actualWeightKg) || 0
    if (!Number.isFinite(volumetric)) return null
    return {
      volumetricWeightKg: Math.round(volumetric * 1000) / 1000,
      chargeableWeightKg: Math.round(Math.max(actual, volumetric) * 1000) / 1000,
      divisor,
    }
  }, [confirmedPackage, suggestion])

  const updatePackageField = useCallback((field, value) => {
    setConfirmedPackage((current) => (current ? { ...current, [field]: value } : current))
  }, [])

  return {
    loadSuggestion: suggestionMutation.mutateAsync,
    isSuggesting: suggestionMutation.isPending,
    suggestionError: suggestionMutation.error,
    suggestion,
    // True when any figure came from a fallback rather than the product. The
    // screen turns this into "check these numbers", because the carrier bills
    // on them and a wrong weight is a real charge.
    isEstimate: Boolean(suggestion?.package?.isEstimate),

    confirmedPackage,
    updatePackageField,
    preview,

    checkServiceability: serviceabilityMutation.mutateAsync,
    isCheckingServiceability: serviceabilityMutation.isPending,
    serviceability: serviceabilityMutation.data ?? null,
    serviceabilityError: serviceabilityMutation.error,

    createShipment: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    createError: createMutation.error,
    createdShipment: createMutation.data ?? null,
  }
}

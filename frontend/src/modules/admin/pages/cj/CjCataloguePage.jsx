import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Badge, Button, Checkbox, Input, Modal, Pagination, Select, Skeleton } from '../../../../components/ui'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, InlineAlert, NoData, PageSkeleton } from '../../components/feedback'
import { SectionCard } from '../../components/display'
import { FormSection } from '../../components/forms'
import {
  useCjCatalogueSearchController,
  useCjCategoriesController,
  useCjProductDetailController,
  useCjOnboardingController,
  useCjBulkOnboardingController,
  useKrozendaCategoriesController,
  useCjSettingsController,
} from '../../controllers/useCjController'
import { flattenCjCategories, catalogPriceInr, USD_TO_INR_RATE, parseCjPrice } from '../../tableColumns/cjColumns'

// THE RULE THIS SCREEN EXISTS TO ENFORCE (master plan §2): this is a LIVE
// search against CJ every time — never a cached/imported catalogue. Nothing
// here is written to Krozenda's DB until the admin explicitly onboards one
// product from the detail modal.
//
// Every field this screen reads comes from the backend's normalized DTO
// (services/cj/cjProductAdapter.js) — never CJ's raw response shape. Search
// only fires on Enter/Search-click/category-change (never per keystroke),
// which is what actually avoids request-per-character here — a debounce
// timer would be solving a problem this screen doesn't have.

const PAGE_SIZE = 24

function OnboardModal({ product, variants, onClose }) {
  const { onboard, isOnboarding, error } = useCjOnboardingController()
  const categoriesQuery = useKrozendaCategoriesController()
  const settingsQuery = useCjSettingsController()
  const defaultMarkup = settingsQuery.data?.defaultMarkupPercent ?? 30

  const [krozendaCategoryId, setKrozendaCategoryId] = useState('')
  const [pricingMode, setPricingMode] = useState('AUTOMATIC')
  const [marginType, setMarginType] = useState('PERCENT')
  const [marginValue, setMarginValue] = useState(() => String(defaultMarkup))
  const [sellingPrice, setSellingPrice] = useState('')
  const [selectedVariantIds, setSelectedVariantIds] = useState(
    () => new Set((variants || []).map((v) => v.externalVariantId))
  )

  useEffect(() => {
    if (settingsQuery.data?.defaultMarkupPercent != null) {
      setMarginValue(String(settingsQuery.data.defaultMarkupPercent))
    }
  }, [settingsQuery.data?.defaultMarkupPercent])

  function calculatePreviewPrice(sourcePrice) {
    const usd = parseCjPrice(sourcePrice)
    const costInr = usd * USD_TO_INR_RATE
    if (pricingMode === 'MANUAL') return null
    const val = Number(marginValue) || 0
    const raw = marginType === 'FLAT' ? costInr + val : costInr + (costInr * (val / 100))
    return Math.round(raw)
  }

  const categoryOptions = (categoriesQuery.data || []).map((c) => ({ value: c._id, label: c.name }))
  const hasVariants = (variants || []).length > 0

  function toggleVariant(id) {
    setSelectedVariantIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSubmit() {
    await onboard({
      cjProductId: product.externalProductId,
      krozendaCategoryId,
      pricingMode,
      marginRule: pricingMode === 'AUTOMATIC' ? { type: marginType, value: Number(marginValue) || 0 } : null,
      sellingPrice: pricingMode === 'MANUAL' && !hasVariants ? Number(sellingPrice) || undefined : undefined,
      variantSelections: hasVariants
        ? (variants || [])
            .filter((v) => selectedVariantIds.has(v.externalVariantId))
            .map((v) => ({ cjVariantId: v.externalVariantId }))
        : null,
    })
    onClose(true)
  }

  return (
    <Modal
      isOpen
      onClose={() => onClose(false)}
      title="Onboard CJ product"
      description={product.title}
      size="lg"
      footer={
        <>
          <Button variant="secondary" size="control" onClick={() => onClose(false)}>
            Cancel
          </Button>
          <Button
            size="control"
            isLoading={isOnboarding}
            disabled={!krozendaCategoryId || (hasVariants && selectedVariantIds.size === 0)}
            onClick={handleSubmit}
          >
            Onboard product
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && (
          <InlineAlert tone="danger" title="Could not onboard this product">
            {error?.response?.data?.message || error.message}
          </InlineAlert>
        )}

        <FormSection title="Category mapping" columns={1}>
          <Select
            id="onboardCategory"
            label="Krozenda category"
            size="control"
            value={krozendaCategoryId}
            onChange={(e) => setKrozendaCategoryId(e.target.value)}
            options={[{ value: '', label: 'Select a category' }, ...categoryOptions]}
          />
        </FormSection>

        <FormSection title="Pricing" columns={2}>
          <Select
            id="onboardPricingMode"
            label="Pricing mode"
            size="control"
            value={pricingMode}
            onChange={(e) => setPricingMode(e.target.value)}
            options={[
              { value: 'AUTOMATIC', label: 'Automatic (cost + shipping + margin)' },
              { value: 'MANUAL', label: 'Manual' },
            ]}
          />
          {pricingMode === 'AUTOMATIC' ? (
            <div className="flex gap-2">
              <Select
                id="onboardMarginType"
                label="Margin type"
                size="control"
                value={marginType}
                onChange={(e) => setMarginType(e.target.value)}
                options={[
                  { value: 'PERCENT', label: 'Percent' },
                  { value: 'FLAT', label: 'Flat' },
                ]}
              />
              <Input
                id="onboardMarginValue"
                label={marginType === 'PERCENT' ? 'Margin %' : 'Margin ₹'}
                type="number"
                size="control"
                value={marginValue}
                onChange={(e) => setMarginValue(e.target.value)}
              />
            </div>
          ) : (
            !hasVariants && (
              <Input
                id="onboardSellingPrice"
                label="Selling price (₹)"
                type="number"
                size="control"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
              />
            )
          )}
        </FormSection>

        {hasVariants && (
          <FormSection title={`Variants (${selectedVariantIds.size}/${variants.length} selected)`} columns={1}>
            <div className="flex max-h-56 flex-col gap-2 overflow-y-auto">
              {variants.map((v) => (
                <Checkbox
                  key={v.externalVariantId}
                  id={`variant-${v.externalVariantId}`}
                  checked={selectedVariantIds.has(v.externalVariantId)}
                  onChange={() => toggleVariant(v.externalVariantId)}
                  label={v.title}
                  description={
                    calculatePreviewPrice(v.sourcePrice)
                      ? `CJ Cost ${catalogPriceInr(v.sourcePrice)} → Est. Selling Price ₹${calculatePreviewPrice(v.sourcePrice).toLocaleString('en-IN')}`
                      : `Cost ${catalogPriceInr(v.sourcePrice)}`
                  }
                />
              ))}
            </div>
          </FormSection>
        )}
      </div>
    </Modal>
  )
}

function ProductDetailModal({ productId, onClose }) {
  const { data, isLoading, error } = useCjProductDetailController(productId)
  const [onboardOpen, setOnboardOpen] = useState(false)

  return (
    <Modal isOpen onClose={onClose} title="CJ product detail" size="lg">
      {isLoading && <PageSkeleton rows={3} />}
      {error && <ErrorState error={error} />}
      {data && (
        <div className="flex flex-col gap-4">
          <div className="flex gap-4">
            {data.images?.[0] && (
              <img src={data.images[0]} alt="" className="h-24 w-24 rounded-md border border-border object-cover" />
            )}
            <div>
              <p className="text-sm font-semibold text-slate-900">{data.title}</p>
              <p className="mt-1 text-xs text-ink-subtle">CJ Product ID: {data.externalProductId}</p>
              <p className="text-xs text-ink-subtle">
                Cost {catalogPriceInr(data.sourcePrice)} · Category {data.sourceCategory?.name || '—'}
              </p>
            </div>
          </div>

          {data.images?.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {data.images.slice(0, 6).map((src) => (
                <img key={src} src={src} alt="" className="h-16 w-16 shrink-0 rounded-md border border-border object-cover" />
              ))}
            </div>
          )}

          {data.variants?.length > 0 && (
            <p className="text-xs text-ink-subtle">{data.variants.length} variant(s) available</p>
          )}

          <div className="flex justify-end">
            <Button size="control" onClick={() => setOnboardOpen(true)}>
              Onboard this product
            </Button>
          </div>
        </div>
      )}

      {onboardOpen && (
        <OnboardModal
          product={data}
          variants={data.variants}
          onClose={(onboarded) => {
            setOnboardOpen(false)
            if (onboarded) onClose()
          }}
        />
      )}
    </Modal>
  )
}

function BulkOnboardModal({ selectedProducts, onClose }) {
  const { bulkOnboard } = useCjBulkOnboardingController()
  const categoriesQuery = useKrozendaCategoriesController()
  const settingsQuery = useCjSettingsController()

  const defaultMarkup = settingsQuery.data?.defaultMarkupValue ?? settingsQuery.data?.defaultMarkupPercent ?? 30
  const defaultRounding = settingsQuery.data?.priceRounding || 'ROUND'
  const defaultType = settingsQuery.data?.defaultMarkupType || 'PERCENT'

  const [krozendaCategoryId, setKrozendaCategoryId] = useState('')
  const [markupType, setMarkupType] = useState(() => defaultType)
  const [markupValue, setMarkupValue] = useState(() => String(defaultMarkup))
  const [priceRounding, setPriceRounding] = useState(() => defaultRounding)
  const [resultSummary, setResultSummary] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: selectedProducts.length })
  const [itemStatuses, setItemStatuses] = useState({})
  const [processError, setProcessError] = useState(null)

  useEffect(() => {
    if (settingsQuery.data?.defaultMarkupType) {
      setMarkupType(settingsQuery.data.defaultMarkupType)
    }
    if (settingsQuery.data?.defaultMarkupValue != null) {
      setMarkupValue(String(settingsQuery.data.defaultMarkupValue))
    } else if (settingsQuery.data?.defaultMarkupPercent != null) {
      setMarkupValue(String(settingsQuery.data.defaultMarkupPercent))
    }
    if (settingsQuery.data?.priceRounding) {
      setPriceRounding(settingsQuery.data.priceRounding)
    }
  }, [settingsQuery.data])

  const categoryOptions = (categoriesQuery.data || []).map((c) => ({ value: c._id, label: c.name }))

  function calculatePreviewPrice(sourcePrice) {
    const usd = parseCjPrice(sourcePrice)
    const costInr = usd * USD_TO_INR_RATE
    const val = Number(markupValue) || 0
    const raw = markupType === 'FLAT' ? costInr + val : costInr + (costInr * (val / 100))
    if (priceRounding === 'ROUND') return Math.round(raw)
    if (priceRounding === '9_ENDING') {
      const r = Math.round(raw)
      return r < 10 ? r : Math.floor(r / 10) * 10 + 9
    }
    return Math.round(raw * 100) / 100
  }

  async function handleBulkOnboard() {
    setIsProcessing(true)
    setProcessError(null)

    // Process in small batches of 2 items to ensure super-fast responses and avoid browser timeouts
    const CHUNK_SIZE = 2
    const chunks = []
    for (let i = 0; i < selectedProducts.length; i += CHUNK_SIZE) {
      chunks.push(selectedProducts.slice(i, i + CHUNK_SIZE))
    }

    const allSucceeded = []
    const allFailed = []
    let completedCount = 0

    const initialStatus = {}
    selectedProducts.forEach((p) => {
      initialStatus[p.externalProductId] = 'queued'
    })
    setItemStatuses(initialStatus)

    for (const chunk of chunks) {
      setItemStatuses((prev) => {
        const next = { ...prev }
        chunk.forEach((p) => {
          next[p.externalProductId] = 'importing'
        })
        return next
      })

      try {
        const res = await bulkOnboard({
          cjProductIds: chunk.map((p) => p.externalProductId),
          krozendaCategoryId,
          markupType,
          markupValue: Number(markupValue) || 0,
          markupPercent: markupType === 'PERCENT' ? Number(markupValue) || 30 : undefined,
          priceRounding,
        })

        const data = res?.data || {}
        const succ = data.succeeded || []
        const fail = data.failed || []

        allSucceeded.push(...succ)
        allFailed.push(...fail)

        setItemStatuses((prev) => {
          const next = { ...prev }
          succ.forEach((s) => {
            next[s.cjProductId] = 'success'
          })
          fail.forEach((f) => {
            next[f.cjProductId] = 'failed'
          })
          return next
        })
      } catch (err) {
        chunk.forEach((p) => {
          allFailed.push({
            cjProductId: p.externalProductId,
            reason: err?.response?.data?.message || err.message || 'Import failed',
          })
        })
        setItemStatuses((prev) => {
          const next = { ...prev }
          chunk.forEach((p) => {
            next[p.externalProductId] = 'failed'
          })
          return next
        })
      }

      completedCount += chunk.length
      setProgress({ done: Math.min(completedCount, selectedProducts.length), total: selectedProducts.length })
    }

    setIsProcessing(false)
    setResultSummary({
      total: selectedProducts.length,
      succeededCount: allSucceeded.length,
      failedCount: allFailed.length,
      succeeded: allSucceeded,
      failed: allFailed,
    })
  }

  if (resultSummary) {
    return (
      <Modal
        isOpen
        onClose={() => onClose(true)}
        title="Bulk Onboarding Complete"
        description="Here is the summary of your bulk product import."
        size="lg"
        footer={
          <Button size="control" onClick={() => onClose(true)}>
            Done
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
            <span className="text-2xl">🎉</span>
            <div>
              <p className="font-semibold text-sm">
                {resultSummary.succeededCount} of {resultSummary.total} Products Onboarded Successfully
              </p>
              <p className="text-xs text-emerald-700 mt-0.5">
                Imported items are now in your catalog with {markupType === 'PERCENT' ? `${markupValue}%` : `₹${markupValue}`} automated markup applied.
              </p>
            </div>
          </div>

          {resultSummary.failedCount > 0 && (
            <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="font-semibold text-amber-950">{resultSummary.failedCount} Skipped or Failed:</p>
              <div className="max-h-40 overflow-y-auto divide-y divide-amber-200/60">
                {resultSummary.failed.map((f, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 gap-2">
                    <span className="font-mono text-2xs text-amber-800">{f.cjProductId}</span>
                    <span className="text-2xs font-medium text-amber-700">{f.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      isOpen
      onClose={() => !isProcessing && onClose(false)}
      title="Bulk Onboard CJ Products"
      description={`Import ${selectedProducts.length} selected product(s) into your Krozenda catalog with automated markup.`}
      size="xl"
      footer={
        <>
          <Button variant="secondary" size="control" onClick={() => onClose(false)} disabled={isProcessing}>
            Cancel
          </Button>
          <Button
            size="control"
            isLoading={isProcessing}
            disabled={!krozendaCategoryId || selectedProducts.length === 0 || isProcessing}
            onClick={handleBulkOnboard}
          >
            {isProcessing
              ? `Importing (${progress.done}/${progress.total})...`
              : `Onboard ${selectedProducts.length} Products`}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {processError && (
          <InlineAlert tone="danger" title="Could not complete bulk onboarding">
            {processError}
          </InlineAlert>
        )}

        {/* Live Progress Bar during execution */}
        {isProcessing && (
          <div className="rounded-xl border border-primary-200 bg-primary-50/70 p-4 shadow-sm transition-all animate-in fade-in">
            <div className="flex items-center justify-between text-xs font-bold text-primary-900 mb-2">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary-600" />
                </span>
                <span>Importing Products into Krozenda...</span>
              </div>
              <span className="font-mono">
                {progress.done} of {progress.total} ({Math.round((progress.done / progress.total) * 100)}%)
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-primary-100">
              <div
                className="h-full bg-primary-600 transition-all duration-300 rounded-full"
                style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
              />
            </div>
          </div>
        )}

        <FormSection title="Target Category" columns={1}>
          <Select
            id="bulkOnboardCategory"
            label="Krozenda Category"
            size="control"
            disabled={isProcessing}
            value={krozendaCategoryId}
            onChange={(e) => setKrozendaCategoryId(e.target.value)}
            options={[{ value: '', label: 'Select a category for all selected items' }, ...categoryOptions]}
          />
        </FormSection>

        <FormSection title="Automated Pricing Rules" columns={2}>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="bulkMarkupValue" className="text-xs font-semibold text-slate-700">
                {markupType === 'PERCENT' ? 'Markup Percentage (%)' : 'Flat Markup Amount (₹)'}
              </label>
              <div className="inline-flex rounded-lg border border-border p-0.5 bg-surface-muted">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => {
                    if (markupType !== 'PERCENT') {
                      setMarkupType('PERCENT')
                      setMarkupValue('30')
                    }
                  }}
                  className={`px-2.5 py-0.5 text-2xs font-semibold rounded-md transition ${
                    markupType === 'PERCENT'
                      ? 'bg-primary-600 text-white shadow-xs'
                      : 'text-ink-subtle hover:text-slate-900'
                  }`}
                >
                  % Percent
                </button>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => {
                    if (markupType !== 'FLAT') {
                      setMarkupType('FLAT')
                      setMarkupValue('150')
                    }
                  }}
                  className={`px-2.5 py-0.5 text-2xs font-semibold rounded-md transition ${
                    markupType === 'FLAT'
                      ? 'bg-primary-600 text-white shadow-xs'
                      : 'text-ink-subtle hover:text-slate-900'
                  }`}
                >
                  ₹ Flat
                </button>
              </div>
            </div>

            <Input
              id="bulkMarkupValue"
              type="number"
              min="0"
              max="50000"
              size="control"
              disabled={isProcessing}
              value={markupValue}
              onChange={(e) => setMarkupValue(e.target.value)}
            />

            <div className="mt-2 flex flex-wrap gap-1">
              {markupType === 'PERCENT'
                ? [15, 20, 25, 30, 40, 50].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      disabled={isProcessing}
                      onClick={() => setMarkupValue(String(preset))}
                      className={`rounded border px-2 py-0.5 text-2xs font-medium transition ${
                        Number(markupValue) === preset
                          ? 'border-primary-500 bg-primary-50 text-primary-700 font-semibold'
                          : 'border-border bg-surface text-ink-subtle hover:bg-surface-muted'
                      }`}
                    >
                      +{preset}%
                    </button>
                  ))
                : [50, 100, 150, 200, 300, 500].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      disabled={isProcessing}
                      onClick={() => setMarkupValue(String(preset))}
                      className={`rounded border px-2 py-0.5 text-2xs font-medium transition ${
                        Number(markupValue) === preset
                          ? 'border-primary-500 bg-primary-50 text-primary-700 font-semibold'
                          : 'border-border bg-surface text-ink-subtle hover:bg-surface-muted'
                      }`}
                    >
                      +₹{preset}
                    </button>
                  ))}
            </div>
          </div>

          <div>
            <Select
              id="bulkRounding"
              label="Price Rounding"
              size="control"
              disabled={isProcessing}
              value={priceRounding}
              onChange={(e) => setPriceRounding(e.target.value)}
              options={[
                { value: 'ROUND', label: 'Round to Nearest Whole (e.g. ₹649)' },
                { value: '9_ENDING', label: 'Charm Pricing (e.g. ₹649 / .99)' },
                { value: 'NONE', label: 'Exact Decimals (e.g. ₹648.70)' },
              ]}
            />
            <p className="mt-2 text-2xs text-ink-subtle">
              {markupType === 'PERCENT'
                ? `Formula: Selling Price = CJ Cost + (CJ Cost × ${markupValue || 0}%)`
                : `Formula: Selling Price = CJ Cost + ₹${markupValue || 0} (Flat Markup)`}
            </p>
          </div>
        </FormSection>

        <FormSection title={`Selected Products Preview (${selectedProducts.length})`} columns={1}>
          <div className="max-h-60 overflow-y-auto rounded-lg border border-border divide-y divide-border">
            {selectedProducts.map((p) => {
              const previewPrice = calculatePreviewPrice(p.sourcePrice)
              const status = itemStatuses[p.externalProductId]

              return (
                <div key={p.externalProductId} className="flex items-center justify-between p-2.5 gap-3 hover:bg-surface-muted/50">
                  <div className="flex items-center gap-3 min-w-0">
                    {p.primaryImage ? (
                      <img src={p.primaryImage} alt="" className="h-10 w-10 shrink-0 rounded object-cover border border-border" />
                    ) : (
                      <div className="h-10 w-10 shrink-0 rounded bg-slate-100" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-slate-900">{p.title}</p>
                      <p className="text-2xs text-ink-subtle font-mono">{p.externalProductId}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-0.5">
                    <p className="text-2xs text-ink-subtle">CJ Cost: {catalogPriceInr(p.sourcePrice)}</p>
                    {isProcessing || status ? (
                      status === 'importing' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-2xs font-bold text-primary-700 border border-primary-200 animate-pulse">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary-600 animate-ping" />
                          Importing...
                        </span>
                      ) : status === 'success' ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-2xs font-bold text-emerald-700 border border-emerald-200">
                          ✓ Imported
                        </span>
                      ) : status === 'failed' ? (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-2xs font-medium text-amber-800 border border-amber-200">
                          ⚠️ Skipped
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-2xs text-slate-500">
                          ⏳ Queued
                        </span>
                      )
                    ) : (
                      <p className="text-xs font-bold text-emerald-600">
                        Est. ₹{previewPrice?.toLocaleString('en-IN')}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </FormSection>
      </div>
    </Modal>
  )
}

function ProductCard({ product, isSelected, onToggleSelect, onView }) {
  const isOnboarded = product.isOnboarded === true

  return (
    <div
      onClick={onView}
      className={`group relative flex flex-col overflow-hidden rounded-lg border text-left transition-all cursor-pointer ${
        isSelected
          ? 'border-primary-500 ring-2 ring-primary-500 bg-primary-50/10 shadow-md'
          : 'border-border bg-surface hover:shadow-md hover:border-slate-300'
      } ${isOnboarded ? 'opacity-75' : ''}`}
    >
      {/* Checkbox overlay button with stopPropagation — disabled once a
          product is already onboarded, so it can't be selected for bulk
          onboarding again (backend rejects it anyway, this just avoids the
          round trip and confusion of a guaranteed "already onboarded" error). */}
      <div
        className={`absolute top-2.5 left-2.5 z-10 flex items-center justify-center rounded-md bg-white/95 p-1 shadow-sm backdrop-blur-sm transition-opacity ${
          isOnboarded ? 'cursor-not-allowed' : ''
        }`}
        onClick={(e) => {
          e.stopPropagation()
          if (!isOnboarded) onToggleSelect()
        }}
      >
        <input
          type="checkbox"
          id={`select-cj-${product.externalProductId}`}
          checked={isSelected}
          disabled={isOnboarded}
          onChange={() => {}}
          className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 cursor-pointer pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      {isOnboarded && (
        <div className="absolute top-2.5 right-2.5 z-10">
          <Badge tone="neutral" size="sm">
            Already onboarded
          </Badge>
        </div>
      )}

      <div className="aspect-square w-full bg-surface-muted overflow-hidden">
        {product.primaryImage && (
          <img
            src={product.primaryImage}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        )}
      </div>
      <div className="flex flex-col gap-1 p-3">
        <p className="line-clamp-2 text-xs font-medium text-slate-900 group-hover:text-primary-600 transition-colors">
          {product.title}
        </p>
        <p className="text-2xs text-ink-subtle">{product.sourceCategory?.name || '—'}</p>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-900">{catalogPriceInr(product.sourcePrice)}</span>
          {product.isFreeShipping && (
            <Badge tone="success" size="sm">
              Free shipping
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}

// Mirrors ProductCard's exact layout (image square, title, subtitle, price
// row) so the loading state doesn't jump/reflow once real cards swap in.
function ProductCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="flex flex-col gap-2 p-3">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-2.5 w-1/3" />
        <Skeleton className="mt-1 h-4 w-1/2" />
      </div>
    </div>
  )
}

function ProductGridSkeleton({ count = PAGE_SIZE }) {
  return (
    <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function CjCataloguePage() {
  // The Category screen links here with ?categoryId=<cj leaf id> so opening
  // a category from there lands with that filter already applied instead of
  // an admin having to find it again in the dropdown.
  const [searchParams] = useSearchParams()
  const [keyword, setKeyword] = useState('')
  const [keywordInput, setKeywordInput] = useState('')
  const [categoryId, setCategoryId] = useState(() => searchParams.get('categoryId') || '')
  const [pageNum, setPageNum] = useState(1)
  const [openProductId, setOpenProductId] = useState(null)
  const [selectedProductIds, setSelectedProductIds] = useState(() => new Set())
  const [bulkOnboardOpen, setBulkOnboardOpen] = useState(false)

  const { data: categoryTree } = useCjCategoriesController()
  const categoryLeaves = flattenCjCategories(categoryTree)

  // React Router keeps this component mounted across a ?categoryId= change
  // (same route, only the query string differs), so the lazy useState
  // initializer above only fires once — this render-phase adjustment (same
  // pattern as CatalogFilterPanel's draft/applied sync) is what makes
  // clicking a DIFFERENT category link from the Category screen, while
  // already on this page, actually update the filter instead of doing
  // nothing. A plain effect would do the same update one render late.
  const categoryIdFromUrl = searchParams.get('categoryId') || ''
  const [syncedUrlCategoryId, setSyncedUrlCategoryId] = useState(categoryIdFromUrl)
  if (categoryIdFromUrl && categoryIdFromUrl !== syncedUrlCategoryId) {
    setSyncedUrlCategoryId(categoryIdFromUrl)
    setCategoryId(categoryIdFromUrl)
    setSelectedProductIds(new Set())
    setPageNum(1)
  }

  const { data, isLoading, isFetching, error, refetch } = useCjCatalogueSearchController({
    keyword: keyword || undefined,
    categoryId: categoryId || undefined,
    page: pageNum,
    limit: PAGE_SIZE,
  })

  const items = data?.items || []
  const pagination = data?.pagination || { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 }

  // Already-onboarded products (server-flagged via ProductFulfillmentMapping,
  // see adminCjCatalogueController.searchProducts) are excluded from
  // "select all" and can't be individually selected — see ProductCard's
  // disabled checkbox.
  const selectableItems = items.filter((p) => !p.isOnboarded)
  const allCurrentPageSelected =
    selectableItems.length > 0 && selectableItems.every((p) => selectedProductIds.has(p.externalProductId))
  const someCurrentPageSelected = selectableItems.some((p) => selectedProductIds.has(p.externalProductId))

  function toggleSelectAllCurrentPage() {
    setSelectedProductIds((prev) => {
      const next = new Set(prev)
      if (allCurrentPageSelected) {
        selectableItems.forEach((p) => next.delete(p.externalProductId))
      } else {
        selectableItems.forEach((p) => next.add(p.externalProductId))
      }
      return next
    })
  }

  function toggleProductSelect(id) {
    const product = items.find((p) => p.externalProductId === id)
    if (product?.isOnboarded) return
    setSelectedProductIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function runSearch() {
    setSelectedProductIds(new Set())
    setKeyword(keywordInput)
    setPageNum(1)
  }

  const selectedProductsList = items.filter((p) => selectedProductIds.has(p.externalProductId))

  return (
    <PageBody>
      <PageHeader
        title="CJ Catalogue"
        description="Live search against CJ Dropshipping — every card here comes straight from CJ's API, nothing is imported until you onboard it."
      />

      <SectionCard title="Search">
        <div className="flex flex-wrap items-end gap-3 p-4">
          <Input
            id="cjKeyword"
            label="Keyword"
            size="control"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            containerClassName="w-56"
          />
          <Select
            id="cjCategoryFilter"
            label="Category"
            size="control"
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value)
              setSelectedProductIds(new Set())
              setPageNum(1)
            }}
            options={[{ value: '', label: 'All categories' }, ...categoryLeaves]}
            containerClassName="w-72"
          />
          <Button size="control" isLoading={isFetching} onClick={runSearch}>
            Search
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        title="Products"
        description={data ? `${pagination.total.toLocaleString('en-IN')} matches on CJ` : undefined}
      >
        {items.length > 0 && (
          <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2.5 bg-surface-muted/30">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allCurrentPageSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someCurrentPageSelected && !allCurrentPageSelected
                }}
                onChange={toggleSelectAllCurrentPage}
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
              />
              <span>Select all on this page ({selectableItems.length})</span>
            </label>

            {selectedProductIds.size > 0 && (
              <span className="text-xs font-semibold text-primary-700 bg-primary-50 px-2.5 py-0.5 rounded-full border border-primary-200">
                {selectedProductIds.size} selected
              </span>
            )}
          </div>
        )}

        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : isLoading ? (
          <ProductGridSkeleton />
        ) : items.length === 0 ? (
          <NoData message="No CJ products found" hint="Try a different keyword or category." />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {items.map((product) => (
                <ProductCard
                  key={product.externalProductId}
                  product={product}
                  isSelected={selectedProductIds.has(product.externalProductId)}
                  onToggleSelect={() => toggleProductSelect(product.externalProductId)}
                  onView={() => setOpenProductId(product.externalProductId)}
                />
              ))}
            </div>
            <div className="border-t border-border-subtle p-3">
              <Pagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                totalItems={pagination.total}
                rowsPerPage={pagination.limit}
                onPageChange={(p) => {
                  setSelectedProductIds(new Set())
                  setPageNum(p)
                }}
                itemLabel="products"
              />
            </div>
          </>
        )}
      </SectionCard>

      {/* Floating Batch Action Bar */}
      {selectedProductIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 rounded-2xl border border-slate-700 bg-slate-900/95 px-5 py-3 text-white shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-500 text-xs font-bold text-white">
              {selectedProductIds.size}
            </span>
            <span className="text-sm font-medium">Products Selected</span>
          </div>
          <div className="h-4 w-px bg-slate-700" />
          <Button
            variant="secondary"
            size="sm"
            className="!border-slate-600 !bg-slate-800 !text-slate-200 hover:!bg-slate-700"
            onClick={() => setSelectedProductIds(new Set())}
          >
            Clear
          </Button>
          <Button
            size="sm"
            className="!bg-primary-600 !text-white hover:!bg-primary-500 font-semibold shadow-sm"
            onClick={() => setBulkOnboardOpen(true)}
          >
            🚀 Bulk Onboard ({selectedProductIds.size})
          </Button>
        </div>
      )}

      {openProductId && (
        <ProductDetailModal productId={openProductId} onClose={() => setOpenProductId(null)} />
      )}

      {bulkOnboardOpen && (
        <BulkOnboardModal
          selectedProducts={selectedProductsList}
          onClose={(refetchNeeded) => {
            setBulkOnboardOpen(false)
            if (refetchNeeded) {
              setSelectedProductIds(new Set())
              refetch()
            }
          }}
        />
      )}
    </PageBody>
  )
}

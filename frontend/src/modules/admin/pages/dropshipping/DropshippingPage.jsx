import { useState } from 'react'
import { Badge, Button, Card, CardBody, EmptyState, Icon, Input, Select, Switch, Tabs } from '../../../../components/ui'
import { PageBody, PageHeader } from '../../components/shell'
import { InlineAlert } from '../../components/feedback'
import {
  useImportedProductsController,
  useShopifyCatalogueController,
  useShopifyConnectionController,
  useShopifyFulfilmentController,
  useShopifyMoneyController,
} from '../../controllers/useShopifyController'
import { FulfilmentTab } from './FulfilmentTab'
import { MoneyTab } from './MoneyTab'

// Admin > Dropshipping.
//
// Two halves of one job, so they are two tabs on one screen rather than two
// screens: "Shopify catalogue" is what the connected store has, and "Review &
// publish" is what has been brought across and is waiting on a decision.
//
// Nothing imported here reaches a customer until an admin publishes it. That
// is the whole point of the screen: an import is a draft, and the price is the
// admin's to set before anyone can buy it.

const money = (n) =>
  typeof n === 'number' && Number.isFinite(n)
    ? `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
    : '—'

// ---------------------------------------------------------------------------
function ConnectionBar({ connection }) {
  const { settings, connected, testConnection, isTesting, setVisibility, isSavingVisibility } = connection
  if (!settings) return null

  return (
    <Card>
      <CardBody className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Badge tone={connected ? 'success' : 'danger'}>{connected ? 'Connected' : 'Not connected'}</Badge>
          <div className="text-sm">
            <div className="font-medium text-slate-800">{settings.shopDomain || 'No store connected'}</div>
            <div className="text-slate-500">
              {settings.shopCurrency || '—'}
              {settings.primaryLocationName ? ` · ${settings.primaryLocationName}` : ''}
              {settings.apiVersion ? ` · API ${settings.apiVersion}` : ''}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <Switch
              id="shopify-storefront-visible"
              checked={settings.storefrontVisible !== false}
              onChange={(event) => setVisibility(event.target.checked)}
              disabled={isSavingVisibility}
            />
            Visible to customers
          </label>
          <Button variant="secondary" onClick={() => testConnection()} loading={isTesting}>
            Test connection
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

// ---------------------------------------------------------------------------
function CatalogueTab({ catalogue }) {
  const {
    products,
    isLoading,
    isFetching,
    error,
    counts,
    categories,
    search,
    setSearch,
    hasNextPage,
    hasPrevPage,
    nextPage,
    prevPage,
    selection,
    selectedIds,
    toggleSelect,
    setSelectionField,
    clearSelection,
    importSelected,
    isImporting,
  } = catalogue

  const [searchDraft, setSearchDraft] = useState(search)

  if (error) {
    return (
      <InlineAlert tone="danger" title="Could not read the Shopify catalogue">
        {error?.response?.data?.message || error.message}
      </InlineAlert>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Input
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setSearch(searchDraft)}
            placeholder="Search the Shopify store…"
            className="w-72"
          />
          <Button variant="secondary" onClick={() => setSearch(searchDraft)}>
            Search
          </Button>
        </div>

        {counts && (
          <div className="text-sm text-slate-600">
            <span className="font-medium text-slate-800">{counts.shopifyProducts ?? '—'}</span> in Shopify ·{' '}
            <span className="font-medium text-slate-800">{counts.imported ?? 0}</span> already imported
          </div>
        )}
      </div>

      {selectedIds.length > 0 && (
        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-700">
              <span className="font-medium">{selectedIds.length}</span> selected. They import as drafts — nothing
              reaches customers until you publish.
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={clearSelection}>
                Clear
              </Button>
              <Button onClick={() => importSelected({ activate: false })} loading={isImporting}>
                Import for review
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {isLoading ? (
        <div className="py-12 text-center text-slate-500">Loading the Shopify catalogue…</div>
      ) : products.length === 0 ? (
        <EmptyState
          icon="products"
          title="Nothing in the Shopify store"
          description="Products added to the connected Shopify store appear here, ready to bring into Krozenda."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => {
            const picked = Boolean(selection[product.id])
            return (
              <Card key={product.id} className={picked ? 'ring-2 ring-indigo-500' : ''}>
                <CardBody className="space-y-3">
                  <div className="flex gap-3">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                      {product.image ? (
                        <img src={product.image} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-slate-400">
                          <Icon name="products" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-slate-800" title={product.title}>
                        {product.title}
                      </div>
                      <div className="mt-1 text-sm text-slate-600">
                        {money(product.priceFrom)}
                        {product.priceTo > product.priceFrom ? ` – ${money(product.priceTo)}` : ''}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {/* Which dropshipping app supplies this. With more
                            than one feeding the store, it is the first thing
                            needed to chase a problem. */}
                        <Badge tone={product.supplier === 'UNKNOWN' ? 'warning' : 'brand'}>
                          {product.supplierLabel}
                        </Badge>
                        {product.imported ? (
                          <Badge tone="success">Imported</Badge>
                        ) : (
                          <Badge tone="neutral">{product.variantCount} variant(s)</Badge>
                        )}
                        {/* Stock is the single most useful fact here: a
                            product at zero can be imported, but nobody can
                            buy it until the supplier restocks. */}
                        <Badge tone={product.totalInventory > 0 ? 'neutral' : 'warning'}>
                          {product.totalInventory > 0 ? `${product.totalInventory} in stock` : 'No stock'}
                        </Badge>
                        {product.unitCost != null && <Badge tone="neutral">cost {money(product.unitCost)}</Badge>}
                      </div>
                    </div>
                  </div>

                  {product.imported ? (
                    <div className="text-sm text-slate-500">Already in Krozenda — manage it under Review &amp; publish.</div>
                  ) : picked ? (
                    <div className="space-y-2 border-t border-slate-100 pt-3">
                      {product.productTypeHint && (
                        <p className="text-xs text-slate-500">
                          Supplier calls this <span className="font-medium">{product.productTypeHint}</span>
                        </p>
                      )}
                      <Select
                        label="Krozenda category"
                        value={selection[product.id]?.categoryId || ''}
                        onChange={(e) => setSelectionField(product.id, 'categoryId', e.target.value)}
                        options={[
                          { value: '', label: 'Choose a category…' },
                          ...categories.map((c) => ({ value: c.id, label: c.name })),
                        ]}
                      />
                      <Input
                        label="Sell on Krozenda for"
                        type="number"
                        min="0"
                        step="0.01"
                        value={selection[product.id]?.sellingPrice ?? ''}
                        onChange={(e) => setSelectionField(product.id, 'sellingPrice', e.target.value)}
                        description={
                          product.unitCost != null
                            ? `Supplier charges ${money(product.unitCost)}. Shopify lists it at ${money(product.priceFrom)}.`
                            : `Shopify lists it at ${money(product.priceFrom)}.`
                        }
                      />
                      <Button variant="ghost" className="w-full" onClick={() => toggleSelect(product)}>
                        Deselect
                      </Button>
                    </div>
                  ) : (
                    <Button variant="secondary" className="w-full" onClick={() => toggleSelect(product)}>
                      Select to import
                    </Button>
                  )}
                </CardBody>
              </Card>
            )
          })}
        </div>
      )}

      {/* Shopify pages by cursor, so there is no page number to show and no
          way to jump — only forward and back. */}
      <div className="flex items-center justify-between">
        <Button variant="secondary" onClick={prevPage} disabled={!hasPrevPage || isFetching}>
          Previous
        </Button>
        <span className="text-sm text-slate-500">{isFetching ? 'Loading…' : ''}</span>
        <Button variant="secondary" onClick={nextPage} disabled={!hasNextPage || isFetching}>
          Next
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
function ReviewRow({ row, categories, controller }) {
  const [price, setPrice] = useState(String(row.price ?? ''))
  const [categoryId, setCategoryId] = useState('')
  const dirty = Number(price) !== Number(row.price) || Boolean(categoryId)
  const outOfStock = (row.stock ?? 0) <= 0

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex gap-3">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100">
            {row.image ? <img src={row.image} alt="" className="h-full w-full object-cover" /> : null}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium text-slate-800">{row.name}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              <Badge tone={row.isActive ? 'success' : 'neutral'}>{row.isActive ? 'Live' : 'Draft'}</Badge>
              <Badge tone={row.supplier === 'UNKNOWN' ? 'warning' : 'brand'}>{row.supplierLabel}</Badge>
              <Badge tone={outOfStock ? 'warning' : 'neutral'}>
                {outOfStock ? 'No stock' : `${row.stock} in stock`}
              </Badge>
              {row.category && <Badge tone="neutral">{row.category}</Badge>}
              {row.variantCount > 0 && <Badge tone="neutral">{row.variantCount} variants</Badge>}
            </div>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            label="Selling price"
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <Select
            label="Move to category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            options={[
              { value: '', label: `Keep ${row.category || 'current'}` },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={!dirty || controller.isSaving}
            onClick={() =>
              controller.save({
                productId: row.productId,
                price: Number(price),
                ...(categoryId ? { categoryId } : {}),
              })
            }
          >
            Save
          </Button>

          {row.isActive ? (
            <Button variant="ghost" onClick={() => controller.unpublish(row.productId)} disabled={controller.isSaving}>
              Hide from customers
            </Button>
          ) : (
            <Button
              onClick={() => controller.publish(row.productId, outOfStock ? { allowOutOfStock: true } : {})}
              disabled={controller.isSaving}
            >
              {outOfStock ? 'Publish anyway' : 'Publish'}
            </Button>
          )}

          <Button
            variant="ghost"
            className="text-rose-600"
            onClick={() => controller.remove(row.productId)}
            disabled={controller.isRemoving}
          >
            Remove
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

function ReviewTab({ imported }) {
  const { rows, stats, isLoading, error, categories } = imported
  const draftIds = rows.filter((r) => !r.isActive).map((r) => r.productId)

  if (error) {
    return (
      <InlineAlert tone="danger" title="Could not load imported products">
        {error?.response?.data?.message || error.message}
      </InlineAlert>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ['Imported', stats.total, 'neutral'],
          ['Live', stats.live, 'success'],
          ['Draft', stats.draft, 'neutral'],
          ['No stock', stats.outOfStock, 'warning'],
        ].map(([label, value, tone]) => (
          <Card key={label}>
            <CardBody>
              <div className="text-sm text-slate-500">{label}</div>
              <div className={`mt-1 text-2xl font-semibold ${tone === 'warning' ? 'text-amber-600' : 'text-slate-800'}`}>
                {value}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {draftIds.length > 0 && (
        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-700">
              <span className="font-medium">{draftIds.length}</span> product(s) waiting for review.
            </div>
            <Button
              variant="secondary"
              onClick={() => imported.bulkPublish(draftIds)}
              loading={imported.isBulkSaving}
            >
              Publish all with stock
            </Button>
          </CardBody>
        </Card>
      )}

      {isLoading ? (
        <div className="py-12 text-center text-slate-500">Loading…</div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon="products"
          title="Nothing imported yet"
          description="Bring products across from the Shopify catalogue tab. They arrive as drafts for you to price and publish."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((row) => (
            <ReviewRow key={row.productId} row={row} categories={categories} controller={imported} />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
export function DropshippingPage() {
  const connection = useShopifyConnectionController()
  const catalogue = useShopifyCatalogueController()
  const imported = useImportedProductsController()
  const fulfilment = useShopifyFulfilmentController()
  const money = useShopifyMoneyController()
  const [tab, setTab] = useState('catalogue')

  // The one state worth interrupting for: orders are reaching the supplier
  // but nothing is coming back, so tracking will never appear.
  const webhooksBroken = fulfilment.webhooks && fulfilment.webhooks.healthy === false

  return (
    <>
      <PageHeader
        title="Dropshipping"
        description="Products from your connected Shopify store. Import them, set what you sell them for, and publish when you are ready."
      />
      <PageBody>
        <div className="space-y-5">
          <ConnectionBar connection={connection} />

          {connection.settings && !connection.connected && (
            <InlineAlert tone="warning" title="Shopify is not connected">
              {connection.settings.failureReason ||
                'Connect the store under Settings before importing products.'}
            </InlineAlert>
          )}

          {webhooksBroken && (
            <InlineAlert tone="danger" title="Shopify is not sending updates back">
              Orders will reach your supplier, but tracking numbers and delivery status will never arrive. Fix it under
              Orders &amp; delivery.
            </InlineAlert>
          )}

          {connection.settings?.storefrontVisible === false && (
            <InlineAlert tone="warning" title="Hidden from customers">
              Dropshipping products are switched off for the storefront, so published products still will not appear.
            </InlineAlert>
          )}

          <Tabs
            activeId={tab}
            onChange={setTab}
            items={[
              { id: 'catalogue', label: 'Shopify catalogue' },
              { id: 'review', label: 'Review & publish', count: imported.stats.draft || undefined },
              { id: 'fulfilment', label: 'Orders & delivery' },
              { id: 'money', label: 'Money', count: money.exceptionCount || undefined },
            ]}
          />

          {tab === 'catalogue' && <CatalogueTab catalogue={catalogue} />}
          {tab === 'review' && <ReviewTab imported={imported} />}
          {tab === 'fulfilment' && <FulfilmentTab controller={fulfilment} />}
          {tab === 'money' && <MoneyTab controller={money} />}
        </div>
      </PageBody>
    </>
  )
}

export default DropshippingPage

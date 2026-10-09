import { useState } from 'react'
import { toast } from '../../../lib/toast'
import { colors } from '../../../theme'
import { useVendorCatalogCategoriesController } from '../controllers/useVendorController'
import { VendorCategoryFormDrawer } from '../components/catalog/VendorCatalogForms'
import { CatalogBrowser } from '../components/catalog/CatalogBrowser'
import { appendFile } from '../lib/filePicker'

const CONFIG = {
  title: 'Categories',
  description: 'Pick an approved category when adding a product. Need something new? Add it here — it goes live once admin approves it.',
  addLabel: 'Add Category',
  allLabel: 'All Categories',
  kpiTotal: 'Total Categories',
  kpiIcon: 'categories',
  kpiIconBg: colors.brand[50],
  kpiIconRing: 'rgba(59,130,246,0.1)',
  kpiIconFg: colors.brand[600],
  approvedCaption: 'live on storefront',
  searchPlaceholder: 'Search categories...',
  imageKey: 'image',
  contain: false,
  tintHex: '#3b82f6',
  tintFg: colors.brand[600],
  initialsFallback: 'CT',
  detailsHeader: 'Category Details',
  dateHeader: 'Created On',
  dateWidth: '10rem',
  statusWidth: '12rem',
  emptyIcon: 'categories',
  emptyFiltered: 'No matching categories',
  emptyNone: 'No categories yet',
  emptyHint: 'Add your first category to get started.',
  itemLabel: 'categories',
  showFood: true,
}

// Read-only list of the shared taxonomy — a seller can't edit/delete/feature it, only propose
// additions (VendorCategoryFormDrawer), which stay PENDING until admin approves them in the
// Approval Queue.
export function CategoriesPage() {
  const categories = useVendorCatalogCategoriesController()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit({ name, image, isFood }) {
    if (isSubmitting) return
    const formData = new FormData()
    formData.append('name', name)
    formData.append('isFood', String(Boolean(isFood)))
    if (image) appendFile(formData, 'image', image)

    setIsSubmitting(true)
    try {
      const created = await categories.createCategory(formData)
      // Food category without an approved FSSAI licence: saved, but blocked
      // in admin's queue until the licence is approved.
      if (created?.fssaiRequired) {
        toast.warning(
          'FSSAI licence required',
          created.fssaiStatus === 'PENDING'
            ? `"${name}" will be reviewed once admin approves your FSSAI licence.`
            : `"${name}" is saved, but admin can approve it only after you upload an FSSAI licence from Store Profile and it is approved.`,
        )
      } else {
        toast.success('Submitted for review', `"${name}" was sent to admin for approval.`)
      }
      setDrawerOpen(false)
    } catch (err) {
      toast.error('Could not submit', err?.response?.data?.message || 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <CatalogBrowser
      controller={categories}
      config={CONFIG}
      onAdd={() => setDrawerOpen(true)}
      drawer={<VendorCategoryFormDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} onSubmit={handleSubmit} isSubmitting={isSubmitting} />}
    />
  )
}

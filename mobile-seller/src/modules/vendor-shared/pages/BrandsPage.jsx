import { useState } from 'react'
import { toast } from '../../../lib/toast'
import { colors } from '../../../theme'
import { useVendorCatalogBrandsController } from '../controllers/useVendorController'
import { VendorBrandFormDrawer } from '../components/catalog/VendorCatalogForms'
import { CatalogBrowser } from '../components/catalog/CatalogBrowser'
import { appendFile } from '../lib/filePicker'

const CONFIG = {
  title: 'Brands',
  description: 'Pick an approved brand when adding a product. Need something new? Add it here — it goes live once admin approves it.',
  addLabel: 'Add Brand',
  allLabel: 'All Brands',
  kpiTotal: 'Total Brands',
  kpiIcon: 'brands',
  kpiIconBg: colors.warning[50],
  kpiIconRing: 'rgba(245,158,11,0.1)',
  kpiIconFg: colors.warning[600],
  approvedCaption: 'live in catalog',
  searchPlaceholder: 'Search brands...',
  imageKey: 'logo',
  contain: true,
  tintHex: '#f59e0b',
  tintFg: colors.warning[700],
  initialsFallback: 'BR',
  detailsHeader: 'Brand Details',
  dateHeader: 'Registered On',
  dateWidth: '12rem',
  statusWidth: '13rem',
  emptyIcon: 'brands',
  emptyFiltered: 'No matching brands',
  emptyNone: 'No brands yet',
  emptyHint: 'Add your first brand to get started.',
  itemLabel: 'brands',
  showFood: false,
}

// Read-only list of shared brands — a seller can't edit/delete a shared brand, only propose
// additions (VendorBrandFormDrawer), which stay PENDING until admin approves them.
export function BrandsPage() {
  const brands = useVendorCatalogBrandsController()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit({ name, logo }) {
    if (isSubmitting) return
    const formData = new FormData()
    formData.append('name', name)
    if (logo) appendFile(formData, 'logo', logo)

    setIsSubmitting(true)
    try {
      await brands.createBrand(formData)
      toast.success('Submitted for review', `"${name}" was sent to admin for approval.`)
      setDrawerOpen(false)
    } catch (err) {
      toast.error('Could not submit', err?.response?.data?.message || 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <CatalogBrowser
      controller={brands}
      config={CONFIG}
      onAdd={() => setDrawerOpen(true)}
      drawer={<VendorBrandFormDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} onSubmit={handleSubmit} isSubmitting={isSubmitting} />}
    />
  )
}

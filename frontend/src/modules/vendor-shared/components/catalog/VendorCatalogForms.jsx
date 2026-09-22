import { useState } from 'react'
import { Badge, Icon, Input } from '../../../../components/ui'
import { FormDrawer } from '../../../admin/components/forms'
import { InlineAlert } from '../../../admin/components/feedback'

export function VendorCategoryFormDrawer({ isOpen, onClose, onSubmit, isSubmitting }) {
  const [imageFile, setImageFile] = useState(null)
  const [name, setName] = useState('')
  const [issue, setIssue] = useState(null)

  function handleSubmit(event) {
    event.preventDefault()
    if (!name.trim()) {
      setIssue('Category name is required')
      return
    }
    setIssue(null)
    onSubmit({ name: name.trim(), image: imageFile })
  }

  const previewSrc = imageFile ? URL.createObjectURL(imageFile) : undefined

  return (
    <FormDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Add Category"
      description="Name and image — admin reviews this before it appears on the storefront or in product forms."
      submitLabel="Add Category"
      isSubmitting={isSubmitting}
      error={issue ? { message: issue } : null}
      onSubmit={handleSubmit}
      width="md"
    >
      <InlineAlert tone="info" title="Goes live after approval">
        This category stays hidden and unusable until an admin approves it from the Approval Queue.
      </InlineAlert>

      <div className="flex flex-col gap-2">
        <label className="text-2xs font-bold uppercase tracking-wider text-slate-500">Category Image / Thumbnail</label>
        <div className="flex items-center gap-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-4 transition-colors hover:border-brand-400">
          {previewSrc ? (
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
              <img src={previewSrc} alt="Preview" className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-indigo-50 text-brand-600 ring-1 ring-brand-100">
              <Icon name="categories" className="h-7 w-7" />
            </div>
          )}
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs ring-1 ring-inset ring-slate-200 hover:bg-slate-50 hover:text-brand-600 transition-all">
                <Icon name="upload" className="h-3.5 w-3.5" />
                <span>{previewSrc ? 'Change Image' : 'Choose File'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={(event) => setImageFile(event.target.files?.[0] || null)} />
              </label>
              {imageFile && (
                <button type="button" onClick={() => setImageFile(null)} className="rounded-xl px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors">
                  Clear Selection
                </button>
              )}
            </div>
            <p className="text-2xs text-slate-400">Recommended: Square PNG, WebP or JPG at least 600×600 px.</p>
          </div>
        </div>
      </div>

      <Input id="vendor-category-name" label="Category Name" required placeholder="e.g. Ayurvedic Wellness" value={name} onChange={(event) => setName(event.target.value)} />

      <div className="mt-2 flex flex-col gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4">
        <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">Live Card Preview</span>
        <div className="flex items-center gap-3.5 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
          {previewSrc ? (
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50 shadow-xs">
              <img src={previewSrc} alt="Preview" className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500/10 to-indigo-500/10 text-brand-600 font-bold text-sm ring-1 ring-brand-500/20">
              {name ? name.slice(0, 2).toUpperCase() : 'CT'}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-bold text-slate-900 text-sm truncate">{name || 'Category Name'}</p>
            <Badge tone="warning" dot size="sm" className="mt-1">Pending review</Badge>
          </div>
        </div>
      </div>
    </FormDrawer>
  )
}

export function VendorBrandFormDrawer({ isOpen, onClose, onSubmit, isSubmitting }) {
  const [logoFile, setLogoFile] = useState(null)
  const [name, setName] = useState('')
  const [issue, setIssue] = useState(null)

  function handleSubmit(event) {
    event.preventDefault()
    if (!name.trim()) {
      setIssue('Brand name is required')
      return
    }
    setIssue(null)
    onSubmit({ name: name.trim(), logo: logoFile })
  }

  const previewSrc = logoFile ? URL.createObjectURL(logoFile) : undefined

  return (
    <FormDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Add Brand"
      description="Name and logo — admin reviews this before it appears on the storefront or in product forms."
      submitLabel="Add Brand"
      isSubmitting={isSubmitting}
      error={issue ? { message: issue } : null}
      onSubmit={handleSubmit}
      width="md"
    >
      <InlineAlert tone="info" title="Goes live after approval">
        This brand stays hidden and unusable until an admin approves it from the Approval Queue.
      </InlineAlert>

      <div className="flex flex-col gap-2">
        <label className="text-2xs font-bold uppercase tracking-wider text-slate-500">Brand Logo</label>
        <div className="flex items-center gap-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-4 transition-colors hover:border-brand-400">
          {previewSrc ? (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xs">
              <img src={previewSrc} alt="Preview" className="max-h-full max-w-full object-contain" />
            </div>
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 text-amber-700 ring-1 ring-amber-100">
              <Icon name="brands" className="h-7 w-7" />
            </div>
          )}
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs ring-1 ring-inset ring-slate-200 hover:bg-slate-50 hover:text-brand-600 transition-all">
                <Icon name="upload" className="h-3.5 w-3.5" />
                <span>{previewSrc ? 'Change Logo' : 'Upload Logo'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={(event) => setLogoFile(event.target.files?.[0] || null)} />
              </label>
              {logoFile && (
                <button type="button" onClick={() => setLogoFile(null)} className="rounded-xl px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors">
                  Clear Selection
                </button>
              )}
            </div>
            <p className="text-2xs text-slate-400">Square logo with clean background (PNG, WebP or SVG).</p>
          </div>
        </div>
      </div>

      <Input id="vendor-brand-name" label="Brand Name" required placeholder="e.g. Arya Manufacturing" value={name} onChange={(event) => setName(event.target.value)} />

      <div className="mt-2 flex flex-col gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4">
        <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">Live Card Preview</span>
        <div className="flex items-center gap-3.5 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
          {previewSrc ? (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200/80 bg-white p-1 shadow-xs">
              <img src={previewSrc} alt="Preview" className="max-h-full max-w-full object-contain" />
            </div>
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 text-amber-700 font-bold text-sm ring-1 ring-amber-500/20">
              {name ? name.slice(0, 2).toUpperCase() : 'BR'}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-bold text-slate-900 text-sm truncate">{name || 'Brand Name'}</p>
            <Badge tone="warning" dot size="sm" className="mt-1">Pending review</Badge>
          </div>
        </div>
      </div>
    </FormDrawer>
  )
}

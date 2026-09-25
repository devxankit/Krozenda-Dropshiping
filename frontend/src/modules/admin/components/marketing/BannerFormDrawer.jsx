import { useEffect, useMemo, useState } from 'react'
import { Icon, Input, Select, Textarea } from '../../../../components/ui'
import { FormDrawer } from '../forms'
import { STATIC_BANNER_PRODUCTS } from '../../constants'
import { bannerWriteSchema } from '../../schemas/marketingSchema'

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active (Visible on storefront)' },
  { value: 'inactive', label: 'Inactive (Hidden)' },
]

const PRODUCT_OPTIONS = [
  { value: '', label: 'No product linked' },
  ...STATIC_BANNER_PRODUCTS.map((product) => ({ value: product.id, label: product.name })),
]

const PLACEMENT_OPTIONS = [
  { value: 'hero', label: 'Hero carousel (top banner)' },
  { value: 'promo', label: 'Highlight card (2-up promo section)' },
  { value: 'strip', label: 'Trust strip tile ("why shop with us")' },
]

const ICON_OPTIONS = [
  { value: 'truck', label: 'Truck (dispatch/delivery)' },
  { value: 'currency', label: 'Rupee (pricing)' },
  { value: 'shield', label: 'Shield (quality/trust)' },
  { value: 'refresh', label: 'Refresh (returns/replacement)' },
  { value: 'briefcase', label: 'Briefcase (reselling/business)' },
  { value: 'building', label: 'Building (supplier/factory)' },
  { value: 'sparkles', label: 'Sparkles (general offer)' },
  { value: 'tag', label: 'Tag (deal/discount)' },
]

const THEME_OPTIONS = [
  { value: 'blue', label: 'Blue' },
  { value: 'amber', label: 'Amber' },
  { value: 'emerald', label: 'Emerald' },
  { value: 'purple', label: 'Purple' },
]

export function BannerFormDrawer({ isOpen, onClose, banner, writer }) {
  const editing = Boolean(banner)
  const [imageFile, setImageFile] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [form, setForm] = useState(() => ({
    title: banner?.title ?? '',
    productId: banner?.productId ?? '',
    status: banner?.status ?? 'active',
    placement: banner?.placement ?? 'hero',
    subtitle: banner?.subtitle ?? '',
    tag: banner?.tag ?? '',
    icon: banner?.icon ?? 'sparkles',
    theme: banner?.theme ?? 'blue',
    ctaPath: banner?.ctaPath ?? '',
  }))
  const [issue, setIssue] = useState(null)

  const mutation = editing ? writer.update : writer.create
  const isHero = form.placement === 'hero'
  const isPromo = form.placement === 'promo'

  function handleSubmit(event) {
    event.preventDefault()

    if (isHero && !editing && !imageFile) {
      setIssue('Upload a banner image')
      return
    }

    const productName =
      STATIC_BANNER_PRODUCTS.find((product) => product.id === form.productId)?.name || ''

    const payload = {
      title: form.title.trim(),
      productId: form.productId || null,
      productName,
      status: form.status,
      placement: form.placement,
      subtitle: form.subtitle.trim(),
      tag: form.tag.trim(),
      icon: form.icon,
      theme: form.theme,
      ctaPath: form.ctaPath.trim(),
    }

    const result = bannerWriteSchema.safeParse(payload)
    if (!result.success) {
      setIssue(result.error.issues[0]?.message || 'Validation error')
      return
    }
    setIssue(null)

    if (imageFile) {
      payload.image = imageFile
    }

    mutation.run(editing ? { id: banner.id, ...payload } : payload)
  }

  function pickFile(file) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setIssue('Only image files can be used as a banner')
      return
    }
    setIssue(null)
    setImageFile(file)
  }

  function handleDragOver(event) {
    event.preventDefault()
    setIsDragging(true)
  }

  function handleDrop(event) {
    event.preventDefault()
    setIsDragging(false)
    pickFile(event.dataTransfer.files?.[0])
  }

  // One object URL per picked file, released when the file changes or the
  // drawer closes — creating it inline leaked a new blob URL every render.
  const objectUrl = useMemo(() => (imageFile ? URL.createObjectURL(imageFile) : null), [imageFile])
  useEffect(() => () => objectUrl && URL.revokeObjectURL(objectUrl), [objectUrl])

  const previewSrc = objectUrl || banner?.image || undefined

  return (
    <FormDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? `Edit banner: ${banner.title}` : 'Create banner'}
      description="Storefront placements shown on the home page — hero carousel, highlight cards and trust-strip tiles."
      submitLabel={editing ? 'Save banner' : 'Create banner'}
      isSubmitting={mutation.isSubmitting}
      error={issue ? { message: issue } : mutation.error}
      onSubmit={handleSubmit}
      width="lg"
    >
      <Select
        id="banner-placement"
        label="Placement"
        description="Where this shows up on the home page."
        options={PLACEMENT_OPTIONS}
        value={form.placement}
        onChange={(event) => setForm((c) => ({ ...c, placement: event.target.value }))}
      />

      {isHero ? (
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
            Banner image
          </label>
          {/* The whole preview is the drop target and the click target, so
              the upload action sits in the middle of the image instead of in
              a footer the admin has to hunt for. */}
          <label
            onDragEnter={handleDragOver}
            onDragOver={handleDragOver}
            onDragLeave={(event) => {
              // dragleave also fires when crossing into a child element.
              if (!event.currentTarget.contains(event.relatedTarget)) setIsDragging(false)
            }}
            onDrop={handleDrop}
            className={`group relative block cursor-pointer overflow-hidden rounded-xl border-2 border-dashed transition-colors ${
              isDragging
                ? 'border-brand-500 bg-brand-50'
                : 'border-slate-200 bg-slate-100 hover:border-brand-300'
            }`}
          >
            <div className="relative flex aspect-[16/9] sm:aspect-[21/9] w-full items-center justify-center">
              {previewSrc && (
                <img src={previewSrc} alt="Banner preview" className="absolute inset-0 h-full w-full object-cover" />
              )}
              <div
                className={`relative z-10 flex flex-col items-center gap-2 rounded-xl px-5 py-4 text-center transition-opacity ${
                  previewSrc
                    ? 'bg-slate-900/60 text-white opacity-0 backdrop-blur-sm group-hover:opacity-100 focus-within:opacity-100'
                    : 'text-ink-faint'
                } ${isDragging ? 'opacity-100' : ''}`}
              >
                <Icon name={previewSrc ? 'banners' : 'add'} className="h-6 w-6" />
                <span
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold shadow-sm ring-1 ring-inset ${
                    previewSrc
                      ? 'bg-white/15 text-white ring-white/40'
                      : 'bg-white text-slate-700 ring-slate-300 group-hover:text-brand-600'
                  }`}
                >
                  {isDragging ? 'Drop image here' : previewSrc ? 'Change image' : 'Upload image'}
                </span>
                <span className={`text-2xs ${previewSrc ? 'text-white/80' : ''}`}>
                  or drag &amp; drop it here
                </span>
              </div>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => pickFile(event.target.files?.[0])}
              />
            </div>
          </label>
          <p className="text-2xs text-ink-faint">
            Optimized to WebP automatically. Recommended size: 1920×960 px or 1920×1080 px (16:9 ratio) for large edge-to-edge hero banners.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            id="banner-icon"
            label="Icon"
            options={ICON_OPTIONS}
            value={form.icon}
            onChange={(event) => setForm((c) => ({ ...c, icon: event.target.value }))}
          />
          <Select
            id="banner-theme"
            label="Color theme"
            options={THEME_OPTIONS}
            value={form.theme}
            onChange={(event) => setForm((c) => ({ ...c, theme: event.target.value }))}
          />
        </div>
      )}

      <Input
        id="banner-title"
        label={isHero ? 'Banner title' : 'Headline'}
        required
        placeholder={isHero ? 'e.g. Festive season — up to 40% off' : 'e.g. Earn Upto ₹50,000/mo Dropshipping'}
        value={form.title}
        onChange={(event) => setForm((c) => ({ ...c, title: event.target.value }))}
      />

      {(isHero || isPromo) && (
        <Input
          id="banner-tag"
          label={isHero ? 'Badge label (optional)' : 'Tag pill (optional)'}
          description={isHero ? 'Small pill shown over the bottom-left of the banner image.' : undefined}
          placeholder={isHero ? 'e.g. ⚡ Hot Wholesale Tier' : 'e.g. HIGH MARGIN RESELLING'}
          value={form.tag}
          onChange={(event) => setForm((c) => ({ ...c, tag: event.target.value }))}
        />
      )}

      <Textarea
        id="banner-subtitle"
        label={isHero ? 'Badge caption (optional)' : 'Description'}
        rows={2}
        placeholder={isHero ? 'e.g. Dispatch in 24 Hours • White-Label' : 'e.g. Zero inventory investment. We ship under your brand name.'}
        value={form.subtitle}
        onChange={(event) => setForm((c) => ({ ...c, subtitle: event.target.value }))}
      />

      {isPromo && (
        <Input
          id="banner-cta-path"
          label="Click-through path (optional)"
          description="Where tapping the card sends the buyer. Defaults to the category listing."
          placeholder="/app/listing"
          value={form.ctaPath}
          onChange={(event) => setForm((c) => ({ ...c, ctaPath: event.target.value }))}
        />
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select
          id="banner-product"
          label="Linked product"
          description="Static list for now — will read from the live catalog later."
          options={PRODUCT_OPTIONS}
          value={form.productId}
          onChange={(event) => setForm((c) => ({ ...c, productId: event.target.value }))}
        />

        <Select
          id="banner-status"
          label="Status"
          options={STATUS_OPTIONS}
          value={form.status}
          onChange={(event) => setForm((c) => ({ ...c, status: event.target.value }))}
        />
      </div>
    </FormDrawer>
  )
}

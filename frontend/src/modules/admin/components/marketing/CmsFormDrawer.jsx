import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import {
  HiDocumentText,
  HiGlobeAlt,
  HiEye,
  HiArrowTopRightOnSquare,
} from 'react-icons/hi2'
import { FormDrawer } from '../forms/FormDrawer'

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function CmsFormDrawer({ isOpen, ...props }) {
  if (!isOpen) return null
  return <CmsFormDrawerBody {...props} />
}

function CmsFormDrawerBody({ onClose, page, onSubmit, isSubmitting, error }) {
  const isEdit = Boolean(page)
  const [autoSlug, setAutoSlug] = useState(!isEdit)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      title: page?.title || '',
      slug: page?.slug || '',
      content: page?.content || '',
      status: page?.status || 'published',
      metaTitle: page?.metaTitle || '',
      metaDescription: page?.metaDescription || '',
    },
  })

  const watchedTitle = watch('title')
  const watchedSlug = watch('slug')
  const watchedContent = watch('content') || ''
  const watchedStatus = watch('status')
  const watchedMetaTitle = watch('metaTitle')
  const watchedMetaDescription = watch('metaDescription')

  // Auto-generate slug while typing title if not manually changed
  useEffect(() => {
    if (autoSlug && watchedTitle) {
      setValue('slug', slugify(watchedTitle))
    }
  }, [watchedTitle, autoSlug, setValue])

  const insertSnippet = (snippet) => {
    const current = watchedContent
    setValue('content', current ? `${current}\n\n${snippet}` : snippet)
  }

  function handleFormSubmit(values) {
    onSubmit({
      ...values,
      slug: slugify(values.slug || values.title),
      ...(isEdit ? { id: page.id || page._id } : {}),
    })
  }

  const wordCount = watchedContent.trim() ? watchedContent.trim().split(/\s+/).length : 0
  const charCount = watchedContent.length
  const publicPath = watchedSlug === 'terms' ? '/terms' : watchedSlug === 'privacy-policy' ? '/privacy-policy' : `/p/${watchedSlug || 'page'}`

  return (
    <FormDrawer
      isOpen
      onClose={onClose}
      title={isEdit ? 'Edit page' : 'Add page'}
      description="Create and manage web pages for your online store."
      submitLabel={isEdit ? 'Save' : 'Save page'}
      submitTone="primary"
      isSubmitting={isSubmitting}
      error={error}
      onSubmit={handleSubmit(handleFormSubmit)}
      width="xl"
    >
      <div className="space-y-5">
        {/* CARD 1: TITLE & CONTENT */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
          {/* Title Input */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              Title <span className="text-danger-500">*</span>
            </label>
            <input
              type="text"
              {...register('title', { required: 'Title is required' })}
              placeholder="e.g. About us, Terms of service, Refund policy"
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 placeholder-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100 shadow-2xs"
              autoFocus={!isEdit}
            />
            {errors.title && (
              <p className="text-2xs text-danger-600 mt-1">{errors.title.message}</p>
            )}
          </div>

          {/* Content Editor */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-800">
                Content
              </label>
              <div className="text-[11px] font-mono text-slate-400">
                {wordCount} words · {charCount} chars
              </div>
            </div>

            {/* Standard Editor Formatting Bar */}
            <div className="flex flex-wrap items-center gap-1 p-1.5 bg-slate-50 border border-slate-200 rounded-t-xl border-b-0 text-slate-700">
              <button
                type="button"
                onClick={() => insertSnippet('# Heading 1')}
                title="Heading 1"
                className="px-2 py-1 text-2xs font-bold rounded hover:bg-slate-200 transition-colors"
              >
                H1
              </button>
              <button
                type="button"
                onClick={() => insertSnippet('## Heading 2')}
                title="Heading 2"
                className="px-2 py-1 text-2xs font-bold rounded hover:bg-slate-200 transition-colors"
              >
                H2
              </button>
              <button
                type="button"
                onClick={() => insertSnippet('### Heading 3')}
                title="Heading 3"
                className="px-2 py-1 text-2xs font-bold rounded hover:bg-slate-200 transition-colors"
              >
                H3
              </button>
              <span className="w-px h-4 bg-slate-200 mx-1" />
              <button
                type="button"
                onClick={() => insertSnippet('**Bold text**')}
                title="Bold"
                className="px-2 py-1 text-2xs font-bold rounded hover:bg-slate-200 transition-colors"
              >
                B
              </button>
              <button
                type="button"
                onClick={() => insertSnippet('*Italic text*')}
                title="Italic"
                className="px-2 py-1 text-2xs italic font-serif rounded hover:bg-slate-200 transition-colors"
              >
                I
              </button>
              <span className="w-px h-4 bg-slate-200 mx-1" />
              <button
                type="button"
                onClick={() => insertSnippet('- Bullet list item 1\n- Bullet list item 2')}
                title="Bullet List"
                className="px-2 py-1 text-2xs font-semibold rounded hover:bg-slate-200 transition-colors"
              >
                • List
              </button>
              <button
                type="button"
                onClick={() => insertSnippet('1. Numbered item 1\n2. Numbered item 2')}
                title="Numbered List"
                className="px-2 py-1 text-2xs font-semibold rounded hover:bg-slate-200 transition-colors"
              >
                1. List
              </button>
              <button
                type="button"
                onClick={() => insertSnippet('> Quote or important note')}
                title="Quote"
                className="px-2 py-1 text-2xs font-semibold rounded hover:bg-slate-200 transition-colors"
              >
                Quote
              </button>
              <button
                type="button"
                onClick={() => insertSnippet('[Link text](https://example.com)')}
                title="Link"
                className="px-2 py-1 text-2xs font-semibold rounded hover:bg-slate-200 transition-colors"
              >
                Link
              </button>
              <button
                type="button"
                onClick={() => insertSnippet('---\n')}
                title="Divider"
                className="px-2 py-1 text-2xs font-semibold rounded hover:bg-slate-200 transition-colors"
              >
                Line
              </button>
            </div>

            <textarea
              rows={14}
              {...register('content')}
              placeholder="Write or paste your page content in Markdown format..."
              className="w-full rounded-b-xl border border-slate-300 bg-white p-4 font-mono text-xs leading-relaxed text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100 shadow-2xs resize-y min-h-[260px]"
            />
          </div>
        </div>

        {/* CARD 2: VISIBILITY & URL HANDLE */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Visibility / Status */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-2">
                Visibility
              </label>
              <div className="space-y-2">
                <label className="flex items-center space-x-2.5 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                  <input
                    type="radio"
                    value="published"
                    {...register('status')}
                    className="accent-brand-600 w-4 h-4 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      Visible (Published)
                    </span>
                    <span className="text-[11px] text-slate-400 block">
                      Available to visitors on your store
                    </span>
                  </div>
                </label>

                <label className="flex items-center space-x-2.5 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                  <input
                    type="radio"
                    value="draft"
                    {...register('status')}
                    className="accent-brand-600 w-4 h-4 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      Hidden (Draft)
                    </span>
                    <span className="text-[11px] text-slate-400 block">
                      Not visible to visitors on your store
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* URL Handle / Slug */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-800">
                  URL handle
                </label>
                <button
                  type="button"
                  onClick={() => setAutoSlug(!autoSlug)}
                  className="text-[11px] text-brand-600 hover:underline font-semibold"
                >
                  {autoSlug ? 'Auto-syncing' : 'Edit handle'}
                </button>
              </div>

              <div className="flex items-center bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono shadow-2xs focus-within:ring-2 focus-within:ring-brand-600 focus-within:border-brand-600 focus-within:bg-white">
                <span className="text-slate-400 select-none mr-1 shrink-0">/p/</span>
                <input
                  type="text"
                  {...register('slug', { required: 'Handle is required' })}
                  onChange={(e) => {
                    setAutoSlug(false)
                    setValue('slug', slugify(e.target.value))
                  }}
                  placeholder="page-slug"
                  className="w-full bg-transparent font-bold text-slate-900 focus:outline-none"
                />
              </div>
              {errors.slug && (
                <p className="text-2xs text-danger-600 mt-1">{errors.slug.message}</p>
              )}

              {isEdit && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => window.open(publicPath, '_blank')}
                    className="inline-flex items-center space-x-1 text-xs font-semibold text-brand-600 hover:underline"
                  >
                    <span>View page on online store</span>
                    <HiArrowTopRightOnSquare className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* CARD 3: SEARCH ENGINE LISTING PREVIEW (SEO) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold text-slate-900">
              Search engine listing preview
            </h3>
            <p className="text-2xs text-slate-500 mt-0.5">
              Add a title and description to see how this page might appear in a search engine listing.
            </p>
          </div>

          {/* Google Result Preview Box */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 space-y-1">
            <div className="text-xs text-slate-500 font-mono truncate">
              https://krozenda.com &gt; p &gt; {watchedSlug || 'page-slug'}
            </div>
            <h4 className="text-sm font-semibold text-brand-700 truncate">
              {watchedMetaTitle || watchedTitle || 'Page Title'}
            </h4>
            <p className="text-xs text-slate-600 line-clamp-2 leading-snug">
              {watchedMetaDescription ||
                watchedContent.slice(0, 140) ||
                'No description provided for this page. Search engines will automatically generate one from the content.'}
            </p>
          </div>

          <div className="space-y-3 pt-1">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Page title
              </label>
              <input
                type="text"
                {...register('metaTitle')}
                placeholder={watchedTitle || 'Page title'}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:border-brand-600 focus:outline-none shadow-2xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Description
              </label>
              <textarea
                rows={2}
                {...register('metaDescription')}
                placeholder="Brief summary for search engines..."
                className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:border-brand-600 focus:outline-none shadow-2xs resize-none"
              />
            </div>
          </div>
        </div>
      </div>
    </FormDrawer>
  )
}

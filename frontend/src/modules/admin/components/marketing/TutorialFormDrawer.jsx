import { useForm } from 'react-hook-form'
import { FormDrawer } from '../forms/FormDrawer'

export function TutorialFormDrawer({ isOpen, ...props }) {
  if (!isOpen) return null
  return <TutorialFormDrawerBody {...props} />
}

const INPUT =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:border-brand-600 focus:outline-none shadow-2xs'

function TutorialFormDrawerBody({ onClose, tutorial, onSubmit, isSubmitting, error }) {
  const isEdit = Boolean(tutorial)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      title: tutorial?.title || '',
      audience: tutorial?.audience || 'seller',
      videoUrl: tutorial?.videoUrl || '',
      description: tutorial?.description || '',
      category: tutorial?.category || 'General',
      status: tutorial?.status || 'published',
      order: tutorial?.order ?? 0,
    },
  })

  function handleFormSubmit(values) {
    onSubmit({
      ...values,
      order: Number(values.order) || 0,
      ...(isEdit ? { id: tutorial.id || tutorial._id } : {}),
    })
  }

  return (
    <FormDrawer
      isOpen
      onClose={onClose}
      title={isEdit ? 'Edit tutorial' : 'Add tutorial'}
      description="A video and/or step-by-step text guide shown inside the seller panel or the customer app."
      submitLabel={isEdit ? 'Save' : 'Save tutorial'}
      submitTone="primary"
      isSubmitting={isSubmitting}
      error={error}
      onSubmit={handleSubmit(handleFormSubmit)}
      width="lg"
    >
      <div className="space-y-5">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              Title <span className="text-danger-500">*</span>
            </label>
            <input
              type="text"
              {...register('title', { required: 'Title is required' })}
              placeholder="e.g. How to add your first product"
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 placeholder-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100 shadow-2xs"
              autoFocus={!isEdit}
            />
            {errors.title && <p className="text-2xs text-danger-600 mt-1">{errors.title.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">Video link</label>
            <input
              type="url"
              {...register('videoUrl')}
              placeholder="https://www.youtube.com/watch?v=…"
              className={INPUT}
            />
            <p className="text-2xs text-slate-500 mt-1">YouTube, Vimeo or a direct .mp4 link. Leave blank for a text-only guide.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">Steps / text guide</label>
            <textarea
              rows={7}
              {...register('description')}
              placeholder={'1. Open Products\n2. Tap Add Product\n3. …'}
              className="w-full rounded-xl border border-slate-300 bg-white p-3.5 text-xs leading-relaxed text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100 shadow-2xs resize-y min-h-[140px]"
            />
            <p className="text-2xs text-slate-500 mt-1">Add a video link, text steps, or both.</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">Show to</label>
              <select {...register('audience')} className={INPUT}>
                <option value="seller">Sellers</option>
                <option value="customer">Customers</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">Category</label>
              <input type="text" {...register('category')} placeholder="General" className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">Display order</label>
              <input type="number" {...register('order')} placeholder="0" className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">Visibility</label>
              <select {...register('status')} className={INPUT}>
                <option value="published">Published (visible)</option>
                <option value="draft">Draft (hidden)</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </FormDrawer>
  )
}

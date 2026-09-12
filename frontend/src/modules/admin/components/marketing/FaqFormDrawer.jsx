import { useForm } from 'react-hook-form'
import { FormDrawer } from '../forms/FormDrawer'

export function FaqFormDrawer({ isOpen, ...props }) {
  if (!isOpen) return null
  return <FaqFormDrawerBody {...props} />
}

function FaqFormDrawerBody({ onClose, faq, onSubmit, isSubmitting, error }) {
  const isEdit = Boolean(faq)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      question: faq?.question || '',
      answer: faq?.answer || '',
      category: faq?.category || 'General',
      status: faq?.status || 'published',
      order: faq?.order ?? 0,
    },
  })

  function handleFormSubmit(values) {
    onSubmit({
      ...values,
      order: Number(values.order) || 0,
      ...(isEdit ? { id: faq.id || faq._id } : {}),
    })
  }

  return (
    <FormDrawer
      isOpen
      onClose={onClose}
      title={isEdit ? 'Edit FAQ' : 'Add FAQ'}
      description="Question and answer pairs shown to buyers on the storefront help center."
      submitLabel={isEdit ? 'Save' : 'Save FAQ'}
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
              Question <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              {...register('question', { required: 'Question is required' })}
              placeholder="e.g. How do I track my order?"
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 shadow-2xs"
              autoFocus={!isEdit}
            />
            {errors.question && (
              <p className="text-2xs text-rose-600 mt-1">{errors.question.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              Answer <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={6}
              {...register('answer', { required: 'Answer is required' })}
              placeholder="Write the answer buyers will see..."
              className="w-full rounded-xl border border-slate-300 bg-white p-3.5 text-xs leading-relaxed text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 shadow-2xs resize-y min-h-[140px]"
            />
            {errors.answer && (
              <p className="text-2xs text-rose-600 mt-1">{errors.answer.message}</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">Category</label>
              <input
                type="text"
                {...register('category')}
                placeholder="General"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:border-blue-600 focus:outline-none shadow-2xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">Display order</label>
              <input
                type="number"
                {...register('order')}
                placeholder="0"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:border-blue-600 focus:outline-none shadow-2xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">Visibility</label>
              <select
                {...register('status')}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:border-blue-600 focus:outline-none shadow-2xs"
              >
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

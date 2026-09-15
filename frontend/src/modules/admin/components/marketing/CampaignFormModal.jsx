import { useForm } from 'react-hook-form'
import { FormDrawer } from '../forms/FormDrawer'

const AUDIENCE_OPTIONS = [
  { value: 'customers', label: 'All customers', description: 'Every buyer with push enabled' },
  { value: 'sellers', label: 'All sellers', description: 'Every seller with push enabled' },
  { value: 'both', label: 'Customers & sellers', description: 'Both audiences at once' },
]

export function CampaignFormModal({ isOpen, ...props }) {
  if (!isOpen) return null
  return <CampaignFormModalBody {...props} />
}

function CampaignFormModalBody({ onClose, onSubmit, isSubmitting, error }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: { title: '', message: '', audience: 'customers' },
  })

  return (
    <FormDrawer
      isOpen
      onClose={onClose}
      title="New campaign"
      description="Sends a real push notification via Firebase Cloud Messaging to every device registered for the chosen audience."
      submitLabel={isSubmitting ? 'Sending...' : 'Send now'}
      submitTone="primary"
      isSubmitting={isSubmitting}
      error={error}
      onSubmit={handleSubmit(onSubmit)}
      width="lg"
    >
      <div className="space-y-5">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              {...register('title', { required: 'Title is required', maxLength: { value: 80, message: 'Keep it under 80 characters' } })}
              placeholder="e.g. Festive season launch"
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 shadow-2xs"
              autoFocus
            />
            {errors.title && <p className="text-2xs text-rose-600 mt-1">{errors.title.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              Message <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={4}
              {...register('message', { required: 'Message is required', maxLength: { value: 240, message: 'Keep it under 240 characters' } })}
              placeholder="What should the notification say?"
              className="w-full rounded-xl border border-slate-300 bg-white p-3.5 text-xs leading-relaxed text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 shadow-2xs resize-y min-h-[100px]"
            />
            {errors.message && <p className="text-2xs text-rose-600 mt-1">{errors.message.message}</p>}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3">
          <span className="block text-xs font-bold text-slate-800">Target audience</span>
          <div className="grid grid-cols-1 gap-2">
            {AUDIENCE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 cursor-pointer hover:border-blue-300 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50/60"
              >
                <input
                  type="radio"
                  value={option.value}
                  {...register('audience', { required: true })}
                  className="mt-0.5"
                />
                <span>
                  <span className="block text-xs font-semibold text-slate-900">{option.label}</span>
                  <span className="block text-2xs text-ink-faint">{option.description}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </FormDrawer>
  )
}

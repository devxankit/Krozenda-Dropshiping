import { useMemo } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { Button, Input, Select } from '../../../../components/ui'
import { FormDrawer } from '../forms/FormDrawer'
import { fetchCustomers } from '../../services/peopleService'
import { fetchProducts } from '../../services/catalogService'

const PAYMENT_METHOD_OPTIONS = [
  { value: 'COD', label: 'Cash on delivery' },
  { value: 'WALLET', label: 'Wallet' },
  { value: 'RAZORPAY', label: 'Razorpay' },
]

export function OrderFormModal({ isOpen, ...props }) {
  if (!isOpen) return null
  return <OrderFormModalBody {...props} />
}

function OrderFormModalBody({ onClose, onSubmit, isSubmitting, error }) {
  const customersQuery = useQuery({
    queryKey: ['admin', 'customers', { tab: 'all', filters: {}, page: 1, rowsPerPage: 500 }],
    queryFn: () => fetchCustomers({ tab: 'all', filters: {}, page: 1, rowsPerPage: 500 }),
  })
  const productsQuery = useQuery({ queryKey: ['admin', 'catalog', 'products'], queryFn: fetchProducts })

  const customers = customersQuery.data?.items ?? []
  const products = productsQuery.data?.items ?? []

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      userId: '',
      paymentMethod: 'COD',
      shippingFee: 0,
      items: [{ productId: '', quantity: 1 }],
      shippingAddress: { fullName: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '', country: 'India' },
    },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  const selectedItems = watch('items')

  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const estimatedTotal = useMemo(
    () =>
      (selectedItems || []).reduce((sum, item) => {
        const product = productsById.get(item.productId)
        const price = product ? (product.salePrice ?? product.price ?? 0) : 0
        return sum + price * (Number(item.quantity) || 0)
      }, 0),
    [selectedItems, productsById],
  )

  function submit(values) {
    onSubmit({
      userId: values.userId,
      paymentMethod: values.paymentMethod,
      shippingFee: Number(values.shippingFee) || 0,
      items: values.items
        .filter((item) => item.productId && Number(item.quantity) > 0)
        .map((item) => ({ productId: item.productId, quantity: Number(item.quantity) })),
      shippingAddress: values.shippingAddress,
    })
  }

  return (
    <FormDrawer
      isOpen
      onClose={onClose}
      title="Create order"
      description="Place an order on a customer's behalf — items, address and payment are all set here."
      submitLabel={isSubmitting ? 'Creating…' : 'Create order'}
      submitTone="primary"
      isSubmitting={isSubmitting}
      error={error}
      onSubmit={handleSubmit(submit)}
      width="lg"
    >
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Customer</p>
        <Select
          id="userId"
          label="Customer"
          required
          placeholder={customersQuery.isLoading ? 'Loading customers…' : 'Select a customer'}
          options={customers.map((c) => ({ value: c.id, label: `${c.name} · ${c.phone}` }))}
          {...register('userId', { required: 'Select a customer' })}
          error={errors.userId?.message}
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Items</p>
          <Button type="button" variant="secondary" size="sm" icon="add" onClick={() => append({ productId: '', quantity: 1 })}>
            Add item
          </Button>
        </div>

        {fields.map((field, index) => (
          <div key={field.id} className="flex items-end gap-2">
            <div className="flex-1">
              <Select
                id={`items.${index}.productId`}
                label={index === 0 ? 'Product' : undefined}
                placeholder={productsQuery.isLoading ? 'Loading products…' : 'Select a product'}
                options={products.map((p) => ({
                  value: p.id,
                  label: `${p.name} · ₹${(p.salePrice ?? p.price ?? 0).toLocaleString('en-IN')} · ${p.stock} in stock`,
                }))}
                {...register(`items.${index}.productId`, { required: 'Select a product' })}
                error={errors.items?.[index]?.productId?.message}
              />
            </div>
            <div className="w-24">
              <Input
                id={`items.${index}.quantity`}
                label={index === 0 ? 'Qty' : undefined}
                type="number"
                min={1}
                {...register(`items.${index}.quantity`, { required: true, min: 1, valueAsNumber: true })}
              />
            </div>
            <Button
              type="button"
              variant="quiet"
              size="control"
              icon="close"
              iconOnly
              aria-label="Remove item"
              onClick={() => remove(index)}
              disabled={fields.length === 1}
            />
          </div>
        ))}

        <div className="flex items-baseline justify-between border-t border-slate-200 pt-3 text-sm">
          <span className="text-ink-subtle">Estimated subtotal</span>
          <span className="font-semibold text-slate-900 tabular">₹{estimatedTotal.toLocaleString('en-IN')}</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Delivery address</p>
        <div className="grid grid-cols-2 gap-3">
          <Input
            id="shippingAddress.fullName"
            label="Full name"
            required
            {...register('shippingAddress.fullName', { required: 'Required' })}
            error={errors.shippingAddress?.fullName?.message}
          />
          <Input
            id="shippingAddress.phone"
            label="Phone"
            required
            placeholder="10-digit mobile number"
            maxLength={10}
            {...register('shippingAddress.phone', {
              required: 'Required',
              pattern: {
                value: /^[6-9]\d{9}$/,
                message: 'Enter a valid 10-digit mobile number',
              },
            })}
            error={errors.shippingAddress?.phone?.message}
          />
        </div>
        <Input
          id="shippingAddress.line1"
          label="Address line 1"
          required
          {...register('shippingAddress.line1', { required: 'Required' })}
          error={errors.shippingAddress?.line1?.message}
        />
        <Input id="shippingAddress.line2" label="Address line 2" {...register('shippingAddress.line2')} />
        <div className="grid grid-cols-3 gap-3">
          <Input
            id="shippingAddress.city"
            label="City"
            required
            {...register('shippingAddress.city', { required: 'Required' })}
            error={errors.shippingAddress?.city?.message}
          />
          <Input
            id="shippingAddress.state"
            label="State"
            required
            {...register('shippingAddress.state', { required: 'Required' })}
            error={errors.shippingAddress?.state?.message}
          />
          <Input
            id="shippingAddress.pincode"
            label="Pincode"
            required
            placeholder="6-digit pincode"
            maxLength={6}
            {...register('shippingAddress.pincode', {
              required: 'Required',
              pattern: {
                value: /^[1-9]\d{5}$/,
                message: 'Enter a valid 6-digit pincode',
              },
            })}
            error={errors.shippingAddress?.pincode?.message}
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Payment</p>
        <div className="grid grid-cols-2 gap-3">
          <Select
            id="paymentMethod"
            label="Payment method"
            options={PAYMENT_METHOD_OPTIONS}
            {...register('paymentMethod', { required: true })}
          />
          <Input
            id="shippingFee"
            label="Shipping fee (₹)"
            type="number"
            min={0}
            {...register('shippingFee', { valueAsNumber: true, min: 0 })}
          />
        </div>
      </div>
    </FormDrawer>
  )
}

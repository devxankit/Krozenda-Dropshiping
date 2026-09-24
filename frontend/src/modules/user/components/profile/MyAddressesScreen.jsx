import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HiArrowLeft, HiPlus, HiPencil, HiTrash, HiCheckCircle } from 'react-icons/hi2'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { useAddressesController } from '../../controllers/useAddressesController'
import { AddressFormModal } from './AddressFormModal'
import { toast } from '../../../../lib/toast'

export function MyAddressesScreen({ onBack }) {
  // Falls back to real navigation when no callback is supplied. The
  // router stopped passing one when every screen took ownership of its
  // own navigation; the previous `= () => {}` default silently turned
  // the back button into a no-op.
  const goBackFallback = useNavigate()
  const handleBack = onBack || (() => goBackFallback(-1))

  const {
    addresses,
    isLoading,
    createAddress,
    updateAddress,
    setDefaultAddress,
    removeAddress,
    isCreating,
    isUpdating,
  } = useAddressesController()

  const [formState, setFormState] = useState({ open: false, editing: null })

  const openAddForm = () => setFormState({ open: true, editing: null })
  const openEditForm = (address) => setFormState({ open: true, editing: address })
  const closeForm = () => setFormState({ open: false, editing: null })

  const handleSubmit = async (values) => {
    if (formState.editing) {
      const res = await updateAddress({ id: formState.editing.id, ...values })
      toast.success('Address Updated', 'Delivery address details saved.')
      return res
    }
    const res = await createAddress(values)
    toast.success('Address Added', 'New delivery address saved.')
    return res
  }

  const handleSetDefault = async (id) => {
    try {
      await setDefaultAddress(id)
      toast.success('Default Address Set', 'Your primary delivery address was updated.')
    } catch (err) {
      toast.error('Could not set default address', err)
    }
  }

  const handleRemove = async (id) => {
    try {
      await removeAddress(id)
      toast.info('Address Removed', 'The delivery address was deleted.')
    } catch (err) {
      toast.error('Could not delete address', err)
    }
  }

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col text-slate-800 font-sans">
      <div className="sticky top-0 z-50 hidden md:block"><WebHeader /></div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 md:py-8 space-y-6">
        {/* Header */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button onClick={handleBack} className="p-2 rounded-full hover:bg-slate-100 text-slate-700">
              <HiArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-slate-900">Saved Delivery Addresses</h1>
              <p className="text-xs text-slate-500 mt-0.5">Manage your shipping destinations for faster checkout execution.</p>
            </div>
          </div>

          <button
            onClick={openAddForm}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-colors flex items-center space-x-1.5"
          >
            <HiPlus className="w-4 h-4" />
            <span>Add New Address</span>
          </button>
        </div>

        {isLoading ? (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center text-xs font-semibold text-slate-400">
            Loading your addresses...
          </div>
        ) : addresses.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center space-y-3">
            <p className="text-sm font-bold text-slate-900">No saved addresses yet</p>
            <p className="text-xs text-slate-500">Add a delivery address to speed up checkout.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {addresses.map((item) => (
              <div
                key={item.id}
                className={`bg-white rounded-3xl border p-6 shadow-xs flex flex-col justify-between space-y-4 transition-all ${
                  item.isDefault ? 'border-blue-600 ring-2 ring-blue-500/20' : 'border-slate-200/80 hover:border-slate-300'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-black text-slate-900 capitalize">{item.type}</span>
                      {item.isDefault && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 font-extrabold text-[9px] uppercase rounded-full">
                          Default
                        </span>
                      )}
                    </div>
                    {item.isDefault && <HiCheckCircle className="w-5 h-5 text-blue-600" />}
                  </div>

                  <div className="text-xs text-slate-600 space-y-1">
                    <p className="font-bold text-slate-900 text-sm">{item.fullName}</p>
                    <p className="leading-relaxed">
                      {item.line1}
                      {item.line2 ? `, ${item.line2}` : ''}, {item.city}, {item.state} - {item.pincode}
                    </p>
                    <p className="font-semibold text-slate-700 pt-1">{item.phone}</p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold">
                  {!item.isDefault ? (
                    <button onClick={() => handleSetDefault(item.id)} className="text-blue-600 hover:underline">
                      Set as Default
                    </button>
                  ) : (
                    <span className="text-slate-400 font-semibold text-[11px]">Default Address</span>
                  )}

                  <div className="flex items-center space-x-3 text-slate-500">
                    <button onClick={() => openEditForm(item)} className="hover:text-blue-600">
                      <HiPencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleRemove(item.id)} className="hover:text-red-600">
                      <HiTrash className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <AddressFormModal
        open={formState.open}
        initialValues={formState.editing}
        onClose={closeForm}
        onSubmit={handleSubmit}
        isSubmitting={isCreating || isUpdating}
      />
    </div>
  )
}

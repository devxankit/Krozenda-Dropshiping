import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  HiArrowLeft,
  HiPlus,
  HiPencil,
  HiTrash,
  HiCheckCircle,
  HiHome,
  HiBriefcase,
  HiMapPin,
  HiPhone,
} from 'react-icons/hi2'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { useAddressesController } from '../../controllers/useAddressesController'
import { AddressFormModal } from './AddressFormModal'
import { toast } from '../../../../lib/toast'

const TYPE_ICONS = { home: HiHome, office: HiBriefcase, other: HiMapPin }

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

      {/* Mobile app bar */}
      <header className="md:hidden sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80">
        <div className="flex items-center gap-2 px-2 h-14">
          <button
            onClick={handleBack}
            aria-label="Go back"
            className="w-10 h-10 flex items-center justify-center rounded-full text-slate-700 active:bg-slate-100"
          >
            <HiArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-black text-slate-900 leading-tight">My Addresses</h1>
            {!isLoading && addresses.length > 0 && (
              <p className="text-[11px] font-semibold text-slate-500">
                {addresses.length} saved {addresses.length === 1 ? 'address' : 'addresses'}
              </p>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 md:py-8 space-y-4 md:space-y-6 pb-28 md:pb-8">
        {/* Desktop header */}
        <div className="hidden md:flex bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs items-center justify-between">
          <div className="flex items-center space-x-4">
            <button onClick={handleBack} className="p-2 rounded-full hover:bg-slate-100 text-slate-700">
              <HiArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-black text-slate-900">Saved Delivery Addresses</h1>
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

        {/* Mobile add-address row */}
        {!isLoading && addresses.length > 0 && (
          <button
            onClick={openAddForm}
            className="md:hidden w-full flex items-center gap-3 bg-white border border-dashed border-blue-300 rounded-2xl px-4 py-3.5 text-left active:bg-blue-50 transition-colors"
          >
            <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <HiPlus className="w-5 h-5" />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-bold text-blue-600">Add a new address</span>
              <span className="block text-[11px] text-slate-500">Home, office or anywhere else</span>
            </span>
          </button>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
            {[0, 1].map((i) => (
              <div key={i} className="bg-white rounded-2xl md:rounded-3xl border border-slate-200/80 p-4 md:p-6 space-y-3 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100" />
                  <div className="h-3 w-24 rounded bg-slate-100" />
                </div>
                <div className="h-3 w-3/4 rounded bg-slate-100" />
                <div className="h-3 w-1/2 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : addresses.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200/80 px-6 py-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
              <HiMapPin className="w-8 h-8" />
            </div>
            <p className="text-base font-black text-slate-900">No saved addresses yet</p>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">Add a delivery address to speed up checkout.</p>
            <button
              onClick={openAddForm}
              className="mt-5 bg-blue-600 hover:bg-blue-700 active:bg-blue-700 text-white font-bold text-sm px-5 py-3 rounded-xl shadow-sm flex items-center gap-2"
            >
              <HiPlus className="w-4 h-4" />
              Add New Address
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
            {addresses.map((item) => {
              const TypeIcon = TYPE_ICONS[item.type] || HiMapPin
              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-2xl md:rounded-3xl border shadow-xs flex flex-col overflow-hidden transition-all ${
                    item.isDefault ? 'border-blue-500 ring-2 ring-blue-500/15' : 'border-slate-200/80 hover:border-slate-300'
                  }`}
                >
                  <div className="p-4 md:p-5 flex gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        item.isDefault ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <TypeIcon className="w-5 h-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">{item.type}</span>
                        {item.isDefault && (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-blue-50 text-blue-700 font-extrabold text-[10px] uppercase rounded-full">
                            <HiCheckCircle className="w-3 h-3" />
                            Default
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[15px] font-bold text-slate-900 truncate">{item.fullName}</p>
                      <p className="mt-1 text-[13px] text-slate-600 leading-relaxed break-words">
                        {item.line1}
                        {item.line2 ? `, ${item.line2}` : ''}, {item.city}, {item.state} - {item.pincode}
                      </p>
                      <p className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-700">
                        <HiPhone className="w-3.5 h-3.5 text-slate-400" />
                        {item.phone}
                      </p>
                    </div>
                  </div>

                  <div className="mt-auto grid grid-cols-3 border-t border-slate-100 divide-x divide-slate-100 text-xs font-bold">
                    <button
                      onClick={() => openEditForm(item)}
                      className="py-3 flex items-center justify-center gap-1.5 text-slate-600 hover:text-blue-600 active:bg-slate-50"
                    >
                      <HiPencil className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleRemove(item.id)}
                      className="py-3 flex items-center justify-center gap-1.5 text-slate-600 hover:text-red-600 active:bg-red-50"
                    >
                      <HiTrash className="w-4 h-4" />
                      Remove
                    </button>
                    {item.isDefault ? (
                      <span className="py-3 flex items-center justify-center gap-1 text-blue-600/70 font-semibold">
                        <HiCheckCircle className="w-4 h-4" />
                        Default
                      </span>
                    ) : (
                      <button
                        onClick={() => handleSetDefault(item.id)}
                        className="py-3 flex items-center justify-center text-blue-600 hover:bg-blue-50 active:bg-blue-50"
                      >
                        Set Default
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
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

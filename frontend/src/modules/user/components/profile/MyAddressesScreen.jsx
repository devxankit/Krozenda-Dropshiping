import React, { useState } from 'react'
import { HiArrowLeft, HiPlus, HiPencil, HiTrash, HiCheckCircle } from 'react-icons/hi2'
import { WebHeader } from '../../../../components/layout/WebHeader'

export function MyAddressesScreen({ onBack = () => {}, onAddNew = () => {} }) {
  const [addresses, setAddresses] = useState([
    { id: 'home', label: 'Home', isDefault: true, name: 'Rahul Sharma', address: '123, Sunrise Apartments, Near SG Highway, Ahmedabad, Gujarat - 380051', phone: '+91 98765 43210' },
    { id: 'office', label: 'Office', isDefault: false, name: 'Rahul Sharma', address: '45, Corporate Park, Prahlad Nagar, Ahmedabad, Gujarat - 380015', phone: '+91 98765 43210' },
    { id: 'other', label: 'Other Address', isDefault: false, name: 'Rahul Sharma', address: '12, Shanti Nagar, Satellite Road, Ahmedabad, Gujarat - 380015', phone: '+91 98765 43210' },
  ])

  const setDefaultAddress = (id) => {
    setAddresses((prev) => prev.map((item) => ({ ...item, isDefault: item.id === id })))
  }

  const removeAddress = (id) => {
    setAddresses((prev) => prev.filter((item) => item.id !== id))
  }

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col text-slate-800 font-sans">
      <div className="hidden md:block"><WebHeader /></div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 md:py-8 space-y-6">
        {/* Header */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button onClick={onBack} className="p-2 rounded-full hover:bg-slate-100 text-slate-700">
              <HiArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-slate-900">Saved Delivery Addresses</h1>
              <p className="text-xs text-slate-500 mt-0.5">Manage your shipping destinations for faster checkout execution.</p>
            </div>
          </div>

          <button
            onClick={onAddNew}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-colors flex items-center space-x-1.5"
          >
            <HiPlus className="w-4 h-4" />
            <span>Add New Address</span>
          </button>
        </div>

        {/* Address Cards Grid */}
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
                    <span className="text-sm font-black text-slate-900">{item.label}</span>
                    {item.isDefault && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 font-extrabold text-[9px] uppercase rounded-full">
                        Default
                      </span>
                    )}
                  </div>
                  {item.isDefault && <HiCheckCircle className="w-5 h-5 text-blue-600" />}
                </div>

                <div className="text-xs text-slate-600 space-y-1">
                  <p className="font-bold text-slate-900 text-sm">{item.name}</p>
                  <p className="leading-relaxed">{item.address}</p>
                  <p className="font-semibold text-slate-700 pt-1">{item.phone}</p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold">
                {!item.isDefault ? (
                  <button
                    onClick={() => setDefaultAddress(item.id)}
                    className="text-blue-600 hover:underline"
                  >
                    Set as Default
                  </button>
                ) : (
                  <span className="text-slate-400 font-semibold text-[11px]">Default Address</span>
                )}

                <div className="flex items-center space-x-3 text-slate-500">
                  <button className="hover:text-blue-600">
                    <HiPencil className="w-4 h-4" />
                  </button>
                  {!item.isDefault && (
                    <button onClick={() => removeAddress(item.id)} className="hover:text-red-600">
                      <HiTrash className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

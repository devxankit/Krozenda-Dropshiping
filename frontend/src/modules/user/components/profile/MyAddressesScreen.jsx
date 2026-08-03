import React, { useState } from 'react'
import {
  HiArrowLeft,
  HiPlus,
  HiPencil,
  HiTrash,
  HiCheckCircle,
} from 'react-icons/hi2'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { WebHeader } from '../../../../components/layout/WebHeader'

export function MyAddressesScreen({
  onBack = () => {},
  onAddNew = () => {},
}) {
  const [addresses, setAddresses] = useState([
    {
      id: 'home',
      label: 'Home',
      isDefault: true,
      name: 'Rahul Sharma',
      address: '123, Sunrise Apartments, Near SG Highway, Ahmedabad, Gujarat - 380051',
      phone: '+91 98765 43210',
    },
    {
      id: 'office',
      label: 'Office',
      isDefault: false,
      name: 'Rahul Sharma',
      address: '45, Corporate Park, Prahlad Nagar, Ahmedabad, Gujarat - 380015',
      phone: '+91 98765 43210',
    },
    {
      id: 'other',
      label: 'Other Address',
      isDefault: false,
      name: 'Rahul Sharma',
      address: '12, Shanti Nagar, Satellite Road, Ahmedabad, Gujarat - 380015',
      phone: '+91 98765 43210',
    },
  ])

  const setDefaultAddress = (id) => {
    setAddresses((prev) =>
      prev.map((item) => ({
        ...item,
        isDefault: item.id === id,
      }))
    )
  }

  const removeAddress = (id) => {
    setAddresses((prev) => prev.filter((item) => item.id !== id))
  }

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans">
      {/* DESKTOP WEB HEADER */}
      <div className="hidden md:block">
        <WebHeader />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 pb-20 md:pb-12 max-w-3xl mx-auto w-full md:px-6 md:py-6">
        
        <div className="md:hidden">
          
        </div>

        {/* Top Header */}
        <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-3">
            <button
              onClick={onBack}
              className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700 transition-colors"
            >
              <HiArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-base font-bold text-slate-900">My Addresses</h2>
          </div>
          <button
            onClick={onAddNew}
            className="text-xs font-bold text-blue-600 hover:underline flex items-center space-x-1"
          >
            <HiPlus className="w-4 h-4" />
            <span>Add New</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-4">
          <div className="space-y-3">
            {addresses.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">{item.label}</span>
                  {item.isDefault && (
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 font-bold text-[9px] uppercase tracking-wider rounded">
                      Default
                    </span>
                  )}
                </div>

                <div className="text-xs text-slate-600 space-y-1">
                  <p className="font-bold text-slate-900">{item.name}</p>
                  <p className="text-slate-600 leading-relaxed">{item.address}</p>
                  <p className="font-semibold text-slate-700">{item.phone}</p>
                </div>

                {/* Actions Row */}
                <div className="border-t border-slate-100 pt-2.5 flex items-center justify-between text-[11px] font-semibold text-slate-600">
                  <button className="flex items-center space-x-1 hover:text-blue-600">
                    <HiPencil className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>

                  <button
                    onClick={() => removeAddress(item.id)}
                    className="flex items-center space-x-1 text-red-500 hover:text-red-700"
                  >
                    <HiTrash className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>

                  {!item.isDefault && (
                    <button
                      onClick={() => setDefaultAddress(item.id)}
                      className="flex items-center space-x-1 text-blue-600 hover:underline"
                    >
                      <HiCheckCircle className="w-3.5 h-3.5" />
                      <span>Set Default</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Primary Button */}
          <button
            onClick={onAddNew}
            className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold py-3.5 px-4 rounded-xl shadow-md transition-all text-xs tracking-wide flex items-center justify-center space-x-1.5"
          >
            <HiPlus className="w-4 h-4" />
            <span>Add New Address</span>
          </button>
        </div>
      </div>

      {/* MOBILE BOTTOM NAVBAR */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        <BottomNavbar activeTab="profile" />
      </div>
    </div>
  )
}

import React, { useState } from 'react'
import { HiArrowLeft, HiPlus, HiCheck, HiShieldCheck } from 'react-icons/hi2'
import { WebHeader } from '../../../../components/layout/WebHeader'

export function SelectAddressScreen({ onBack = () => {}, onSelectAddress = () => {} }) {
  const [selectedAddressId, setSelectedAddressId] = useState('home')
  const addresses = [
    { id: 'home', label: 'Home', isDefault: true, name: 'Rahul Sharma', address: '123, Sunrise Apartments, Near SG Highway, Ahmedabad, Gujarat - 380051', phone: '+91 98765 43210' },
    { id: 'office', label: 'Office', isDefault: false, name: 'Rahul Sharma', address: '45, Corporate Park, Prahlad Nagar, Ahmedabad, Gujarat - 380015', phone: '+91 98765 43210' },
    { id: 'other', label: 'Other Address', isDefault: false, name: 'Rahul Sharma', address: '12, Shanti Nagar, Satellite Road, Ahmedabad, Gujarat - 380015', phone: '+91 98765 43210' },
  ]

  const selectedAddress = addresses.find(a => a.id === selectedAddressId) || addresses[0]

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col text-slate-800 font-sans">
      <div className="hidden md:block">
        <WebHeader />
      </div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 md:py-8">
        {/* Checkout Progress Stepper (Desktop & Mobile) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 mb-6 shadow-xs">
          <div className="flex items-center justify-around max-w-2xl mx-auto text-xs font-bold">
            <div className="flex items-center space-x-2 text-blue-700">
              <span className="w-6 h-6 rounded-full bg-blue-700 text-white flex items-center justify-center text-[11px]">1</span>
              <span className="font-extrabold">Address</span>
            </div>
            <div className="h-0.5 bg-slate-200 flex-1 mx-3" />
            <div className="flex items-center space-x-2 text-slate-400">
              <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[11px]">2</span>
              <span>Delivery</span>
            </div>
            <div className="h-0.5 bg-slate-200 flex-1 mx-3" />
            <div className="flex items-center space-x-2 text-slate-400">
              <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[11px]">3</span>
              <span>Summary</span>
            </div>
            <div className="h-0.5 bg-slate-200 flex-1 mx-3" />
            <div className="flex items-center space-x-2 text-slate-400">
              <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[11px]">4</span>
              <span>Payment</span>
            </div>
          </div>
        </div>

        {/* 2-Column Split Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Address Selection & Add New Address */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center space-x-3">
                <button onClick={onBack} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700">
                  <HiArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-lg md:text-xl font-black text-slate-900">Select Delivery Address</h1>
              </div>
              <button className="bg-blue-50 text-blue-700 hover:bg-blue-100 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors">
                <HiPlus className="w-4 h-4" />
                <span>Add New Address</span>
              </button>
            </div>

            <div className="space-y-3">
              {addresses.map((item) => {
                const isSelected = selectedAddressId === item.id
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedAddressId(item.id)}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/40 ring-2 ring-blue-500/20 shadow-md'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2.5">
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                            isSelected ? 'border-blue-600 bg-blue-600' : 'border-slate-300'
                          }`}
                        >
                          {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                        </div>
                        <span className="text-sm font-bold text-slate-900">{item.label}</span>
                        {item.isDefault && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 font-extrabold text-[9px] uppercase rounded-full">
                            Default
                          </span>
                        )}
                      </div>
                      {isSelected && <HiCheck className="w-5 h-5 text-blue-600" />}
                    </div>
                    <div className="pl-7 text-xs text-slate-600 space-y-1">
                      <p className="font-bold text-slate-900 text-sm">{item.name}</p>
                      <p className="leading-relaxed">{item.address}</p>
                      <p className="font-semibold text-slate-700">{item.phone}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right Column: Address Action & Order Summary Overview */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-md space-y-5 sticky top-24">
              <h3 className="text-base font-black text-slate-900 border-b border-slate-100 pb-3">
                Selected Shipping Destination
              </h3>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 space-y-2 text-xs">
                <span className="text-[10px] font-extrabold text-blue-700 uppercase tracking-wider block">
                  {selectedAddress.label} Address
                </span>
                <p className="font-bold text-slate-900 text-sm">{selectedAddress.name}</p>
                <p className="text-slate-600 leading-relaxed">{selectedAddress.address}</p>
                <p className="font-semibold text-slate-800 pt-1">{selectedAddress.phone}</p>
              </div>

              <div className="bg-emerald-50 p-3.5 rounded-2xl border border-emerald-100 flex items-center space-x-2 text-[11px] font-semibold text-emerald-800">
                <HiShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>Pan-India Doorstep Delivery with Live Tracking</span>
              </div>

              <button
                onClick={() => onSelectAddress(selectedAddress)}
                className="w-full bg-blue-700 hover:bg-blue-800 active:scale-[0.98] text-white font-bold py-4 px-4 rounded-2xl shadow-lg shadow-blue-500/20 transition-all text-xs tracking-wide"
              >
                Deliver to this Address →
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

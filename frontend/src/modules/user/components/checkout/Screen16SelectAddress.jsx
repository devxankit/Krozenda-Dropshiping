import React, { useState } from 'react'
import { HiArrowLeft, HiPlus, HiCheck } from 'react-icons/hi2'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { WebHeader } from '../../../../components/layout/WebHeader'

export function Screen16SelectAddress({ onBack = () => {}, onSelectAddress = () => {} }) {
  const [selectedAddressId, setSelectedAddressId] = useState('home')
  const addresses = [
    { id: 'home', label: 'Home', isDefault: true, name: 'Rahul Sharma', address: '123, Sunrise Apartments, Near SG Highway, Ahmedabad, Gujarat - 380051', phone: '+91 98765 43210' },
    { id: 'office', label: 'Office', isDefault: false, name: 'Rahul Sharma', address: '45, Corporate Park, Prahlad Nagar, Ahmedabad, Gujarat - 380015', phone: '+91 98765 43210' },
    { id: 'other', label: 'Other Address', isDefault: false, name: 'Rahul Sharma', address: '12, Shanti Nagar, Satellite Road, Ahmedabad, Gujarat - 380015', phone: '+91 98765 43210' },
  ]

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans">
      <div className="hidden md:block">
        <WebHeader />
      </div>

      <div className="flex-1 pb-20 md:pb-12 max-w-3xl mx-auto w-full md:px-6 md:py-6">
        <div className="md:hidden">
          <div className="w-full px-6 pt-3 pb-2 flex items-center justify-between text-xs font-semibold bg-white">
            <span>9:41</span>
            <div className="flex items-center space-x-1.5 text-xs">
              <span>📶</span>
              <span>📡</span>
              <span>🔋</span>
            </div>
          </div>
        </div>

        <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-3">
            <button onClick={onBack} className="p-1.5 rounded-full hover:bg-slate-100"><HiArrowLeft className="w-5 h-5" /></button>
            <h2 className="text-base font-bold text-slate-900">Select Delivery Address</h2>
          </div>
          <button className="p-1.5 rounded-full hover:bg-slate-100"><HiPlus className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-4">
          <div className="space-y-3">
            {addresses.map((item) => {
              const isSelected = selectedAddressId === item.id
              return (
                <div key={item.id} onClick={() => setSelectedAddressId(item.id)} className={`p-4 rounded-2xl border transition-all cursor-pointer ${isSelected ? 'border-blue-600 bg-blue-50/40 ring-2 ring-blue-500/20' : 'border-slate-200 bg-white'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'border-blue-600 bg-blue-600' : 'border-slate-300'}`}>
                        {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                      </div>
                      <span className="text-xs font-bold text-slate-900">{item.label}</span>
                      {item.isDefault && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 font-bold text-[9px] uppercase rounded">Default</span>}
                    </div>
                    {isSelected && <HiCheck className="w-4 h-4 text-blue-600" />}
                  </div>
                  <div className="pl-6 text-xs text-slate-600 space-y-1">
                    <p className="font-bold text-slate-900">{item.name}</p>
                    <p>{item.address}</p>
                    <p>{item.phone}</p>
                  </div>
                </div>
              )
            })}
          </div>

          <button onClick={() => onSelectAddress(addresses[0])} className="w-full bg-blue-600 text-white font-bold py-3.5 px-4 rounded-xl text-xs">
            Deliver to this address
          </button>
        </div>
      </div>

      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        <BottomNavbar activeTab="orders" />
      </div>
    </div>
  )
}

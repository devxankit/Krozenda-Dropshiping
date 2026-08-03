import React, { useState } from 'react'
import { HiArrowLeft, HiPlus } from 'react-icons/hi2'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { WebHeader } from '../../../../components/layout/WebHeader'

export function Screen27MyAddresses({ onBack = () => {}, onAddNew = () => {} }) {
  const [addresses] = useState([
    { id: 'home', label: 'Home', isDefault: true, name: 'Rahul Sharma', address: '123, Sunrise Apartments, Near SG Highway, Ahmedabad, Gujarat - 380051', phone: '+91 98765 43210' },
    { id: 'office', label: 'Office', isDefault: false, name: 'Rahul Sharma', address: '45, Corporate Park, Prahlad Nagar, Ahmedabad, Gujarat - 380015', phone: '+91 98765 43210' },
  ])

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans">
      <div className="hidden md:block"><WebHeader /></div>
      <div className="flex-1 pb-20 md:pb-12 max-w-3xl mx-auto w-full md:px-6 md:py-6">
        <div className="px-4 py-3 bg-white border-b flex justify-between items-center">
          <div className="flex items-center space-x-3"><button onClick={onBack}><HiArrowLeft className="w-5 h-5" /></button><h2 className="text-base font-bold">My Addresses</h2></div>
          <button onClick={onAddNew} className="text-xs font-bold text-blue-600">+ Add New</button>
        </div>
        <div className="p-4 space-y-3">
          {addresses.map((item) => (
            <div key={item.id} className="bg-white rounded-2xl border p-4 text-xs space-y-1">
              <span className="font-bold text-slate-900 block">{item.label}</span>
              <p className="font-bold">{item.name}</p>
              <p>{item.address}</p>
            </div>
          ))}
          <button onClick={onAddNew} className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl text-xs flex items-center justify-center space-x-1"><HiPlus className="w-4 h-4" /><span>Add New Address</span></button>
        </div>
      </div>
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50"><BottomNavbar activeTab="profile" /></div>
    </div>
  )
}

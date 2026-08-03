import React from 'react'
import { HiArrowLeft, HiCheck, HiTruck } from 'react-icons/hi2'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { WebHeader } from '../../../../components/layout/WebHeader'

export function Screen23TrackShipment({ onBack = () => {} }) {
  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans">
      <div className="hidden md:block"><WebHeader /></div>
      <div className="flex-1 pb-20 md:pb-12 max-w-3xl mx-auto w-full md:px-6 md:py-6">
        <div className="px-4 py-3 bg-white border-b flex items-center space-x-3">
          <button onClick={onBack}><HiArrowLeft className="w-5 h-5" /></button>
          <h2 className="text-base font-bold">Track Shipment</h2>
        </div>
        <div className="p-4 space-y-4">
          <div className="bg-white rounded-2xl border p-4 space-y-2">
            <h3 className="text-xs font-bold">Shipment 1 of 3 (In Transit)</h3>
            <p className="text-xs text-slate-600">Courier: Delhivery • AWB: 1234567890123</p>
          </div>
        </div>
      </div>
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50"><BottomNavbar activeTab="orders" /></div>
    </div>
  )
}

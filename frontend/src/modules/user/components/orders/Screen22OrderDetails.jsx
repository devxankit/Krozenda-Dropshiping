import React from 'react'
import { HiArrowLeft, HiArrowDownTray } from 'react-icons/hi2'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { WebHeader } from '../../../../components/layout/WebHeader'

export function Screen22OrderDetails({ onBack = () => {}, onDownloadInvoice = () => {}, onTrackShipment = () => {} }) {
  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans">
      <div className="hidden md:block"><WebHeader /></div>
      <div className="flex-1 pb-20 md:pb-12 max-w-3xl mx-auto w-full md:px-6 md:py-6">
        <div className="px-4 py-3 bg-white border-b flex justify-between items-center">
          <div className="flex items-center space-x-3"><button onClick={onBack}><HiArrowLeft className="w-5 h-5" /></button><h2 className="text-base font-bold">Order Details</h2></div>
        </div>
        <div className="p-4 space-y-4">
          <div onClick={onTrackShipment} className="bg-white rounded-2xl border p-4 cursor-pointer">
            <h3 className="text-sm font-black">KRO1234567890</h3>
            <p className="text-[10px] text-slate-400">Placed on 12 May 2024 at 10:30 AM</p>
          </div>
          <button onClick={onDownloadInvoice} className="w-full bg-white text-blue-600 font-bold border border-blue-600 py-3 rounded-xl text-xs flex items-center justify-center space-x-2">
            <HiArrowDownTray className="w-4 h-4" /><span>Download Invoice</span>
          </button>
        </div>
      </div>
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50"><BottomNavbar activeTab="orders" /></div>
    </div>
  )
}

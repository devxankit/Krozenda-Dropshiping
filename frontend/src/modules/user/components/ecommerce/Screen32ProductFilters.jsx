import React from 'react'
import { HiArrowLeft } from 'react-icons/hi2'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { WebHeader } from '../../../../components/layout/WebHeader'

export function Screen32ProductFilters({ onBack = () => {}, onApplyFilters = () => {} }) {
  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans">
      <div className="hidden md:block"><WebHeader /></div>
      <div className="flex-1 pb-24 md:pb-12 max-w-2xl mx-auto w-full md:px-6 md:py-6">
        <div className="px-4 py-3 bg-white border-b flex items-center justify-between">
          <div className="flex items-center space-x-3"><button onClick={onBack}><HiArrowLeft className="w-5 h-5" /></button><h2 className="text-base font-bold">Filters</h2></div>
        </div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-3 shadow-lg z-50 max-w-2xl mx-auto">
        <button onClick={onApplyFilters} className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl text-xs">Show Results</button>
      </div>
    </div>
  )
}

import React from 'react'
import {
  HiArrowLeft,
  HiCheck,
  HiTruck,
  HiArrowPath,
  HiMapPin,
} from 'react-icons/hi2'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { WebHeader } from '../../../../components/layout/WebHeader'

export function Screen23TrackShipment({
  onBack = () => {},
  onViewDetails = () => {},
}) {
  const steps = [
    {
      title: 'Order Confirmed',
      time: '12 May 2024, 10:30 AM',
      isCompleted: true,
    },
    {
      title: 'Packed',
      time: '13 May 2024, 02:15 PM',
      isCompleted: true,
    },
    {
      title: 'In Transit',
      time: '14 May 2024, 08:45 AM',
      description: 'Your shipment is on the way',
      isCompleted: false,
      isActive: true,
    },
    {
      title: 'Out for Delivery',
      time: '15 May 2024, 10:00 AM',
      isCompleted: false,
    },
    {
      title: 'Delivered',
      time: '15 May 2024 (Expected)',
      isCompleted: false,
    },
  ]

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans">
      {/* DESKTOP WEB HEADER */}
      <div className="hidden md:block">
        <WebHeader />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 pb-20 md:pb-12 max-w-3xl mx-auto w-full md:px-6 md:py-6">
        {/* MOBILE STATUS BAR */}
        <div className="md:hidden">
          <div className="w-full px-6 pt-3 pb-2 flex items-center justify-between text-xs font-semibold text-slate-800 bg-white">
            <span>9:41</span>
            <div className="flex items-center space-x-1.5 text-xs">
              <span>📶</span>
              <span>📡</span>
              <span>🔋</span>
            </div>
          </div>
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
            <h2 className="text-base font-bold text-slate-900">Track Shipment</h2>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-4">
          {/* Shipment Info Header Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900">Shipment 1 of 3</span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-blue-100 text-blue-700">
                In Transit
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
              <span>Courier: <strong className="text-slate-900">Delhivery</strong></span>
              <div className="flex items-center space-x-1 font-semibold text-slate-800">
                <span>AWB: 1234567890123</span>
                <HiArrowPath className="w-3.5 h-3.5 text-slate-400 cursor-pointer" />
              </div>
            </div>
          </div>

          {/* Map Graphic & Estimated Delivery */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-4 shadow-xs flex items-center justify-between relative overflow-hidden">
            <div>
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">
                Estimated Delivery
              </span>
              <h3 className="text-base font-black text-slate-900 mt-0.5">15 May 2024</h3>
              <p className="text-[11px] text-slate-500 font-medium">3:00 PM - 8:00 PM</p>
            </div>

            {/* Map Pin Graphic */}
            <div className="w-16 h-16 bg-white rounded-2xl border border-blue-200 shadow-sm flex flex-col items-center justify-center relative">
              <HiMapPin className="w-8 h-8 text-blue-600 animate-bounce" />
            </div>
          </div>

          {/* Vertical Tracking Timeline Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Shipment Status
            </h3>

            <div className="relative pl-6 space-y-6">
              {/* Vertical line connecting nodes */}
              <div className="absolute top-2 bottom-2 left-2.5 w-0.5 bg-slate-200 -translate-x-1/2" />

              {steps.map((step, idx) => (
                <div key={idx} className="relative flex items-start space-x-3">
                  {/* Timeline icon node */}
                  <div className="absolute -left-6 top-0.5">
                    {step.isCompleted ? (
                      <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                        <HiCheck className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    ) : step.isActive ? (
                      <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs ring-4 ring-emerald-100">
                        <HiTruck className="w-3 h-3" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-white border-2 border-slate-300" />
                    )}
                  </div>

                  <div className="flex-1">
                    <h4
                      className={`text-xs font-bold ${
                        step.isCompleted || step.isActive ? 'text-slate-900' : 'text-slate-400'
                      }`}
                    >
                      {step.title}
                    </h4>
                    <p className="text-[10px] text-slate-500 font-medium">{step.time}</p>
                    {step.description && (
                      <p className="text-[10px] font-semibold text-emerald-600 mt-0.5">
                        {step.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* View Shipment Details Button */}
          <button
            onClick={onViewDetails}
            className="w-full bg-white hover:bg-slate-50 text-blue-600 font-bold py-3.5 px-4 rounded-xl border border-blue-600 shadow-xs transition-colors text-xs"
          >
            View Shipment Details
          </button>
        </div>
      </div>

      {/* MOBILE BOTTOM NAVBAR */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        <BottomNavbar activeTab="orders" />
      </div>
    </div>
  )
}

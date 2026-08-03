import React from 'react'
import {
  HiArrowLeft,
  HiQuestionMarkCircle,
  HiChatBubbleLeftRight,
  HiPhone,
  HiEnvelope,
  HiMagnifyingGlass,
  HiTruck,
  HiArrowPath,
  HiCreditCard,
  HiUser,
} from 'react-icons/hi2'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { WebHeader } from '../../../../components/layout/WebHeader'

export function HelpSupportScreen({
  onBack = () => {},
}) {
  const categories = [
    { label: 'Track My Order', Icon: HiTruck },
    { label: 'Returns & Refunds', Icon: HiArrowPath },
    { label: 'Payment Issues', Icon: HiCreditCard },
    { label: 'Cancel Order', Icon: HiQuestionMarkCircle },
    { label: 'Account Help', Icon: HiUser },
    { label: 'Other Queries', Icon: HiChatBubbleLeftRight },
  ]

  const faqs = [
    'How do I track my order delivery?',
    'What is KroZenda Return & Replacement Policy?',
    'How do I request GST Tax Invoice?',
    'Can I cancel an order after shipment?',
  ]

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
            <h2 className="text-base font-bold text-slate-900">Help & Support</h2>
          </div>
        </div>

        {/* Support Content */}
        <div className="p-4 space-y-5">
          {/* Help Search Banner */}
          <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 rounded-3xl p-6 text-white shadow-md space-y-3">
            <h3 className="text-base font-black">How can we help you today?</h3>
            <div className="flex items-center bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-3 py-2.5">
              <HiMagnifyingGlass className="w-4 h-4 text-blue-200 shrink-0" />
              <input
                type="text"
                placeholder="Search for help topics, orders..."
                className="w-full px-2 bg-transparent text-xs font-medium text-white placeholder-blue-200 focus:outline-none"
              />
            </div>
          </div>

          {/* Quick Help Categories Grid */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Quick Help
            </h3>

            <div className="grid grid-cols-3 gap-2.5">
              {categories.map((cat, idx) => {
                const IconComp = cat.Icon
                return (
                  <div
                    key={idx}
                    className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-xs flex flex-col items-center text-center cursor-pointer hover:border-blue-500 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
                      <IconComp className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-800 leading-snug">
                      {cat.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* FAQs List */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Frequently Asked Questions
            </h3>

            <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 shadow-xs">
              {faqs.map((faq, idx) => (
                <div
                  key={idx}
                  className="p-3.5 flex items-center justify-between text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <span>{faq}</span>
                  <span className="text-slate-400 text-xs">+</span>
                </div>
              ))}
            </div>
          </div>

          {/* Contact Support Channels */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Contact Us
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-xs flex items-center space-x-3 cursor-pointer hover:border-blue-500 transition-all">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <HiChatBubbleLeftRight className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Live Chat</h4>
                  <p className="text-[10px] text-slate-400 font-medium">Available 24/7</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-xs flex items-center space-x-3 cursor-pointer hover:border-blue-500 transition-all">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <HiPhone className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Call Us</h4>
                  <p className="text-[10px] text-slate-400 font-medium">+91 98765 43210</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE BOTTOM NAVBAR */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        <BottomNavbar activeTab="profile" />
      </div>
    </div>
  )
}

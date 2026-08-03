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
  HiChevronRight,
} from 'react-icons/hi2'
import { WebHeader } from '../../../../components/layout/WebHeader'

export function HelpSupportScreen({ onBack = () => {} }) {
  const categories = [
    { label: 'Track My Order', Icon: HiTruck, desc: 'Real-time courier updates' },
    { label: 'Returns & Refunds', Icon: HiArrowPath, desc: '7-day replacement window' },
    { label: 'Payment & Billing', Icon: HiCreditCard, desc: 'GST invoices & refunds' },
    { label: 'Account & Safety', Icon: HiUser, desc: 'Security & password reset' },
  ]

  const faqs = [
    'How do I track my pan-India order shipment?',
    'What is KroZenda Return & Replacement Policy?',
    'How do I download official GST Tax Invoices?',
    'Can I cancel an order after dispatch?',
  ]

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col text-slate-800 font-sans">
      <div className="hidden md:block"><WebHeader /></div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 md:py-8 space-y-8">
        {/* Hero Search Section */}
        <div className="bg-gradient-to-br from-blue-950 via-blue-900 to-indigo-900 text-white p-8 md:p-12 rounded-3xl shadow-xl text-center space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

          <div className="space-y-2 max-w-xl mx-auto">
            <span className="px-3.5 py-1 bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-full inline-block">
              24/7 CUSTOMER HELP CENTER
            </span>
            <h1 className="text-2xl md:text-4xl font-black">How can we help you today?</h1>
            <p className="text-xs md:text-sm text-blue-200">
              Search FAQs, track orders, or connect directly with our support team.
            </p>
          </div>

          <div className="max-w-2xl mx-auto relative">
            <HiMagnifyingGlass className="w-5 h-5 text-slate-400 absolute left-4 top-3.5" />
            <input
              type="text"
              placeholder="Search help articles (e.g. return policy, invoice, refund status)..."
              className="w-full pl-12 pr-4 py-3.5 bg-white text-slate-900 rounded-2xl text-xs md:text-sm font-semibold shadow-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
        </div>

        {/* 2-Column Split Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Quick Support Categories & FAQs */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-lg font-black text-slate-900">Browse Help Topics</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {categories.map(({ label, Icon, desc }) => (
                <div
                  key={label}
                  className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md hover:border-blue-200 transition-all cursor-pointer flex items-center space-x-4"
                >
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{label}</h3>
                    <p className="text-xs text-slate-500 font-medium">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* FAQs List */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
              <h3 className="text-base font-black text-slate-900 border-b border-slate-100 pb-3">
                Frequently Asked Questions
              </h3>
              <div className="divide-y divide-slate-100">
                {faqs.map((faq, idx) => (
                  <div key={idx} className="py-3 flex items-center justify-between hover:text-blue-600 cursor-pointer text-xs font-bold transition-colors">
                    <span>{faq}</span>
                    <HiChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Contact Channels Card */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-md space-y-5 sticky top-24">
              <h3 className="text-base font-black text-slate-900 border-b border-slate-100 pb-3">
                Direct Contact Support
              </h3>

              <div className="space-y-3">
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex items-center space-x-3 text-xs">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <HiChatBubbleLeftRight className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-emerald-900 text-sm">WhatsApp Support</h4>
                    <p className="text-[11px] text-emerald-700">Instant response (9 AM - 8 PM)</p>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl flex items-center space-x-3 text-xs">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                    <HiPhone className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-blue-900 text-sm">Call Support</h4>
                    <p className="text-[11px] text-blue-700">1800-KROZENDA (Toll Free)</p>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex items-center space-x-3 text-xs">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0">
                    <HiEnvelope className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Email Helpdesk</h4>
                    <p className="text-[11px] text-slate-500">support@krozenda.com</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

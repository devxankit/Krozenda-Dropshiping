import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  HiQuestionMarkCircle,
  HiChatBubbleLeftRight,
  HiPhone,
  HiEnvelope,
  HiMagnifyingGlass,
  HiTruck,
  HiArrowPath,
  HiCreditCard,
  HiUser,
  HiChevronDown,
  HiTicket,
  HiPlus,
  HiCheckCircle,
  HiClock,
  HiShieldCheck,
  HiExclamationCircle,
  HiSparkles,
  HiXMark,
} from 'react-icons/hi2'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { Footer } from '../../../../components/layout/Footer'
import { fetchPublicFaqs } from '../../services/faqService'
import { fetchUserTickets } from '../../services/ticketService'
import { RaiseTicketModal } from './RaiseTicketModal'
import { TicketDetailsModal } from './TicketDetailsModal'

const DEFAULT_FAQS = [
  {
    id: 'faq-1',
    category: 'Orders & Tracking',
    question: 'How do I track my Krozenda order?',
    answer:
      'You can track your order in real-time by visiting "My Orders" in your profile and clicking on "Track Shipment". You will see live courier partner updates and the estimated delivery date.',
  },
  {
    id: 'faq-2',
    category: 'Returns & Refunds',
    question: 'What is the return and replacement policy?',
    answer:
      'We offer a 7-day hassle-free replacement or return window on eligible items from the delivery date. To initiate a return, go to "My Orders", choose the item, and select "Request Return / Replacement".',
  },
  {
    id: 'faq-3',
    category: 'Returns & Refunds',
    question: 'When will I receive my refund?',
    answer:
      'Once the returned product arrives at our hub and passes quality inspection, refunds are credited within 2-4 business days for UPI/cards and instantly for Krozenda Wallet balances.',
  },
  {
    id: 'faq-4',
    category: 'Payments & Billing',
    question: 'What payment methods are accepted on Krozenda?',
    answer:
      'We accept all major UPI apps (Google Pay, PhonePe, Paytm), Credit/Debit Cards, Net Banking, Krozenda Wallet, and Cash on Delivery (COD) on eligible pin codes.',
  },
  {
    id: 'faq-5',
    category: 'Payments & Billing',
    question: 'How do I download a GST invoice for my purchase?',
    answer:
      'You can download tax invoices directly from "My Orders" > "Order Details" > "Download Invoice". You can also add your GSTIN during checkout for B2B input tax credit.',
  },
  {
    id: 'faq-6',
    category: 'Orders & Tracking',
    question: 'Can I cancel an order after placing it?',
    answer:
      'Yes, orders can be cancelled immediately from "My Orders" as long as the shipment has not been handed over to the courier partner. Once shipped, you can refuse delivery or request a return.',
  },
  {
    id: 'faq-7',
    category: 'Account & Safety',
    question: 'Is my personal and payment data secure?',
    answer:
      'Yes, Krozenda uses bank-grade 256-bit encryption and RBI-approved PCI-DSS compliant payment gateways (Razorpay). We never store your full card numbers or banking passwords.',
  },
  {
    id: 'faq-8',
    category: 'Damaged or Defective Item',
    question: 'What if I receive a damaged or incorrect product?',
    answer:
      'If you received a damaged, defective, or incorrect product, please raise a support ticket or return request within 48 hours of delivery along with photos. We will arrange a free reverse pickup and fast replacement.',
  },
]

const FAQ_CATEGORIES = [
  'All',
  'Orders & Tracking',
  'Returns & Refunds',
  'Payments & Billing',
  'Damaged or Defective Item',
  'Account & Safety',
]

const TICKET_FILTER_TABS = [
  { id: 'all', label: 'All Tickets' },
  { id: 'open', label: 'Open' },
  { id: 'waiting', label: 'In Review' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'closed', label: 'Closed' },
]

export function HelpSupportScreen({ onBack }) {
  // Falls back to real navigation when no callback is supplied. The
  // router stopped passing one when every screen took ownership of its
  // own navigation; the previous `= () => {}` default silently turned
  // the back button into a no-op.
  const goBackFallback = useNavigate()
  const handleBack = onBack || (() => goBackFallback(-1))

  // Navigation tabs: 'faqs' | 'tickets'
  const [activeTab, setActiveTab] = useState('faqs')

  // FAQ state
  const [faqs, setFaqs] = useState([])
  const [faqsLoading, setFaqsLoading] = useState(true)
  const [selectedFaqCategory, setSelectedFaqCategory] = useState('All')
  const [faqSearch, setFaqSearch] = useState('')
  const [openFaqId, setOpenFaqId] = useState(null)

  // Ticket state
  const [tickets, setTickets] = useState([])
  const [ticketsLoading, setTicketsLoading] = useState(false)
  const [ticketFilter, setTicketFilter] = useState('all')
  const [ticketSearch, setTicketSearch] = useState('')
  const [ticketCounts, setTicketCounts] = useState({ all: 0, open: 0, waiting: 0, resolved: 0, closed: 0 })

  // Modals state
  const [isRaiseModalOpen, setIsRaiseModalOpen] = useState(false)
  const [selectedTicketId, setSelectedTicketId] = useState(null)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)

  // Success / Alert banner
  const [alertMessage, setAlertMessage] = useState(null)

  const showAlert = (msg) => {
    setAlertMessage(msg)
    setTimeout(() => setAlertMessage(null), 5000)
  }

  // Fetch FAQs
  useEffect(() => {
    let isMounted = true
    fetchPublicFaqs()
      .then((items) => {
        if (!isMounted) return
        if (items && items.length > 0) {
          // Merge API faqs with standard fallback defaults
          const merged = [...items]
          DEFAULT_FAQS.forEach((df) => {
            if (!merged.some((m) => m.question.toLowerCase() === df.question.toLowerCase())) {
              merged.push(df)
            }
          })
          setFaqs(merged)
        } else {
          setFaqs(DEFAULT_FAQS)
        }
      })
      .catch(() => {
        if (isMounted) setFaqs(DEFAULT_FAQS)
      })
      .finally(() => {
        if (isMounted) setFaqsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  // Fetch Tickets
  const loadTickets = async () => {
    setTicketsLoading(true)
    try {
      const data = await fetchUserTickets({ status: ticketFilter !== 'all' ? ticketFilter : undefined })
      setTickets(data.items || [])
      if (data.counts) {
        setTicketCounts(data.counts)
      }
    } catch {
      setTickets([])
    } finally {
      setTicketsLoading(false)
    }
  }

  useEffect(() => {
    loadTickets()
  }, [ticketFilter])

  // Filtered FAQs
  const visibleFaqs = faqs.filter((faq) => {
    const matchesCategory =
      selectedFaqCategory === 'All' ||
      faq.category?.toLowerCase() === selectedFaqCategory.toLowerCase()
    const matchesSearch =
      !faqSearch.trim() ||
      `${faq.question} ${faq.answer} ${faq.category}`
        .toLowerCase()
        .includes(faqSearch.trim().toLowerCase())
    return matchesCategory && matchesSearch
  })

  // Filtered Tickets
  const visibleTickets = tickets.filter((t) => {
    if (!ticketSearch.trim()) return true
    const q = ticketSearch.trim().toLowerCase()
    return (
      (t.ticketId && t.ticketId.toLowerCase().includes(q)) ||
      (t.subject && t.subject.toLowerCase().includes(q)) ||
      (t.category && t.category.toLowerCase().includes(q))
    )
  })

  const handleTicketCreated = (newTicket) => {
    showAlert(`Ticket #${newTicket.ticketId} created successfully! Our team is reviewing it.`)
    setActiveTab('tickets')
    setTicketFilter('all')
    loadTickets()
    // Auto-open new ticket details
    setSelectedTicketId(newTicket.ticketId || newTicket.id)
    setIsDetailsModalOpen(true)
  }

  const handleTicketUpdated = (updated) => {
    showAlert(`Ticket #${updated.ticketId} updated. Status: ${updated.status.toUpperCase()}`)
    loadTickets()
  }

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col text-slate-800 font-sans">
      <div className="hidden md:block">
        <WebHeader />
      </div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 md:py-8 space-y-6">
        {/* Global Alert Notification */}
        {alertMessage && (
          <div className="p-4 rounded-2xl bg-emerald-600 text-white font-bold text-xs shadow-lg flex items-center justify-between animate-fadeIn">
            <div className="flex items-center space-x-2">
              <HiCheckCircle className="w-5 h-5 text-emerald-200 shrink-0" />
              <span>{alertMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setAlertMessage(null)}
              className="text-emerald-200 hover:text-white cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Hero Section */}
        <div className="bg-gradient-to-br from-blue-950 via-blue-900 to-indigo-900 text-white p-6 sm:p-10 rounded-3xl shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 max-w-2xl mx-auto text-center space-y-4">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1 bg-amber-400/90 text-slate-950 font-black text-xs uppercase tracking-wider rounded-full shadow-sm">
              <HiSparkles className="w-4 h-4 text-slate-900" />
              <span>24/7 CUSTOMER SUPPORT & HELP DESK</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black tracking-tight">
              How can we help you today?
            </h1>
            <p className="text-xs sm:text-sm text-blue-200">
              Browse quick answers in our FAQ knowledge base or raise a support ticket to connect directly with our resolution specialists.
            </p>

            {/* Quick Hero Search */}
            <div className="max-w-xl mx-auto relative flex items-center">
              <HiMagnifyingGlass className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={activeTab === 'faqs' ? faqSearch : ticketSearch}
                onChange={(e) => {
                  if (activeTab === 'faqs') setFaqSearch(e.target.value)
                  else setTicketSearch(e.target.value)
                }}
                placeholder={
                  activeTab === 'faqs'
                    ? 'Search FAQs (e.g. tracking order, refund timeline, returns)...'
                    : 'Search your tickets by Ticket ID or Subject...'
                }
                className="w-full pl-12 pr-32 py-3.5 bg-white text-slate-900 rounded-2xl text-xs sm:text-sm font-semibold shadow-xl placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/80 focus:bg-white transition-all border border-transparent"
              />
              {(activeTab === 'faqs' ? faqSearch : ticketSearch) && (
                <button
                  type="button"
                  onClick={() => {
                    if (activeTab === 'faqs') setFaqSearch('')
                    else setTicketSearch('')
                  }}
                  className="absolute right-32 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer transition-colors"
                  title="Clear search"
                >
                  <HiXMark className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsRaiseModalOpen(true)}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all cursor-pointer"
              >
                <HiPlus className="w-4 h-4 stroke-2" />
                <span className="hidden sm:inline">Raise Ticket</span>
                <span className="sm:hidden">Raise</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tab Switcher: FAQs vs My Support Tickets */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="flex items-center space-x-2 bg-slate-200/70 p-1.5 rounded-2xl w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab('faqs')}
              className={`flex-1 sm:flex-none px-5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center space-x-2 ${
                activeTab === 'faqs'
                  ? 'bg-white text-blue-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <HiQuestionMarkCircle className="w-4 h-4" />
              <span>Frequently Asked Questions</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('tickets')}
              className={`flex-1 sm:flex-none px-5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center space-x-2 ${
                activeTab === 'tickets'
                  ? 'bg-white text-blue-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <HiTicket className="w-4 h-4" />
              <span>My Support Tickets</span>
              {ticketCounts.open > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-black animate-pulse">
                  {ticketCounts.open} Open
                </span>
              )}
            </button>
          </div>

          {/* Primary Action Button */}
          <button
            type="button"
            onClick={() => setIsRaiseModalOpen(true)}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white text-xs font-bold rounded-2xl shadow-md shadow-blue-600/20 flex items-center justify-center space-x-2 transition-all cursor-pointer self-start sm:self-auto shrink-0"
          >
            <HiPlus className="w-4 h-4 stroke-2" />
            <span>Create New Support Ticket</span>
          </button>
        </div>

        {/* TAB 1: FAQs & Knowledge Base */}
        {activeTab === 'faqs' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left 2 Cols: FAQs List & Category Filters */}
            <div className="lg:col-span-2 space-y-6">
              {/* Category Pills */}
              <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
                {FAQ_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedFaqCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                      selectedFaqCategory === cat
                        ? 'bg-blue-900 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* FAQ Accordion Box */}
              <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-base font-black text-slate-900 flex items-center space-x-2">
                    <HiQuestionMarkCircle className="w-5 h-5 text-blue-600" />
                    <span>Popular Questions & Solutions</span>
                  </h3>
                  <span className="text-xs font-bold text-slate-400">
                    {visibleFaqs.length} {visibleFaqs.length === 1 ? 'article' : 'articles'}
                  </span>
                </div>

                {faqsLoading ? (
                  <div className="space-y-3 animate-pulse py-4">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="h-12 bg-slate-100 rounded-2xl" />
                    ))}
                  </div>
                ) : visibleFaqs.length === 0 ? (
                  <div className="text-center py-10 space-y-3">
                    <HiQuestionMarkCircle className="w-10 h-10 text-slate-300 mx-auto" />
                    <p className="text-xs font-bold text-slate-500">
                      No FAQs matching "{faqSearch}".
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsRaiseModalOpen(true)}
                      className="inline-flex items-center space-x-1.5 text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                    >
                      <HiPlus className="w-4 h-4" />
                      <span>Raise a ticket with your question instead</span>
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {visibleFaqs.map((faq) => {
                      const faqId = faq.id || faq._id
                      const isOpen = openFaqId === faqId
                      return (
                        <div key={faqId} className="py-3.5 transition-all">
                          <button
                            type="button"
                            onClick={() => setOpenFaqId(isOpen ? null : faqId)}
                            className="w-full flex items-center justify-between gap-3 text-left hover:text-blue-700 cursor-pointer text-xs sm:text-sm font-bold transition-colors group"
                          >
                            <span className="flex items-center space-x-2">
                              <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 group-hover:scale-125 transition-transform" />
                              <span className="text-slate-900 group-hover:text-blue-700">
                                {faq.question}
                              </span>
                            </span>
                            <HiChevronDown
                              className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                                isOpen ? 'rotate-180 text-blue-600' : ''
                              }`}
                            />
                          </button>
                          {isOpen && (
                            <div className="mt-3 pl-4 border-l-2 border-blue-500 bg-blue-50/40 p-3.5 rounded-r-2xl text-xs text-slate-700 leading-relaxed font-medium animate-fadeIn">
                              <p className="whitespace-pre-line">{faq.answer}</p>
                              {faq.category && (
                                <div className="mt-2.5 flex items-center space-x-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                  <span>Category: {faq.category}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Need personalized help CTA */}
              <div className="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-3xl p-6 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md">
                <div className="space-y-1 text-center sm:text-left">
                  <h4 className="text-base font-black">Still can't find the answer?</h4>
                  <p className="text-xs text-blue-200">
                    Our dedicated support agents can review your specific order, account, or refund status.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRaiseModalOpen(true)}
                  className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl shadow-md transition-colors cursor-pointer shrink-0 flex items-center space-x-2"
                >
                  <HiTicket className="w-4 h-4" />
                  <span>Raise Support Ticket</span>
                </button>
              </div>
            </div>

            {/* Right Column: Direct Contact & Hotline Cards */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-5 sticky top-24">
                <h3 className="text-base font-black text-slate-900 border-b border-slate-100 pb-3">
                  Direct Support Channels
                </h3>

                <div className="space-y-3">
                  {/* WhatsApp */}
                  <a
                    href="https://wa.me/919876543210"
                    target="_blank"
                    rel="noreferrer"
                    className="bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 p-4 rounded-2xl flex items-center space-x-3.5 transition-colors cursor-pointer group block"
                  >
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <HiChatBubbleLeftRight className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-emerald-950 text-xs sm:text-sm group-hover:text-emerald-800">
                        WhatsApp Chat
                      </h4>
                      <p className="text-[11px] text-emerald-700">Live chat assistance (9 AM - 8 PM)</p>
                    </div>
                  </a>

                  {/* Call Support */}
                  <a
                    href="tel:18005720000"
                    className="bg-blue-50 hover:bg-blue-100/80 border border-blue-200 p-4 rounded-2xl flex items-center space-x-3.5 transition-colors cursor-pointer group block"
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <HiPhone className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-blue-950 text-xs sm:text-sm group-hover:text-blue-800">
                        Toll-Free Phone Helpline
                      </h4>
                      <p className="text-[11px] text-blue-700 font-semibold">1800-KROZENDA (Toll Free)</p>
                    </div>
                  </a>

                  {/* Email */}
                  <a
                    href="mailto:support@krozenda.com"
                    className="bg-slate-50 hover:bg-slate-100 border border-slate-200 p-4 rounded-2xl flex items-center space-x-3.5 transition-colors cursor-pointer group block"
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <HiEnvelope className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs sm:text-sm group-hover:text-blue-900">
                        Email Helpdesk
                      </h4>
                      <p className="text-[11px] text-slate-500 font-medium">support@krozenda.com</p>
                    </div>
                  </a>
                </div>

                {/* Operating hours note */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-[11px] text-slate-500 space-y-1">
                  <div className="font-bold text-slate-700">Support Hours:</div>
                  <div>Monday to Saturday: 09:30 AM to 07:00 PM IST</div>
                  <div>Tickets submitted outside hours are answered next business day.</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: My Support Tickets */}
        {activeTab === 'tickets' && (
          <div className="space-y-6">
            {/* Filter Pills & Stats Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                {TICKET_FILTER_TABS.map((tab) => {
                  const count = ticketCounts[tab.id] ?? 0
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setTicketFilter(tab.id)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 shrink-0 ${
                        ticketFilter === tab.id
                          ? 'bg-blue-900 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <span>{tab.label}</span>
                      {count > 0 && (
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                            ticketFilter === tab.id
                              ? 'bg-white text-blue-900'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              <div className="relative w-full sm:w-64">
                <HiMagnifyingGlass className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={ticketSearch}
                  onChange={(e) => setTicketSearch(e.target.value)}
                  placeholder="Filter by Ticket ID / Subject..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Tickets List */}
            {ticketsLoading ? (
              <div className="space-y-4 animate-pulse">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-28 bg-white border border-slate-200 rounded-3xl" />
                ))}
              </div>
            ) : visibleTickets.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center space-y-4 shadow-xs">
                <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-xs">
                  <HiTicket className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-black text-slate-900">No support tickets found</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    {ticketFilter !== 'all'
                      ? `You don't have any tickets with status "${ticketFilter}".`
                      : 'You have not raised any support inquiries yet. Whenever you experience an issue with an order, shipment, or refund, create a ticket here!'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRaiseModalOpen(true)}
                  className="px-6 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-md transition-colors cursor-pointer inline-flex items-center space-x-2"
                >
                  <HiPlus className="w-4 h-4 stroke-2" />
                  <span>Raise Support Ticket</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {visibleTickets.map((t) => {
                  const id = t.ticketId || t.id
                  const isResolved = t.status === 'resolved' || t.status === 'closed'
                  const lastMessage =
                    t.messages && t.messages.length > 0
                      ? t.messages[t.messages.length - 1]
                      : null

                  return (
                    <div
                      key={id}
                      className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs hover:shadow-md hover:border-blue-200 transition-all space-y-4 cursor-pointer"
                      onClick={() => {
                        setSelectedTicketId(id)
                        setIsDetailsModalOpen(true)
                      }}
                    >
                      {/* Ticket Card Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 border-b border-slate-100 pb-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-black text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg">
                            #{id}
                          </span>
                          <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                            {t.category}
                          </span>
                          {t.orderNumber && (
                            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">
                              Order #{t.orderNumber}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-2">
                          {/* Priority tag */}
                          <span
                            className={`text-[11px] font-black uppercase px-2 py-0.5 rounded-md ${
                              t.priority === 'urgent'
                                ? 'bg-rose-100 text-rose-700'
                                : t.priority === 'high'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {t.priority}
                          </span>

                          {/* Status Badge */}
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black border ${
                              t.status === 'open'
                                ? 'bg-sky-50 text-sky-700 border-sky-200'
                                : t.status === 'waiting'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : t.status === 'resolved'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5" />
                            {t.status.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      {/* Subject and Preview */}
                      <div className="space-y-1.5">
                        <h4 className="text-sm sm:text-base font-extrabold text-slate-900 leading-snug">
                          {t.subject}
                        </h4>
                        {lastMessage && (
                          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed font-medium">
                            <span className="font-bold text-slate-700">
                              {lastMessage.sender === 'user' ? 'You' : lastMessage.senderName}:
                            </span>{' '}
                            {lastMessage.message}
                          </p>
                        )}
                      </div>

                      {/* Ticket Footer */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 text-xs text-slate-400 font-medium">
                        <div className="flex items-center space-x-4">
                          <span className="flex items-center space-x-1">
                            <HiClock className="w-3.5 h-3.5" />
                            <span>Opened: {t.openedAt || 'Recently'}</span>
                          </span>
                          <span>·</span>
                          <span>{t.messages?.length || 1} messages</span>
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedTicketId(id)
                              setIsDetailsModalOpen(true)
                            }}
                            className="px-4 py-1.5 rounded-xl bg-blue-50 text-blue-700 font-bold hover:bg-blue-100 transition-colors cursor-pointer"
                          >
                            View Conversation & Updates →
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </main>

      <Footer />

      {/* Raise Ticket Modal */}
      <RaiseTicketModal
        isOpen={isRaiseModalOpen}
        onClose={() => setIsRaiseModalOpen(false)}
        onTicketCreated={handleTicketCreated}
      />

      {/* Ticket Details & Resolution Modal */}
      <TicketDetailsModal
        ticketId={selectedTicketId}
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        onTicketUpdated={handleTicketUpdated}
      />
    </div>
  )
}

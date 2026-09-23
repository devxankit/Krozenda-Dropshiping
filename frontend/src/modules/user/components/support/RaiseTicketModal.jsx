import React, { useState, useEffect } from 'react'
import {
  HiXMark,
  HiTicket,
  HiShoppingBag,
  HiArrowPath,
  HiCreditCard,
  HiShieldCheck,
  HiExclamationCircle,
  HiQuestionMarkCircle,
  HiPaperAirplane,
} from 'react-icons/hi2'
import { createSupportTicket } from '../../services/ticketService'
import { fetchUserOrders } from '../../services/orderService'
import { useAuthStore } from '../../../../lib/authStore'
import { toast } from '../../../../lib/toast'

const CATEGORIES = [
  { id: 'Orders & Delivery', label: 'Order & Delivery', icon: HiShoppingBag, desc: 'Delay, courier tracking, wrong address' },
  { id: 'Returns & Refunds', label: 'Returns & Refunds', icon: HiArrowPath, desc: 'Return request, pickup, refund status' },
  { id: 'Payments & Billing', label: 'Payment & Billing', icon: HiCreditCard, desc: 'Payment failed, UPI, invoice download' },
  { id: 'Damaged or Defective Item', label: 'Damaged / Defective', icon: HiExclamationCircle, desc: 'Broken, missing parts, wrong item' },
  { id: 'Account & Security', label: 'Account & Security', icon: HiShieldCheck, desc: 'OTP issue, password, profile' },
  { id: 'General Inquiry', label: 'General Inquiry', icon: HiQuestionMarkCircle, desc: 'Offers, feedback, general queries' },
]

const PRIORITIES = [
  { id: 'low', label: 'Low', color: 'text-slate-600 bg-slate-100 border-slate-200' },
  { id: 'normal', label: 'Normal', color: 'text-blue-700 bg-blue-50 border-blue-200' },
  { id: 'high', label: 'High', color: 'text-amber-700 bg-amber-50 border-amber-200' },
  { id: 'urgent', label: 'Urgent', color: 'text-rose-700 bg-rose-50 border-rose-200' },
]

export function RaiseTicketModal({ isOpen, onClose, onTicketCreated }) {
  const user = useAuthStore((s) => s.user)

  const [category, setCategory] = useState(CATEGORIES[0].id)
  const [priority, setPriority] = useState('normal')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [customOrderNumber, setCustomOrderNumber] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  const [orders, setOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (isOpen) {
      if (user) {
        setName(user.name || '')
        setEmail(user.email || '')
        setPhone(user.mobileNumber || user.phone || '')
      }
      // Load user orders for order picker
      setOrdersLoading(true)
      fetchUserOrders()
        .then((items) => setOrders(items || []))
        .catch(() => setOrders([]))
        .finally(() => setOrdersLoading(false))
    } else {
      // Reset form
      setSubject('')
      setDescription('')
      setSelectedOrderId('')
      setCustomOrderNumber('')
      setErrorMsg('')
    }
  }, [isOpen, user])

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')

    if (!subject.trim()) {
      setErrorMsg('Please enter a brief subject for your issue.')
      return
    }
    if (!description.trim()) {
      setErrorMsg('Please provide a detailed description so our team can help you.')
      return
    }

    setSubmitting(true)
    try {
      const selectedOrder = orders.find((o) => (o.id || o._id) === selectedOrderId)
      const orderNumber = selectedOrder
        ? (selectedOrder.orderNumber || selectedOrder.id || selectedOrder._id)
        : customOrderNumber.trim()

      const payload = {
        subject: subject.trim(),
        category,
        priority,
        message: description.trim(),
        orderId: selectedOrderId || undefined,
        orderNumber: orderNumber || undefined,
        name: name.trim() || 'Customer',
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
      }

      const newTicket = await createSupportTicket(payload)
      if (onTicketCreated) {
        onTicketCreated(newTicket)
      }
      toast.success('Ticket Raised', 'Our support team has been notified.')
      onClose()
    } catch (err) {
      const msg = err.message || 'Failed to raise support ticket. Please try again.'
      setErrorMsg(msg)
      toast.error('Could not create ticket', err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-100 overflow-hidden my-8 transform transition-all">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-950 text-white p-6 relative">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold">
              <HiTicket className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black">Raise a Support Ticket</h3>
              <p className="text-xs text-blue-200">
                Our support team is active 24/7 to resolve your inquiries promptly.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-5 top-5 text-blue-200 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-xl transition-colors cursor-pointer"
          >
            <HiXMark className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center space-x-2">
              <HiExclamationCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. Category Picker */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 block">
              1. Select Issue Category <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon
                const isSelected = category === cat.id
                return (
                  <button
                    type="button"
                    key={cat.id}
                    onClick={() => setCategory(cat.id)}
                    className={`flex items-start p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/70 ring-1 ring-blue-600 text-blue-900 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center mr-3 shrink-0 ${
                        isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold leading-tight">{cat.label}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{cat.desc}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 2. Priority Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 block">
              2. Priority Level
            </label>
            <div className="grid grid-cols-4 gap-2">
              {PRIORITIES.map((p) => {
                const isSelected = priority === p.id
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => setPriority(p.id)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer ${
                      isSelected
                        ? `${p.color} ring-2 ring-blue-400 shadow-xs font-black`
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 3. Link Recent Order (Optional) */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 block">
              3. Link Related Order <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            {orders.length > 0 ? (
              <select
                value={selectedOrderId}
                onChange={(e) => setSelectedOrderId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
              >
                <option value="">-- No specific order / General inquiry --</option>
                {orders.map((ord) => {
                  const ordId = ord.id || ord._id
                  const ordTotal = ord.total ? `₹${ord.total}` : ''
                  const ordDate = ord.createdAt
                    ? new Date(ord.createdAt).toLocaleDateString('en-GB')
                    : ''
                  return (
                    <option key={ordId} value={ordId}>
                      Order #{ordId.slice(-8)} {ordTotal ? `• ${ordTotal}` : ''} {ordDate ? `• ${ordDate}` : ''}
                    </option>
                  )
                })}
              </select>
            ) : (
              <input
                type="text"
                value={customOrderNumber}
                onChange={(e) => setCustomOrderNumber(e.target.value)}
                placeholder="Enter Order ID if applicable (e.g. ORD-9821)"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
              />
            )}
          </div>

          {/* 4. Subject */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">
              4. Subject / Issue Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g., Courier tracking shows delivered but not received"
              maxLength={120}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>Be concise and clear</span>
              <span>{subject.length}/120</span>
            </div>
          </div>

          {/* 5. Detailed Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">
              5. Detailed Description <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Please explain the issue in detail, including what happened, expected resolution, or any reference numbers..."
              maxLength={1500}
              className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 leading-relaxed"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>Provide all relevant details to help us solve this faster</span>
              <span>{description.length}/1500</span>
            </div>
          </div>

          {/* Contact Details (if guest or to confirm) */}
          {!user && (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
              <span className="text-xs font-bold text-slate-700 block">
                Your Contact Information (for updates)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  type="text"
                  placeholder="Your Full Name *"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500"
                />
                <input
                  type="email"
                  placeholder="Email Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500"
                />
                <input
                  type="tel"
                  placeholder="Mobile Number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* Modal Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white text-xs font-bold shadow-md shadow-blue-500/20 flex items-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <span>Submitting...</span>
              ) : (
                <>
                  <HiPaperAirplane className="w-4 h-4" />
                  <span>Submit Support Ticket</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

import React, { useState, useEffect, useRef } from 'react'
import {
  HiXMark,
  HiCheckCircle,
  HiArrowPath,
  HiPaperAirplane,
  HiShoppingBag,
  HiClock,
  HiShieldCheck,
  HiChatBubbleLeftRight,
  HiExclamationTriangle,
  HiSparkles,
} from 'react-icons/hi2'
import {
  fetchTicketDetails,
  sendTicketMessage,
  updateTicketStatus,
} from '../../services/ticketService'
import { useAuthStore } from '../../../../lib/authStore'
import { toast } from '../../../../lib/toast'

const STATUS_BADGES = {
  open: { label: 'Open', bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
  waiting: { label: 'In Review', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  resolved: { label: 'Resolved', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  closed: { label: 'Closed', bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' },
}

const PRIORITY_BADGES = {
  low: { label: 'Low Priority', text: 'text-slate-500' },
  normal: { label: 'Normal Priority', text: 'text-blue-600' },
  high: { label: 'High Priority', text: 'text-amber-600' },
  urgent: { label: 'Urgent Priority', text: 'text-rose-600' },
}

export function TicketDetailsModal({ ticketId, isOpen, onClose, onTicketUpdated }) {
  const user = useAuthStore((s) => s.user)

  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [replyText, setReplyText] = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [showResolveConfirm, setShowResolveConfirm] = useState(false)
  const [resolutionNote, setResolutionNote] = useState('')

  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadTicket = async (id) => {
    setLoading(true)
    setErrorMsg('')
    try {
      const data = await fetchTicketDetails(id)
      setTicket(data)
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load ticket details.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && ticketId) {
      loadTicket(ticketId)
    } else {
      setTicket(null)
      setReplyText('')
      setShowResolveConfirm(false)
      setResolutionNote('')
    }
  }, [isOpen, ticketId])

  useEffect(() => {
    if (ticket?.messages?.length) {
      scrollToBottom()
    }
  }, [ticket?.messages])

  if (!isOpen) return null

  const handleSendReply = async (e) => {
    e.preventDefault()
    if (!replyText.trim()) return

    setSendingReply(true)
    setErrorMsg('')
    try {
      const updated = await sendTicketMessage(
        ticket.ticketId || ticket.id,
        replyText.trim(),
        user?.name || ticket.name || 'Customer'
      )
      setTicket(updated)
      setReplyText('')
      toast.success('Message Sent', 'Your message was added to this ticket.')
      if (onTicketUpdated) onTicketUpdated(updated)
    } catch (err) {
      const msg = err.message || 'Failed to send message. Please try again.'
      setErrorMsg(msg)
      toast.error('Could not send message', err)
    } finally {
      setSendingReply(false)
    }
  }

  const handleUpdateStatus = async (newStatus, note = '') => {
    setUpdatingStatus(true)
    setErrorMsg('')
    try {
      const updated = await updateTicketStatus(ticket.ticketId || ticket.id, newStatus, note)
      setTicket(updated)
      setShowResolveConfirm(false)
      toast.success('Ticket Updated', `Status changed to ${newStatus}.`)
      if (onTicketUpdated) onTicketUpdated(updated)
    } catch (err) {
      const msg = err.message || 'Failed to update ticket status.'
      setErrorMsg(msg)
      toast.error('Could not update status', err)
    } finally {
      setUpdatingStatus(false)
    }
  }

  const isResolvedOrClosed = ticket?.status === 'resolved' || ticket?.status === 'closed'
  const statusBadge = STATUS_BADGES[ticket?.status] || STATUS_BADGES.open
  const priorityBadge = PRIORITY_BADGES[ticket?.priority] || PRIORITY_BADGES.normal

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full border border-slate-100 overflow-hidden my-6 flex flex-col max-h-[90vh]">
        {/* Modal Top Header */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white p-5 sm:p-6 shrink-0 relative">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pr-10">
            <div className="space-y-1">
              <div className="flex items-center space-x-2.5">
                <span className="font-mono text-amber-400 font-extrabold text-sm tracking-wide">
                  #{ticket?.ticketId || ticketId}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/10 text-slate-200 font-semibold">
                  {ticket?.category || 'Support'}
                </span>
                <span className={`text-xs font-bold ${priorityBadge.text}`}>
                  {priorityBadge.label}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white line-clamp-1">
                {ticket?.subject || 'Loading ticket...'}
              </h2>
            </div>

            {ticket && (
              <div className="flex items-center space-x-2">
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold border ${statusBadge.bg} ${statusBadge.text} ${statusBadge.border}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 animate-pulse" />
                  {statusBadge.label}
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 text-slate-400 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-xl transition-colors cursor-pointer"
          >
            <HiXMark className="w-5 h-5" />
          </button>
        </div>

        {/* Status Lifecycle Progress Bar */}
        {ticket && (
          <div className="bg-slate-50 border-b border-slate-200/80 px-6 py-3 shrink-0 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2 text-xs">
              <span className="text-slate-400 font-medium">Timeline:</span>
              <div className="flex items-center space-x-1.5">
                <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-bold text-[11px]">
                  1. Created
                </span>
                <span className="text-slate-300">→</span>
                <span
                  className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                    ticket.status === 'open'
                      ? 'bg-slate-200 text-slate-500'
                      : 'bg-purple-100 text-purple-800'
                  }`}
                >
                  2. In Review
                </span>
                <span className="text-slate-300">→</span>
                <span
                  className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                    isResolvedOrClosed
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  3. {ticket.status === 'closed' ? 'Closed' : 'Resolved'}
                </span>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center space-x-2">
              {!isResolvedOrClosed ? (
                <button
                  type="button"
                  onClick={() => setShowResolveConfirm(true)}
                  disabled={updatingStatus}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <HiCheckCircle className="w-4 h-4" />
                  <span>Mark as Resolved</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleUpdateStatus('open')}
                  disabled={updatingStatus}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <HiArrowPath className="w-4 h-4" />
                  <span>Reopen Ticket</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Confirmation Modal for Marking Resolved */}
        {showResolveConfirm && (
          <div className="bg-emerald-50 border-b border-emerald-200 p-4 space-y-3 animate-fadeIn">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-xs font-extrabold text-emerald-900">
                  Are you satisfied with the resolution of this issue?
                </h4>
                <p className="text-[11px] text-emerald-700 mt-0.5">
                  Marking this ticket as resolved lets our team know your issue has been settled. You can still reopen it anytime if you need more assistance.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowResolveConfirm(false)}
                className="text-emerald-700 hover:text-emerald-900"
              >
                <HiXMark className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                placeholder="Optional closing remark (e.g. Received replacement item, refund credited)"
                className="flex-1 px-3 py-1.5 bg-white border border-emerald-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={() => handleUpdateStatus('resolved', resolutionNote)}
                disabled={updatingStatus}
                className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Confirm Resolved
              </button>
            </div>
          </div>
        )}

        {/* Order Reference Info Card (if linked) */}
        {ticket?.orderNumber && (
          <div className="px-6 py-2.5 bg-blue-50/50 border-b border-blue-100 flex items-center space-x-2 text-xs text-blue-900 font-semibold">
            <HiShoppingBag className="w-4 h-4 text-blue-600 shrink-0" />
            <span>Associated with Order #{ticket.orderNumber}</span>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div className="px-6 py-2 bg-rose-50 border-b border-rose-200 text-rose-700 text-xs font-bold flex items-center space-x-2">
            <HiExclamationTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Messages / Conversation Thread */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-slate-50/50">
          {loading ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-400 font-bold">Fetching ticket conversation...</p>
            </div>
          ) : !ticket?.messages?.length ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No messages recorded yet for this ticket.
            </div>
          ) : (
            ticket.messages.map((m, idx) => {
              const isUser = m.sender === 'user'
              const isSystem = m.sender === 'system'
              const msgDate = m.createdAt
                ? new Date(m.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    day: 'numeric',
                    month: 'short',
                  })
                : ''

              if (isSystem) {
                return (
                  <div key={idx} className="flex justify-center my-3">
                    <div className="bg-slate-200/80 text-slate-600 text-[11px] font-semibold px-4 py-1.5 rounded-full flex items-center space-x-1.5 shadow-2xs">
                      <HiShieldCheck className="w-3.5 h-3.5 text-slate-500" />
                      <span>{m.message}</span>
                      <span className="text-slate-400 font-normal ml-1">· {msgDate}</span>
                    </div>
                  </div>
                )
              }

              return (
                <div
                  key={idx}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center space-x-2 mb-1 px-1">
                    <span className="text-[11px] font-black text-slate-700">
                      {isUser ? m.senderName || 'You (Customer)' : m.senderName || 'Krozenda Support Specialist'}
                    </span>
                    {!isUser && (
                      <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-800 text-[9px] font-black rounded-md uppercase">
                        Support Staff
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400 font-medium">{msgDate}</span>
                  </div>

                  <div
                    className={`max-w-xl p-4 rounded-2xl text-xs font-medium leading-relaxed shadow-xs ${
                      isUser
                        ? 'bg-blue-600 text-white rounded-tr-none'
                        : 'bg-white border border-slate-200/80 text-slate-800 rounded-tl-none'
                    }`}
                  >
                    <p className="whitespace-pre-line">{m.message}</p>
                  </div>
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Resolved Banner */}
        {isResolvedOrClosed && (
          <div className="px-6 py-3 bg-emerald-50 border-t border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <HiCheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>
                This ticket was marked as <strong>{ticket.status}</strong>. If your issue persists, you can send a reply or click "Reopen Ticket".
              </span>
            </div>
          </div>
        )}

        {/* Message Input Footer */}
        <div className="p-4 bg-white border-t border-slate-200 shrink-0">
          <form onSubmit={handleSendReply} className="flex items-center space-x-2.5">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={
                isResolvedOrClosed
                  ? 'Type a message to reopen and ask further questions...'
                  : 'Type a message or provide additional details...'
              }
              className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={!replyText.trim() || sendingReply}
              className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-2xl text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer shadow-sm shadow-blue-600/20 disabled:opacity-40"
            >
              {sendingReply ? (
                <span>Sending...</span>
              ) : (
                <>
                  <HiPaperAirplane className="w-4 h-4" />
                  <span>Reply</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

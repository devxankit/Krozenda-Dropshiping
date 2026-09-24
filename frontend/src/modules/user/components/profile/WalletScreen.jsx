import { useState } from 'react'
import {
  HiArrowLeft,
  HiWallet,
  HiPlus,
  HiArrowUpRight,
  HiArrowDownLeft,
  HiXMark,
  HiCreditCard,
  HiShoppingBag,
  HiArrowPath,
  HiCheckCircle,
  HiClock,
  HiExclamationCircle,
} from 'react-icons/hi2'
import { useNavigate } from 'react-router-dom'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { Footer } from '../../../../components/layout/Footer'
import { useWalletController } from '../../controllers/useWalletController'
import { useProfileController } from '../../controllers/useProfileController'
import { useAuthStore } from '../../../../lib/authStore'
import { usePageMeta } from '../../../../lib/usePageMeta'
import { toast } from '../../../../lib/toast'

// ─── Constants ────────────────────────────────────────────────────────────────

const QUICK_AMOUNTS = [200, 500, 1000, 2000, 5000]

// Maps transaction source to display label + icon + color
const SOURCE_META = {
  TOPUP: {
    label: 'Wallet Top-up',
    Icon: HiCreditCard,
    bg: 'bg-blue-50',
    text: 'text-blue-600',
  },
  ORDER_PAYMENT: {
    label: 'Order Payment',
    Icon: HiShoppingBag,
    bg: 'bg-purple-50',
    text: 'text-purple-600',
  },
  ORDER_REFUND: {
    label: 'Order Refund',
    Icon: HiArrowPath,
    bg: 'bg-emerald-50',
    text: 'text-emerald-600',
  },
}

const STATUS_META = {
  SUCCESS: { label: 'Success', Icon: HiCheckCircle, color: 'text-emerald-600' },
  PENDING: { label: 'Pending', Icon: HiClock, color: 'text-amber-500' },
  FAILED: { label: 'Failed', Icon: HiExclamationCircle, color: 'text-red-500' },
}

// ─── Add Money Modal ──────────────────────────────────────────────────────────

function AddMoneyModal({ open, onClose, onConfirm, isSubmitting }) {
  const [amount, setAmount] = useState('500')
  const [error, setError] = useState(null)

  if (!open) return null

  const handleConfirm = async () => {
    const value = Number(amount)
    if (!Number.isFinite(value) || value < 10) {
      setError('Please enter an amount of at least ₹10')
      return
    }
    setError(null)
    try {
      await onConfirm(value)
      onClose()
    } catch (err) {
      setError(err?.message || 'Payment could not be completed. Please try again.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-sm sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-400 flex items-center justify-center">
              <HiWallet className="w-5 h-5 text-slate-900" />
            </div>
            <h2 className="text-sm font-black text-slate-900">Add Money to Wallet</h2>
          </div>
          <button
            id="wallet-modal-close"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
          >
            <HiXMark className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Amount Input */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 block mb-1.5">Enter Amount</label>
            <div className="flex items-center bg-slate-50 border-2 border-slate-200 rounded-2xl px-4 py-3 focus-within:border-blue-500 focus-within:bg-white transition-all">
              <span className="text-lg font-black text-slate-400 mr-1.5">₹</span>
              <input
                id="wallet-topup-amount"
                type="number"
                min="10"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-transparent text-xl font-black text-slate-900 focus:outline-none"
                placeholder="0"
              />
            </div>
          </div>

          {/* Quick Amount Chips */}
          <div>
            <span className="text-[11px] font-bold text-slate-400 block mb-2">Quick Select</span>
            <div className="flex flex-wrap gap-2">
              {QUICK_AMOUNTS.map((value) => (
                <button
                  key={value}
                  id={`wallet-quick-${value}`}
                  onClick={() => setAmount(String(value))}
                  className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                    Number(amount) === value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-700'
                  }`}
                >
                  ₹{value.toLocaleString('en-IN')}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <button
            id="wallet-topup-proceed"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold py-3.5 rounded-2xl text-sm tracking-wide transition-colors shadow-md shadow-blue-500/20"
          >
            {isSubmitting ? 'Processing…' : `Add ₹${Number(amount || 0).toLocaleString('en-IN')} →`}
          </button>

          <p className="text-center text-[11px] text-slate-400">
            Secured by Razorpay · UPI, Cards & Net Banking accepted
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Transaction Item ─────────────────────────────────────────────────────────

function TransactionItem({ tx }) {
  const isCredit = tx.type === 'CREDIT'
  const source = SOURCE_META[tx.source] || SOURCE_META.TOPUP
  const SourceIcon = source.Icon
  const statusMeta = STATUS_META[tx.status?.toUpperCase?.()] || STATUS_META.SUCCESS
  const StatusIcon = statusMeta.Icon

  const date = new Date(tx.createdAt)
  const dateStr = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  const timeStr = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="flex items-center gap-3 py-3.5 px-1">
      {/* Source Icon */}
      <div className={`w-10 h-10 rounded-xl ${source.bg} ${source.text} flex items-center justify-center flex-shrink-0`}>
        <SourceIcon className="w-5 h-5" />
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-bold text-slate-900 truncate">{source.label}</p>
          <div className={`flex items-center gap-0.5 ${statusMeta.color}`}>
            <StatusIcon className="w-3 h-3" />
            <span className="text-[10px] font-semibold">{statusMeta.label}</span>
          </div>
        </div>
        <p className="text-[11px] text-slate-400 mt-0.5">
          {dateStr} · {timeStr}
        </p>
        <p className="text-[10px] text-slate-400 mt-0.5">
          Balance: ₹{tx.balanceAfter.toLocaleString('en-IN')}
        </p>
      </div>

      {/* Amount */}
      <div className="text-right flex-shrink-0">
        <div className={`flex items-center gap-0.5 justify-end font-black text-sm ${isCredit ? 'text-emerald-600' : 'text-red-500'}`}>
          {isCredit ? <HiArrowDownLeft className="w-4 h-4" /> : <HiArrowUpRight className="w-4 h-4" />}
          ₹{tx.amount.toLocaleString('en-IN')}
        </div>
        <span className={`text-[10px] font-bold ${isCredit ? 'text-emerald-500' : 'text-red-400'}`}>
          {isCredit ? 'Credit' : 'Debit'}
        </span>
      </div>
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyTransactions({ onAddMoney }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center mb-4 text-4xl">
        💸
      </div>
      <h3 className="text-sm font-black text-slate-900">No transactions yet</h3>
      <p className="text-xs text-slate-400 mt-1.5 max-w-xs">
        Add money to your Krozenda Wallet to pay faster at checkout — no OTP needed!
      </p>
      <button
        id="wallet-empty-add-money"
        onClick={onAddMoney}
        className="mt-5 flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-5 py-2.5 rounded-2xl shadow-sm transition-colors"
      >
        <HiPlus className="w-4 h-4" />
        Add Money Now
      </button>
    </div>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function WalletScreen() {
  const navigate = useNavigate()
  const authUser = useAuthStore((state) => state.user)
  const { profile } = useProfileController()
  const { balance, transactions, isLoading, topup, isToppingUp } = useWalletController()
  const [showAddMoney, setShowAddMoney] = useState(false)

  usePageMeta({ title: 'My Wallet — Krozenda', noindex: true })

  const user = {
    name: profile?.name || authUser?.name || 'Customer',
    email: profile?.email || authUser?.email || '',
    mobile: profile?.mobileNumber || authUser?.mobileNumber || authUser?.phone || '',
  }

  const handleTopup = (amount) =>
    topup(amount, { name: user.name, email: user.email, contact: user.mobile })
      .then(() =>
        toast.success('Money Added!', `₹${amount.toLocaleString('en-IN')} credited to your Krozenda Wallet.`)
      )
      .catch((err) => {
        if (err?.message !== 'Payment cancelled') {
          toast.error('Top-up Failed', err)
        }
      })

  // Split into credits and debits for the summary stats
  const totalCredited = transactions
    .filter((tx) => tx.type === 'CREDIT' && tx.status?.toUpperCase() !== 'FAILED')
    .reduce((sum, tx) => sum + tx.amount, 0)

  const totalSpent = transactions
    .filter((tx) => tx.type === 'DEBIT' && tx.status?.toUpperCase() !== 'FAILED')
    .reduce((sum, tx) => sum + tx.amount, 0)

  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-50 font-sans text-slate-800">
      {/* Desktop header */}
      <div className="sticky top-0 z-50 hidden md:block">
        <WebHeader />
      </div>

      {/* Mobile-style topbar */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            id="wallet-back-btn"
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-800 transition-colors hover:bg-slate-100"
          >
            <HiArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-base font-bold text-slate-900">My Wallet</h1>
        </div>
      </div>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-4 pb-32 space-y-4 sm:px-6 md:py-8 md:pb-16 lg:px-8">

        {/* ── Balance Hero Card ── */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 p-6 text-white shadow-xl shadow-blue-900/30">
          {/* Background decoration */}
          <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/5" />
          <div className="absolute -bottom-8 -left-4 w-40 h-40 rounded-full bg-white/5" />

          <div className="relative">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-xl bg-amber-400 flex items-center justify-center">
                    <HiWallet className="w-4 h-4 text-slate-900" />
                  </div>
                  <span className="text-xs font-bold text-blue-200 uppercase tracking-widest">Krozenda Wallet</span>
                </div>
                <p className="text-blue-300 text-[11px] font-medium mt-2">{user.name}</p>
              </div>

              <button
                id="wallet-add-money-hero"
                onClick={() => setShowAddMoney(true)}
                className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 border border-white/20 backdrop-blur text-white text-xs font-bold px-4 py-2 rounded-xl transition-all"
              >
                <HiPlus className="w-3.5 h-3.5" />
                Add Money
              </button>
            </div>

            {/* Balance */}
            <div>
              <p className="text-blue-300 text-[11px] font-medium mb-0.5">Available Balance</p>
              {isLoading ? (
                <div className="h-9 w-36 rounded-xl bg-white/10 animate-pulse" />
              ) : (
                <p className="text-4xl font-black tracking-tight">
                  ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                <HiArrowDownLeft className="w-4 h-4 text-emerald-600" />
              </div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Total Added</span>
            </div>
            <p className="text-lg font-black text-emerald-600">
              ₹{totalCredited.toLocaleString('en-IN')}
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center">
                <HiArrowUpRight className="w-4 h-4 text-red-500" />
              </div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Total Spent</span>
            </div>
            <p className="text-lg font-black text-red-500">
              ₹{totalSpent.toLocaleString('en-IN')}
            </p>
          </div>
        </div>

        {/* ── Transaction History ── */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">Transaction History</h2>
            {transactions.length > 0 && (
              <span className="text-[11px] font-bold text-slate-400">{transactions.length} transactions</span>
            )}
          </div>

          {isLoading ? (
            // Skeleton
            <div className="divide-y divide-slate-100 px-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-3.5 animate-pulse">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-32 bg-slate-100 rounded" />
                    <div className="h-2.5 w-24 bg-slate-100 rounded" />
                  </div>
                  <div className="h-4 w-16 bg-slate-100 rounded" />
                </div>
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <EmptyTransactions onAddMoney={() => setShowAddMoney(true)} />
          ) : (
            <div className="divide-y divide-slate-100 px-4">
              {transactions.map((tx) => (
                <TransactionItem key={tx.id} tx={tx} />
              ))}
            </div>
          )}
        </div>

        {/* ── How it works ── */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-5 text-white">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 mb-3">How Krozenda Wallet Works</h3>
          <div className="space-y-2.5">
            {[
              { emoji: '⚡', text: 'Pay instantly at checkout — no OTP, no redirects' },
              { emoji: '🔄', text: 'Refunds are credited to your wallet automatically' },
              { emoji: '🔒', text: 'Your money is safe — protected by Razorpay' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="text-base">{item.emoji}</span>
                <p className="text-xs text-slate-300 leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <Footer />

      {/* Mobile bottom nav */}
      <div className="fixed inset-x-0 bottom-0 z-50 md:hidden">
        <BottomNavbar activeTab="profile" />
      </div>

      {/* Topup Modal */}
      <AddMoneyModal
        open={showAddMoney}
        onClose={() => setShowAddMoney(false)}
        onConfirm={handleTopup}
        isSubmitting={isToppingUp}
      />
    </div>
  )
}

import React, { useState } from 'react'
import { HiArrowLeft, HiMinus, HiPlus, HiShieldCheck, HiCheck, HiTrash } from 'react-icons/hi2'
import { WebHeader } from '../../../../components/layout/WebHeader'

export function CartPageScreen({ onBack = () => {}, onCheckout = () => {} }) {
  const [items, setItems] = useState([
    { id: 1, name: 'Samsung Galaxy S23 5G', subtitle: '(Phantom Black, 128GB)', price: 49999, quantity: 1, image: '/images/samsung_s23.png' },
    { id: 2, name: 'boAt Airdopes 141', subtitle: 'Wireless Earbuds', price: 1299, quantity: 1, image: '/images/boat_airdopes.png' },
    { id: 3, name: 'Portronics Power Bank', subtitle: '10000mAh', price: 1199, quantity: 1, image: '/images/iphone_14.png' },
  ])
  const [securePackaging, setSecurePackaging] = useState(true)

  const updateQuantity = (id, delta) => {
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item))
  }

  const removeItem = (id) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  const itemsTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const packagingFee = securePackaging ? 49 : 0
  const totalAmount = itemsTotal + packagingFee

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col text-slate-800 font-sans">
      <div className="hidden md:block">
        <WebHeader />
      </div>

      {/* Main Responsive Layout */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 md:py-8">
        {/* Mobile Header Bar */}
        <div className="md:hidden py-3 bg-white border-b border-slate-200 flex items-center justify-between shadow-xs mb-4 rounded-xl px-4">
          <div className="flex items-center space-x-3">
            <button onClick={onBack} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700">
              <HiArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-base font-bold text-slate-900">My Cart ({items.length})</h2>
          </div>
          <button className="text-xs font-bold text-blue-600 hover:underline">Edit</button>
        </div>

        {/* Free Delivery Banner */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 mb-6 flex items-center justify-between text-xs font-bold text-emerald-800 shadow-xs">
          <div className="flex items-center space-x-2">
            <span className="text-base">🎉</span>
            <span>Yay! You got FREE Express Pan-India Delivery on this order</span>
          </div>
          <span className="hidden sm:inline text-[11px] bg-emerald-200/60 text-emerald-900 px-2.5 py-1 rounded-full font-extrabold">
            SAVED ₹149
          </span>
        </div>

        {/* Desktop 2-Column Split Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Cart Items List */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <h1 className="text-lg md:text-xl font-black text-slate-900">
                Shopping Cart ({items.length} Items)
              </h1>
              <button
                onClick={() => setItems([])}
                className="text-xs font-bold text-red-600 hover:underline flex items-center space-x-1"
              >
                <HiTrash className="w-4 h-4" />
                <span>Clear All</span>
              </button>
            </div>

            {items.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4">
                <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto text-3xl">
                  🛒
                </div>
                <h3 className="text-lg font-bold text-slate-900">Your cart is currently empty</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Explore thousands of wholesale factory products and add items to your cart.
                </p>
                <button
                  onClick={onBack}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-6 py-3 rounded-2xl shadow-md transition-all"
                >
                  Start Shopping
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:border-slate-300"
                  >
                    <div className="flex items-center space-x-4 min-w-0 flex-1">
                      <div className="w-20 h-20 bg-slate-50 rounded-2xl p-2 shrink-0 flex items-center justify-center border border-slate-100">
                        <img src={item.image} alt={item.name} className="w-full h-full object-contain" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-bold text-slate-900 truncate">{item.name}</h4>
                        <p className="text-xs text-slate-500 font-medium truncate mt-0.5">{item.subtitle}</p>
                        <span className="text-sm font-black text-slate-900 mt-2 block">
                          ₹{item.price.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end space-x-4 border-t sm:border-t-0 border-slate-100 pt-3 sm:pt-0">
                      <div className="flex items-center space-x-2 bg-slate-100 border border-slate-200/80 rounded-xl p-1">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          className="w-7 h-7 bg-white rounded-lg flex items-center justify-center shadow-xs text-slate-700 font-bold hover:bg-slate-50 active:scale-95"
                        >
                          <HiMinus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-black text-slate-900 w-6 text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          className="w-7 h-7 bg-white rounded-lg flex items-center justify-center shadow-xs text-slate-700 font-bold hover:bg-slate-50 active:scale-95"
                        >
                          <HiPlus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <button
                        onClick={() => removeItem(item.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                      >
                        <HiTrash className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Secure Packaging Box */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  📦
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Secure Bubble Packaging</h4>
                  <p className="text-[11px] text-slate-500">Protection against transit damage for ₹49</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={securePackaging}
                onChange={(e) => setSecurePackaging(e.target.checked)}
                className="w-5 h-5 accent-blue-600 rounded-md cursor-pointer"
              />
            </div>
          </div>

          {/* Right Column: Order Price Summary Card */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-md space-y-5 sticky top-24">
              <h3 className="text-base font-black text-slate-900 border-b border-slate-100 pb-3">
                Order Summary
              </h3>

              <div className="space-y-3 text-xs font-medium text-slate-600">
                <div className="flex justify-between">
                  <span>Price ({items.length} items)</span>
                  <span className="font-bold text-slate-900">₹{itemsTotal.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery Charges</span>
                  <span className="font-bold text-emerald-600">FREE</span>
                </div>
                {securePackaging && (
                  <div className="flex justify-between">
                    <span>Secure Packaging</span>
                    <span className="font-bold text-slate-900">₹49</span>
                  </div>
                )}
                <div className="border-t border-slate-100 pt-3 flex justify-between text-sm font-black text-slate-900">
                  <span>Total Payable</span>
                  <span className="text-blue-700 text-lg">₹{totalAmount.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/60 flex items-center space-x-2 text-[11px] font-semibold text-slate-600">
                <HiShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>100% Safe & Secure Payments guaranteed by KroZenda</span>
              </div>

              <button
                onClick={onCheckout}
                disabled={items.length === 0}
                className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-50 active:scale-[0.98] text-white font-bold py-4 px-4 rounded-2xl shadow-lg shadow-blue-500/20 transition-all text-xs tracking-wide"
              >
                Proceed to Checkout
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Sticky Mobile Footer CTA Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 shadow-xl z-40 flex items-center justify-between">
        <div>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Amount</span>
          <span className="text-base font-black text-slate-900">₹{totalAmount.toLocaleString('en-IN')}</span>
        </div>

        <button
          onClick={onCheckout}
          disabled={items.length === 0}
          className="bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-bold py-3 px-6 rounded-2xl shadow-md text-xs"
        >
          Checkout →
        </button>
      </div>
    </div>
  )
}

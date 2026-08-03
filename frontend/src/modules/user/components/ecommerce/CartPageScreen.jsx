import React, { useState } from 'react'
import {
  HiArrowLeft,
  HiTrash,
  HiMinus,
  HiPlus,
  HiShieldCheck,
  HiTruck,
  HiChevronRight,
} from 'react-icons/hi2'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'

export function CartPageScreen({
  onBack = () => {},
  onCheckout = () => {},
}) {
  const [cartItems, setCartItems] = useState([
    {
      id: 1,
      name: 'Samsung Galaxy S23 5G',
      variant: '(Phantom Black, 128GB)',
      price: 49999,
      originalPrice: 74999,
      quantity: 1,
      image: '/images/samsung_s23.png',
    },
    {
      id: 2,
      name: 'boAt Airdopes 141',
      variant: 'Wireless Earbuds',
      price: 1299,
      originalPrice: 4490,
      quantity: 1,
      image: '/images/boat_airdopes.png',
    },
    {
      id: 3,
      name: 'Portronics Power Bank',
      variant: '10000mAh',
      price: 1199,
      originalPrice: 2499,
      quantity: 1,
      image: '/images/boat_airdopes.png',
    },
  ])

  const [securePackaging, setSecurePackaging] = useState(true)

  const updateQuantity = (id, delta) => {
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newQty = Math.max(1, item.quantity + delta)
          return { ...item, quantity: newQty }
        }
        return item
      })
    )
  }

  const removeItem = (id) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id))
  }

  const totalMRP = cartItems.reduce((sum, item) => sum + item.originalPrice * item.quantity, 0)
  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const totalDiscount = totalMRP - subtotal
  const packagingFee = securePackaging ? 49 : 0
  const totalAmount = subtotal + packagingFee

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col text-slate-800 font-sans">
      <div className="hidden md:block"><WebHeader /></div>

      {/* Compact Clean Header Bar (Reference Image Matching) */}
      <div className="bg-white px-4 py-3 border-b border-slate-200 flex items-center justify-between shadow-2xs">
        <div className="flex items-center space-x-3">
          <button onClick={onBack} className="p-1 rounded-lg hover:bg-slate-100 text-slate-800 transition-colors">
            <HiArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-bold text-slate-900">My Cart ({cartItems.length})</h1>
        </div>
        <button className="text-xs font-bold text-slate-800 hover:text-blue-600 transition-colors">
          Edit
        </button>
      </div>

      {/* Free Delivery Banner */}
      <div className="bg-emerald-50/80 border-b border-emerald-100/80 px-4 py-2.5 flex items-center space-x-2 text-xs font-semibold text-emerald-700">
        <HiTruck className="w-4 h-4 text-emerald-600 shrink-0" />
        <span>Yay! You got free delivery</span>
      </div>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-4 pb-28 md:pb-12 space-y-4">
        {/* Cart Item List */}
        {cartItems.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center space-y-3">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto text-2xl">
              🛒
            </div>
            <h3 className="text-base font-bold text-slate-900">Your Cart is Empty</h3>
            <p className="text-xs text-slate-500">Explore wholesale deals and add items to your cart.</p>
            <button onClick={onBack} className="bg-blue-600 text-white text-xs font-bold px-5 py-2 rounded-xl">
              Browse Catalog
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {cartItems.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-4 shadow-2xs flex items-center justify-between gap-3"
              >
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-50 rounded-xl p-1 shrink-0 border border-slate-100 flex items-center justify-center">
                    <img src={item.image} alt={item.name} className="max-h-full max-w-full object-contain" />
                  </div>

                  <div className="min-w-0 flex-1 space-y-0.5">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">{item.name}</h3>
                    <p className="text-[11px] text-slate-500 font-medium truncate">{item.variant}</p>
                    <span className="text-xs sm:text-sm font-black text-slate-900 block pt-1">
                      ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Quantity Stepper Pill & Remove Button */}
                <div className="flex items-center space-x-2 shrink-0">
                  <div className="flex items-center space-x-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      className="text-slate-600 hover:text-slate-900 text-xs font-bold px-1"
                    >
                      <HiMinus className="w-3 h-3" />
                    </button>
                    <span className="text-xs font-bold text-slate-900 px-1">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      className="text-slate-600 hover:text-slate-900 text-xs font-bold px-1"
                    >
                      <HiPlus className="w-3 h-3" />
                    </button>
                  </div>

                  <button
                    onClick={() => removeItem(item.id)}
                    className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <HiTrash className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Secure Packaging Box */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-2xs flex items-center justify-between">
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
              <HiShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-slate-900">Secure Packaging</h4>
              <p className="text-[11px] text-slate-500 truncate">Items will be packed safely</p>
            </div>
          </div>
          <div className="flex items-center space-x-3 shrink-0">
            <span className="text-xs font-bold text-slate-900">₹49</span>
            <input
              type="checkbox"
              checked={securePackaging}
              onChange={(e) => setSecurePackaging(e.target.checked)}
              className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
            />
          </div>
        </div>

        {/* Price Details Breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
          <h3 className="text-xs font-bold text-slate-900">Price Details</h3>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Total MRP</span>
              <span className="font-semibold text-slate-900">₹{totalMRP.toLocaleString('en-IN')}</span>
            </div>

            <div className="flex justify-between text-emerald-600 font-semibold">
              <span>Discount</span>
              <span>- ₹{totalDiscount.toLocaleString('en-IN')}</span>
            </div>

            <div className="flex justify-between text-slate-600">
              <span>Delivery</span>
              <span className="font-bold text-emerald-600">₹0</span>
            </div>

            <div className="border-t border-slate-100 pt-2 flex justify-between text-sm font-bold text-slate-900">
              <span>Total Amount</span>
              <span>₹{totalAmount.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <button
            onClick={onCheckout}
            className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-bold text-xs py-3.5 rounded-xl shadow-md transition-all tracking-wide mt-2"
          >
            Proceed to Checkout
          </button>
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        <BottomNavbar />
      </div>
    </div>
  )
}

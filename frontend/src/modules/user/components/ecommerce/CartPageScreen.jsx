import React, { useState } from 'react'
import { HiArrowLeft, HiMinus, HiPlus, HiShieldCheck, HiCheck } from 'react-icons/hi2'
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

  const itemsTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const packagingFee = securePackaging ? 49 : 0
  const totalAmount = itemsTotal + packagingFee

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans">
      <div className="hidden md:block">
        <WebHeader />
      </div>

      <div className="flex-1 pb-24 md:pb-12 max-w-3xl mx-auto w-full md:px-6 md:py-6">
        <div className="md:hidden">
          
        </div>

        <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-3">
            <button onClick={onBack} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700">
              <HiArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-base font-bold text-slate-900">My Cart ({items.length})</h2>
          </div>
          <button className="text-xs font-bold text-blue-600 hover:underline">Edit</button>
        </div>

        <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-2.5 flex items-center space-x-2 text-xs font-bold text-emerald-700">
          <span>🎉</span>
          <span>Yay! You got free delivery</span>
        </div>

        <div className="p-4 space-y-4">
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-xs flex items-center justify-between">
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <div className="w-16 h-16 bg-slate-50 rounded-xl p-1 shrink-0 flex items-center justify-center border border-slate-100">
                    <img src={item.image} alt={item.name} className="w-full h-full object-contain" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-slate-900 truncate">{item.name}</h4>
                    <p className="text-[10px] text-slate-500 font-medium truncate">{item.subtitle}</p>
                    <span className="text-xs font-black text-slate-900 mt-1 inline-block">₹{item.price.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2 border border-slate-200 rounded-xl p-1 bg-slate-50">
                  <button onClick={() => updateQuantity(item.id, -1)} className="p-1 rounded-lg text-slate-600 hover:bg-slate-200">
                    <HiMinus className="w-3 h-3" />
                  </button>
                  <span className="text-xs font-bold text-slate-900 w-4 text-center">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.id, 1)} className="p-1 rounded-lg text-slate-600 hover:bg-slate-200">
                    <HiPlus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-xs flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <HiShieldCheck className="w-5 h-5 text-blue-600" />
              <div>
                <h4 className="text-xs font-bold text-slate-800">Secure Packaging</h4>
                <p className="text-[10px] text-slate-500">Items will be packed safely</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-900">+₹49</span>
              <button onClick={() => setSecurePackaging(!securePackaging)} className={`w-5 h-5 rounded-md flex items-center justify-center ${securePackaging ? 'bg-blue-600 text-white' : 'border border-slate-300'}`}>
                {securePackaging && <HiCheck className="w-3.5 h-3.5 stroke-[3]" />}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-2 text-xs">
            <div className="flex justify-between">
              <span>Total MRP</span>
              <span className="font-semibold text-slate-900">₹82,497</span>
            </div>
            <div className="flex justify-between text-emerald-600 font-semibold">
              <span>Discount</span>
              <span>- ₹30,199</span>
            </div>
            <div className="border-t border-slate-100 pt-2 flex justify-between font-bold">
              <span>Total Amount</span>
              <span className="text-base font-black text-slate-900">₹{totalAmount.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 shadow-lg z-50">
        <div className="max-w-3xl mx-auto">
          <button onClick={onCheckout} className="w-full bg-blue-600 text-white font-bold py-3.5 px-4 rounded-xl text-xs">
            Proceed to Checkout
          </button>
        </div>
      </div>
    </div>
  )
}

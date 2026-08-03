import React from 'react'

export function DesktopLeftShowcase({
  title = "India's #1 B2B & B2C Dropshipping Marketplace",
  subtitle = "Empowering 100,000+ Smart Retailers & Entrepreneurs with Direct Factory Wholesale Margins.",
  tag = "SMART COMMERCE ECOSYSTEM",
}) {
  return (
    <div className="hidden md:flex flex-1 flex-col justify-between bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 text-white p-10 lg:p-14 relative overflow-hidden min-h-screen">
      {/* Ambient Glows */}
      <div className="absolute top-0 -left-20 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-20 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* Top Logo Header */}
      <div className="relative z-10 flex items-center space-x-3">
        <img
          src="/images/logo.png"
          alt="KroZenda Logo"
          className="h-12 w-auto object-contain bg-white/10 p-2 rounded-2xl backdrop-blur-md border border-white/20 shadow-md"
        />
        <div>
          <span className="text-sm font-black text-white tracking-wider block">KROZENDA</span>
          <span className="text-[10px] text-blue-300 font-extrabold tracking-widest uppercase">
            DROP SHIPPING
          </span>
        </div>
      </div>

      {/* Center Body Content */}
      <div className="relative z-10 space-y-6 my-auto max-w-xl">
        <div className="inline-flex items-center space-x-2 px-3 py-1 bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-full shadow-sm">
          <span>⚡</span>
          <span>{tag}</span>
        </div>

        <h1 className="text-3xl lg:text-5xl font-black leading-tight text-white tracking-tight">
          {title}
        </h1>

        <p className="text-sm text-blue-200/90 leading-relaxed font-medium">
          {subtitle}
        </p>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-2 gap-4 pt-2 text-xs font-semibold">
          <div className="bg-white/10 backdrop-blur-md border border-white/15 p-4 rounded-2xl space-y-1">
            <span className="text-amber-400 font-black text-sm block">🏭 500+ Factory Suppliers</span>
            <span className="text-[11px] text-blue-200">Zero upfront inventory investment</span>
          </div>

          <div className="bg-white/10 backdrop-blur-md border border-white/15 p-4 rounded-2xl space-y-1">
            <span className="text-amber-400 font-black text-sm block">🚀 Express Pan-India</span>
            <span className="text-[11px] text-blue-200">Shiprocket automated tracking</span>
          </div>
        </div>

        {/* Live Platform Stats */}
        <div className="pt-6 border-t border-white/10 grid grid-cols-3 gap-4 text-center">
          <div>
            <span className="text-2xl font-black text-white block">100K+</span>
            <span className="text-[10px] text-blue-300 font-bold uppercase tracking-wider">Active Retailers</span>
          </div>
          <div>
            <span className="text-2xl font-black text-amber-400 block">₹50Cr+</span>
            <span className="text-[10px] text-blue-300 font-bold uppercase tracking-wider">Monthly Sales</span>
          </div>
          <div>
            <span className="text-2xl font-black text-white block">4.9★</span>
            <span className="text-[10px] text-blue-300 font-bold uppercase tracking-wider">Seller Rating</span>
          </div>
        </div>
      </div>

      {/* Bottom Footer */}
      <div className="relative z-10 text-xs text-blue-300/70 font-medium">
        © 2026 KroZenda E-Commerce Pvt. Ltd. All rights reserved.
      </div>
    </div>
  )
}

export default DesktopLeftShowcase

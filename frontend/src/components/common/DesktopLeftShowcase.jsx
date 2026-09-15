import React from 'react'
import { Link } from 'react-router-dom'
import { USER_ROUTES } from '../../config/routes'
import {
  HiBolt,
  HiBuildingOffice2,
  HiRocketLaunch,
  HiShieldCheck,
  HiCheckBadge,
  HiLockClosed,
  HiStar,
} from 'react-icons/hi2'

export function DesktopLeftShowcase({
  title = "Scale Your Dropshipping Business with Zero Inventory",
  subtitle = "India's premier B2B & B2C marketplace connecting 100,000+ smart retailers directly with verified manufacturers.",
  tag = "DIRECT FACTORY NETWORK",
}) {
  return (
    <div className="hidden md:flex flex-1 flex-col justify-between bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white p-8 lg:p-12 xl:p-14 relative overflow-hidden min-h-screen select-none">
      {/* Dynamic Ambient Background Glows */}
      <div className="absolute -top-24 -left-24 w-[420px] h-[420px] bg-blue-600/25 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 -right-28 w-[380px] h-[380px] bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 left-1/3 w-[350px] h-[350px] bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

      {/* Subtle Background Grid Pattern */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '28px 28px',
        }}
      />

      {/* Top Header Bar */}
      <div className="relative z-10 flex items-center justify-between">
        <Link to={USER_ROUTES.DASHBOARD} className="flex items-center space-x-3.5 cursor-pointer group" title="KroZenda Home">
          <div className="p-2 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-lg shadow-black/20 flex items-center justify-center group-hover:bg-white/20 transition-all">
            <img
              src="/images/logo.png"
              alt="KroZenda Logo"
              className="h-10 lg:h-12 w-auto object-contain"
            />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-lg font-black text-white tracking-wider group-hover:text-blue-200 transition-colors">
                KROZENDA
              </span>
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold">
                <HiCheckBadge className="w-3 h-3 text-emerald-400" />
                <span>Verified</span>
              </span>
            </div>
            <span className="text-[11px] text-blue-300/90 font-bold tracking-widest uppercase block">
              B2B & B2C Dropshipping
            </span>
          </div>
        </Link>

        <div className="hidden lg:flex items-center space-x-2 px-3 py-1.5 rounded-full bg-white/5 backdrop-blur-md border border-white/10 text-xs text-blue-200">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold text-[11px]">Live Factory Inventory</span>
        </div>
      </div>

      {/* Center Body Content */}
      <div className="relative z-10 space-y-7 my-auto max-w-xl py-6">
        {/* Category / Badge Tag */}
        <div className="inline-flex items-center space-x-2 px-3.5 py-1 bg-amber-400/20 border border-amber-400/40 text-amber-300 font-extrabold text-[11px] uppercase tracking-wider rounded-full backdrop-blur-md shadow-xs">
          <HiBolt className="w-3.5 h-3.5 text-amber-400" />
          <span>{tag}</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-3xl lg:text-4xl xl:text-5xl font-black leading-[1.15] text-white tracking-tight">
          {title}
        </h1>

        {/* Subtitle */}
        <p className="text-sm lg:text-base text-blue-100/80 leading-relaxed font-normal">
          {subtitle}
        </p>

        {/* 3 Interactive Feature Highlights */}
        <div className="grid grid-cols-1 gap-3 pt-1">
          <div className="bg-white/10 hover:bg-white/15 transition-colors backdrop-blur-xl border border-white/15 p-3.5 rounded-2xl flex items-center space-x-3.5 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-amber-400/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-400/30">
              <HiBuildingOffice2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black text-white">Direct Factory Margins</h4>
              <p className="text-[11px] text-blue-200/80 mt-0.5">
                Zero middlemen markups. Source directly from 500+ Indian manufacturers at unit wholesale price.
              </p>
            </div>
          </div>

          <div className="bg-white/10 hover:bg-white/15 transition-colors backdrop-blur-xl border border-white/15 p-3.5 rounded-2xl flex items-center space-x-3.5 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-blue-400/20 text-blue-400 flex items-center justify-center shrink-0 border border-blue-400/30">
              <HiRocketLaunch className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black text-white">24-48hr Pan-India Express Air</h4>
              <p className="text-[11px] text-blue-200/80 mt-0.5">
                Automated Shiprocket courier integration with live buyer SMS & WhatsApp tracking.
              </p>
            </div>
          </div>

          <div className="bg-white/10 hover:bg-white/15 transition-colors backdrop-blur-xl border border-white/15 p-3.5 rounded-2xl flex items-center space-x-3.5 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-emerald-400/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-400/30">
              <HiShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black text-white">100% Safe Escrow Protection</h4>
              <p className="text-[11px] text-blue-200/80 mt-0.5">
                Guaranteed payouts and 7-day hassle-free replacement with verified GST tax invoicing.
              </p>
            </div>
          </div>
        </div>

        {/* Live Platform Stats */}
        <div className="pt-4 border-t border-white/10 grid grid-cols-3 gap-3 text-center">
          <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
            <span className="text-xl lg:text-2xl font-black text-white block">100K+</span>
            <span className="text-[10px] lg:text-[11px] text-blue-300 font-semibold block mt-0.5">
              Active Retailers
            </span>
          </div>

          <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
            <span className="text-xl lg:text-2xl font-black text-white block">500K+</span>
            <span className="text-[10px] lg:text-[11px] text-blue-300 font-semibold block mt-0.5">
              Monthly Deliveries
            </span>
          </div>

          <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
            <span className="text-xl lg:text-2xl font-black text-white block">26,000+</span>
            <span className="text-[10px] lg:text-[11px] text-blue-300 font-semibold block mt-0.5">
              Pincodes Covered
            </span>
          </div>
        </div>

        {/* Retailer Testimonial Snippet */}
        <div className="bg-blue-900/30 border border-blue-400/20 rounded-2xl p-3 flex items-start space-x-3">
          <div className="flex text-amber-400 text-xs shrink-0 mt-0.5">
            <HiStar className="w-3.5 h-3.5 fill-amber-400" />
            <HiStar className="w-3.5 h-3.5 fill-amber-400" />
            <HiStar className="w-3.5 h-3.5 fill-amber-400" />
            <HiStar className="w-3.5 h-3.5 fill-amber-400" />
            <HiStar className="w-3.5 h-3.5 fill-amber-400" />
          </div>
          <p className="text-[11px] text-blue-200/90 leading-snug">
            <strong className="text-white font-semibold">"Zero inventory investment:</strong> scaled from 5 to 150 daily orders within 30 days."
            <span className="block text-[10px] text-blue-300/70 mt-0.5 font-medium">— Retail Partner, Surat Hub</span>
          </p>
        </div>
      </div>

      {/* Footer Security Badges */}
      <div className="relative z-10 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-[11px] text-blue-300/80">
        <div className="flex items-center space-x-4">
          <span className="flex items-center space-x-1 font-medium">
            <HiLockClosed className="w-3.5 h-3.5 text-emerald-400" />
            <span>256-Bit SSL</span>
          </span>
          <span className="font-medium">• ISO 9001</span>
          <span className="font-medium">• GST Invoiced</span>
        </div>
        <span>© 2026 KroZenda Technologies</span>
      </div>
    </div>
  )
}

export default DesktopLeftShowcase

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
  HiChartBarSquare,
  HiGlobeAlt,
} from 'react-icons/hi2'

export function DesktopLeftShowcase({
  title = "Direct Factory Wholesale & Automated Dropshipping",
  subtitle = "Connect with 500+ verified Indian manufacturers. Enjoy transparent wholesale pricing from unit 1, automated fulfillment, and 7-day safe escrow payouts.",
  tag = "INDIA'S #1 DROPSHIPPING PLATFORM",
}) {
  return (
    <div
      className="hidden md:flex flex-1 flex-col justify-between text-white relative overflow-hidden min-h-screen select-none"
      style={{
        background: 'linear-gradient(135deg, #060B18 0%, #0A1628 40%, #0D1F3C 70%, #091428 100%)',
      }}
    >
      {/* Layered Ambient Glows */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: '-80px',
          left: '-80px',
          width: '420px',
          height: '420px',
          background: 'radial-gradient(circle, rgba(59,130,246,0.18) 0%, transparent 70%)',
          borderRadius: '50%',
          filter: 'blur(40px)',
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: '60px',
          right: '-60px',
          width: '360px',
          height: '360px',
          background: 'radial-gradient(circle, rgba(99,102,241,0.14) 0%, transparent 70%)',
          borderRadius: '50%',
          filter: 'blur(50px)',
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          top: '45%',
          left: '30%',
          width: '280px',
          height: '280px',
          background: 'radial-gradient(circle, rgba(245,158,11,0.07) 0%, transparent 70%)',
          borderRadius: '50%',
          filter: 'blur(40px)',
        }}
      />

      {/* Dot Grid Pattern */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)',
          backgroundSize: '28px 28px',
        }}
      />

      {/* Diagonal accent line */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(135deg, transparent 40%, rgba(59,130,246,0.04) 50%, transparent 60%)',
        }}
      />

      {/* === TOP HEADER === */}
      <div className="relative z-10 p-8 lg:p-10 xl:p-12">
        <Link
          to={USER_ROUTES.DASHBOARD}
          className="flex items-center space-x-3 group focus:outline-none"
          title="KroZenda Home"
        >
          {/* Logo with glowing ring */}
          <div
            className="relative p-2.5 rounded-2xl border border-white/10 group-hover:border-blue-400/30 transition-all"
            style={{
              background: 'rgba(255,255,255,0.06)',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 0 20px rgba(59,130,246,0.12)',
            }}
          >
            <img
              src="/images/logo.png"
              alt="KroZenda Logo"
              className="h-9 lg:h-10 w-auto object-contain"
            />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-base lg:text-lg font-black text-white tracking-widest group-hover:text-blue-200 transition-colors">
                KROZENDA
              </span>
              <span
                className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{
                  background: 'rgba(16,185,129,0.12)',
                  border: '1px solid rgba(16,185,129,0.25)',
                  color: '#6ee7b7',
                }}
              >
                <HiCheckBadge className="w-3 h-3" />
                <span>Verified</span>
              </span>
            </div>
            <span className="text-[10px] font-bold tracking-widest uppercase block mt-0.5 text-blue-400/70">
              B2B &amp; B2C Dropshipping
            </span>
          </div>

          {/* Live status - top right area */}
          <div className="ml-auto">
            <div
              className="hidden lg:inline-flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="font-semibold text-[11px] text-slate-300">Live Factory Inventory</span>
            </div>
          </div>
        </Link>
      </div>

      {/* === CENTER BODY === */}
      <div className="relative z-10 flex-1 px-8 lg:px-10 xl:px-12 pb-6 flex flex-col justify-center space-y-6 max-w-xl">

        {/* Badge Tag */}
        <div
          className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[10.5px] font-extrabold uppercase tracking-widest w-fit"
          style={{
            background: 'rgba(245,158,11,0.1)',
            border: '1px solid rgba(245,158,11,0.25)',
            color: '#fbbf24',
          }}
        >
          <HiBolt className="w-3.5 h-3.5 text-amber-400" />
          <span>{tag}</span>
        </div>

        {/* Hero Title */}
        <h1
          className="text-2xl lg:text-3xl xl:text-4xl font-extrabold leading-[1.18] tracking-tight"
          style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #c7d2fe 50%, #93c5fd 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          {title}
        </h1>

        {/* Subtitle */}
        <p className="text-sm lg:text-[15px] text-slate-400 leading-relaxed">
          {subtitle}
        </p>

        {/* 3 Feature Cards with glassmorphism */}
        <div className="grid grid-cols-1 gap-3">
          {[
            {
              icon: HiBuildingOffice2,
              color: 'amber',
              title: 'Direct Factory Margins',
              desc: 'Zero middlemen markups. Source from 500+ Indian manufacturers at unit wholesale price.',
              iconBg: 'rgba(245,158,11,0.1)',
              iconBorder: 'rgba(245,158,11,0.2)',
              iconColor: '#fbbf24',
            },
            {
              icon: HiRocketLaunch,
              color: 'blue',
              title: '24-48hr Pan-India Express',
              desc: 'Automated Shiprocket courier integration with live buyer SMS & WhatsApp tracking.',
              iconBg: 'rgba(59,130,246,0.1)',
              iconBorder: 'rgba(59,130,246,0.2)',
              iconColor: '#60a5fa',
            },
            {
              icon: HiShieldCheck,
              color: 'emerald',
              title: '100% Safe Escrow Protection',
              desc: 'Guaranteed payouts and 7-day hassle-free replacement with verified GST invoicing.',
              iconBg: 'rgba(16,185,129,0.1)',
              iconBorder: 'rgba(16,185,129,0.2)',
              iconColor: '#34d399',
            },
          ].map(({ icon: Icon, title: t, desc, iconBg, iconBorder, iconColor }) => (
            <div
              key={t}
              className="flex items-start space-x-3 p-3.5 rounded-2xl transition-all group cursor-default"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                backdropFilter: 'blur(8px)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                e.currentTarget.style.border = '1px solid rgba(255,255,255,0.12)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                e.currentTarget.style.border = '1px solid rgba(255,255,255,0.07)'
              }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: iconBg, border: `1px solid ${iconBorder}` }}
              >
                <Icon className="w-4.5 h-4.5" style={{ color: iconColor, width: '18px', height: '18px' }} />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white/90 tracking-tight">{t}</h3>
                <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Live Stats */}
        <div
          className="grid grid-cols-3 gap-3 p-4 rounded-2xl"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          {[
            { value: '100K+', label: 'Active Retailers', icon: HiChartBarSquare },
            { value: '500K+', label: 'Monthly Deliveries', icon: HiRocketLaunch },
            { value: '26K+', label: 'Pincodes Served', icon: HiGlobeAlt },
          ].map(({ value, label, icon: Icon }) => (
            <div key={label} className="text-center space-y-1">
              <span
                className="text-lg lg:text-xl font-black block"
                style={{
                  background: 'linear-gradient(135deg, #fff 0%, #93c5fd 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                {value}
              </span>
              <span className="text-[10px] text-slate-500 font-medium block">{label}</span>
            </div>
          ))}
        </div>

        {/* Testimonial */}
        <div
          className="p-4 rounded-2xl flex items-start space-x-3"
          style={{
            background: 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(99,102,241,0.06) 100%)',
            border: '1px solid rgba(59,130,246,0.18)',
          }}
        >
          <div className="flex text-amber-400 shrink-0 mt-0.5 space-x-0.5">
            {[...Array(5)].map((_, i) => (
              <HiStar key={i} className="w-3 h-3 fill-amber-400" style={{ fill: '#fbbf24' }} />
            ))}
          </div>
          <p className="text-[11px] text-slate-400 leading-snug">
            <strong className="text-white/80 font-semibold">"Zero inventory investment:</strong>{' '}
            scaled from 5 to 150 daily orders in 30 days."
            <span className="block text-[10px] text-slate-500 mt-1 font-medium">— Retail Partner, Surat Hub</span>
          </p>
        </div>
      </div>

      {/* === FOOTER === */}
      <div
        className="relative z-10 px-8 lg:px-10 xl:px-12 py-6 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center space-x-4">
          <span className="flex items-center space-x-1.5 text-slate-400 font-medium">
            <HiLockClosed className="w-3.5 h-3.5 text-emerald-500" />
            <span>256-Bit SSL</span>
          </span>
          <span className="text-slate-700">•</span>
          <span className="font-medium text-slate-400">ISO 9001</span>
          <span className="text-slate-700">•</span>
          <span className="font-medium text-slate-400">GST Invoiced</span>
        </div>
        <span className="text-slate-600">© 2026 KroZenda Technologies</span>
      </div>
    </div>
  )
}

export default DesktopLeftShowcase

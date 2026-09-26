import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Icon } from '../../../../components/ui'
import { useKeyboardOpen } from '../../../../lib/useKeyboardOpen'
import { useVendorDashboardController } from '../../controllers/useVendorController'

export function VendorBottomNav({ onOpenMobileNav, isPartner = false }) {
  const location = useLocation()
  const navigate = useNavigate()
  const pathname = location.pathname
  const basePath = isPartner ? '/partner' : '/seller'
  const keyboardOpen = useKeyboardOpen()

  const { data: summary } = useVendorDashboardController()
  const pendingOrders = summary?.pendingOrdersCount || 0

  const tabs = [
    {
      id: 'dashboard',
      label: 'Home',
      icon: 'dashboard',
      to: `${basePath}/dashboard`,
      isActive: pathname.startsWith(`${basePath}/dashboard`),
    },
    {
      id: 'orders',
      label: 'Orders',
      icon: 'orders',
      to: `${basePath}/orders`,
      isActive: pathname.startsWith(`${basePath}/orders`),
      badge: pendingOrders > 0 ? pendingOrders : null,
      badgeTone: 'amber',
    },
    {
      id: 'products',
      label: 'Products',
      icon: 'products',
      to: `${basePath}/products`,
      isActive: pathname.startsWith(`${basePath}/products`),
    },
    {
      id: 'earnings',
      label: 'Earnings',
      icon: 'settlements',
      to: `${basePath}/earnings`,
      isActive: pathname.startsWith(`${basePath}/earnings`) || pathname.startsWith(`${basePath}/revenue`),
    },
    {
      id: 'menu',
      label: 'More',
      icon: 'menu',
      action: onOpenMobileNav,
      isActive: false,
    },
  ]

  if (keyboardOpen) return null

  const handleTabPress = (tab) => {
    if (tab.action) {
      tab.action()
    } else if (tab.to) {
      navigate(tab.to)
    }
  }

  return (
    <nav
      aria-label="Seller Mobile Navigation"
      className="fixed inset-x-0 bottom-0 z-40 lg:hidden w-full select-none border-t border-slate-200/80 bg-white/95 px-2 pt-1 shadow-[0_-2px_10px_rgba(15,23,42,0.04)] backdrop-blur-xl pb-[calc(4px+env(safe-area-inset-bottom,0px))] fixed-bottom-nav font-sans"
    >
      <div className="max-w-md mx-auto grid grid-cols-5 items-center">
        {tabs.map((tab) => {
          const isActive = tab.isActive

          return (
            <motion.button
              key={tab.id}
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={() => handleTabPress(tab)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative z-10 flex min-h-[44px] flex-col items-center justify-center rounded-xl px-1 py-0.5 transition-all ${
                isActive ? 'text-brand-600' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="sellerBottomNavPill"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  className="absolute inset-0 rounded-xl bg-brand-50/70 border border-brand-100/60 -z-10"
                />
              )}

              <div className="relative">
                <Icon
                  name={tab.icon}
                  className={`h-[18px] w-[18px] transition-transform duration-200 ${
                    isActive ? 'scale-105 text-brand-600' : 'scale-100 text-slate-500'
                  }`}
                />
                {tab.badge && (
                  <span className="absolute -top-1.5 -right-2.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white shadow-xs">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </div>

              <span
                className={`text-[10px] mt-0.5 tracking-tight transition-colors duration-200 ${
                  isActive ? 'font-bold text-brand-700' : 'font-medium text-slate-500'
                }`}
              >
                {tab.label}
              </span>
            </motion.button>
          )
        })}
      </div>
    </nav>
  )
}

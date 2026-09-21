import { Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  HiEnvelope,
  HiPhone,
} from 'react-icons/hi2'
import {
  FaXTwitter,
  FaInstagram,
  FaLinkedinIn,
  FaYoutube,
  FaFacebookF,
  FaWhatsapp,
} from 'react-icons/fa6'
import { USER_ROUTES, SELLER_ROUTES } from '../../config/routes'
import { api } from '../../lib/axios'

const DEFAULT_QUICK_LINKS = [
  { label: 'All Categories', path: USER_ROUTES.CATEGORIES },
  { label: 'Trending Deals', path: USER_ROUTES.DASHBOARD },
  { label: 'Electronics & Audio', path: '/app/listing?category=electronics' },
  { label: 'Fashion & Lifestyle', path: '/app/listing?category=fashion' },
]

const DEFAULT_CUSTOMER_LINKS = [
  { label: 'Help & Support', path: USER_ROUTES.SUPPORT },
  { label: 'Track Order', path: USER_ROUTES.ORDERS },
  { label: 'Return Policy', path: '/return-policy' },
  { label: 'Shipping Timelines', path: '/shipping-policy' },
]

const DEFAULT_LEGAL_LINKS = [
  { label: 'About Us', path: '/about' },
  { label: 'Terms & Conditions', path: '/terms' },
  { label: 'Privacy Policy', path: '/privacy-policy' },
  { label: 'Sell on KroZenda', path: SELLER_ROUTES.LOGIN },
]

function FooterLink({ link, onScroll }) {
  const isExternal =
    link.path?.startsWith('http') || link.path?.startsWith('mailto:') || link.path?.startsWith('tel:')

  if (isExternal) {
    return (
      <a
        href={link.path}
        target="_blank"
        rel="noopener noreferrer"
        className="text-slate-500 hover:text-blue-600 transition-colors"
      >
        {link.label}
      </a>
    )
  }

  return (
    <Link
      to={link.path}
      onClick={onScroll}
      className="text-slate-500 hover:text-blue-600 transition-colors"
    >
      {link.label}
    </Link>
  )
}

export function Footer({ showOnMobile = false }) {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Check: In native WebView / standalone app container, footer should NOT show.
  const isStandaloneApp =
    !showOnMobile &&
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)')?.matches ||
      window.navigator?.standalone === true ||
      Boolean(window.ReactNativeWebView) ||
      Boolean(window.flutter_inappwebview))

  // Fetch dynamic platform settings configured by admin
  const { data: publicSettings } = useQuery({
    queryKey: ['public', 'settings'],
    queryFn: async () => {
      try {
        const res = await api.get('/public/settings')
        return res?.data?.data || null
      } catch (err) {
        console.warn('Could not load public settings:', err)
        return null
      }
    },
    enabled: !isStandaloneApp,
    staleTime: 60 * 1000,
  })

  if (isStandaloneApp) {
    return null
  }

  // Dynamic values with elegant defaults
  const supportEmail = publicSettings?.supportEmail || 'support@krozenda.com'
  const supportPhone = publicSettings?.supportPhone || '+91 98765 43210'
  const phoneClean = supportPhone.replace(/[^0-9+]/g, '')
  const footerTagline =
    publicSettings?.footerTagline ||
    'B2B wholesale and dropshipping marketplace connecting retailers with direct factory prices and express delivery.'
  const currentYear = new Date(Date.now()).getFullYear()
  const rawCopyright = publicSettings?.copyrightText?.trim()
  const copyrightText = rawCopyright
    ? rawCopyright.replace('{year}', currentYear)
    : `© ${currentYear} KroZenda Technologies Pvt Ltd. All rights reserved.`

  const socialConfig = publicSettings?.socialLinks || {}

  const socialList = [
    {
      label: 'WhatsApp',
      icon: FaWhatsapp,
      href: socialConfig.whatsapp || 'https://whatsapp.com',
      hover: 'hover:text-emerald-600 hover:bg-emerald-50',
    },
    {
      label: 'Instagram',
      icon: FaInstagram,
      href: socialConfig.instagram || 'https://instagram.com',
      hover: 'hover:text-pink-600 hover:bg-pink-50',
    },
    {
      label: 'LinkedIn',
      icon: FaLinkedinIn,
      href: socialConfig.linkedin || 'https://linkedin.com',
      hover: 'hover:text-blue-600 hover:bg-blue-50',
    },
    {
      label: 'X (Twitter)',
      icon: FaXTwitter,
      href: socialConfig.twitter || 'https://twitter.com',
      hover: 'hover:text-slate-900 hover:bg-slate-100',
    },
    {
      label: 'YouTube',
      icon: FaYoutube,
      href: socialConfig.youtube || 'https://youtube.com',
      hover: 'hover:text-red-600 hover:bg-red-50',
    },
    {
      label: 'Facebook',
      icon: FaFacebookF,
      href: socialConfig.facebook || 'https://facebook.com',
      hover: 'hover:text-blue-600 hover:bg-blue-50',
    },
  ].filter((item) => Boolean(item.href))

  const quickLinks = publicSettings?.quickLinks?.length ? publicSettings.quickLinks : DEFAULT_QUICK_LINKS
  const customerLinks = DEFAULT_CUSTOMER_LINKS
  const legalLinks = publicSettings?.legalLinks?.length ? publicSettings.legalLinks : DEFAULT_LEGAL_LINKS

  return (
    <footer
      className={`w-full bg-white text-slate-600 font-sans border-t border-slate-200/90 print:hidden select-none ${
        showOnMobile ? 'block' : 'hidden md:block'
      }`}
    >
      {/* Main Links Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-8">
          {/* Brand & Contact (2 Cols on lg) */}
          <div className="lg:col-span-2 space-y-3">
            <Link
              to={USER_ROUTES.DASHBOARD}
              onClick={scrollToTop}
              className="inline-flex items-center transition-all hover:opacity-95 hover:scale-[1.01]"
              title="KroZenda Home"
            >
              <img
                src="/images/logo.png"
                alt="Krozenda Logo"
                className="h-11 sm:h-12 w-auto object-contain filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.12)] transition-all duration-200"
              />
            </Link>

            <p className="text-xs text-slate-500 leading-relaxed max-w-sm">
              {footerTagline}
            </p>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-700 pt-1">
              <a
                href={`mailto:${supportEmail}`}
                className="inline-flex items-center gap-1.5 hover:text-blue-600 transition-colors"
              >
                <HiEnvelope className="w-3.5 h-3.5 text-blue-600" />
                <span>{supportEmail}</span>
              </a>
              <span className="text-slate-300 hidden sm:inline">•</span>
              <a
                href={`tel:${phoneClean}`}
                className="inline-flex items-center gap-1.5 hover:text-blue-600 transition-colors"
              >
                <HiPhone className="w-3.5 h-3.5 text-blue-600" />
                <span>{supportPhone}</span>
              </a>
            </div>

            {/* Dynamic Social Handles */}
            <div className="flex items-center space-x-2 pt-1">
              {socialList.map((item, idx) => {
                const Icon = item.icon
                return (
                  <a
                    key={idx}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={item.label}
                    className={`w-7 h-7 rounded-lg bg-slate-50 border border-slate-200 text-slate-500 flex items-center justify-center transition-all ${item.hover}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </a>
                )
              })}
            </div>
          </div>

          {/* Quick Links Column */}
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
              Explore
            </h4>
            <ul className="space-y-2 text-xs">
              {quickLinks.map((link, idx) => (
                <li key={idx}>
                  <FooterLink link={link} onScroll={scrollToTop} />
                </li>
              ))}
            </ul>
          </div>

          {/* Customer Care Column */}
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
              Customer Support
            </h4>
            <ul className="space-y-2 text-xs">
              {customerLinks.map((link, idx) => (
                <li key={idx}>
                  <FooterLink link={link} onScroll={scrollToTop} />
                </li>
              ))}
            </ul>
          </div>

          {/* Legal & About Column */}
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
              Company & Legal
            </h4>
            <ul className="space-y-2 text-xs">
              {legalLinks.map((link, idx) => (
                <li key={idx}>
                  <FooterLink link={link} onScroll={scrollToTop} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Sub-Bar: Centered Copyright */}
      <div className="border-t border-slate-100 bg-slate-50/80 px-4 sm:px-6 lg:px-8 py-3.5 text-[11px] text-slate-500">
        <div className="max-w-7xl mx-auto flex items-center justify-center">
          <p className="text-center">{copyrightText}</p>
        </div>
      </div>
    </footer>
  )
}

import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  HiArrowLeft,
  HiShieldCheck,
  HiDocumentText,
  HiPrinter,
  HiClipboard,
  HiCheckCircle,
  HiArrowTopRightOnSquare,
  HiOutlineBookOpen,
  HiQuestionMarkCircle,
  HiScale,
  HiTruck,
  HiArrowUturnLeft,
  HiBuildingOffice2,
} from 'react-icons/hi2'
import { api } from '../lib/axios'

const NAV_DOCUMENTS = [
  { slug: 'terms', title: 'Terms & Conditions', icon: HiScale, path: '/terms' },
  { slug: 'privacy-policy', title: 'Privacy Policy', icon: HiShieldCheck, path: '/privacy-policy' },
  { slug: 'vendor-agreement', title: 'Vendor Agreement', icon: HiBuildingOffice2, path: '/p/vendor-agreement' },
  { slug: 'return-policy', title: 'Return & Refund Policy', icon: HiArrowUturnLeft, path: '/p/return-policy' },
  { slug: 'shipping-policy', title: 'Shipping Policy', icon: HiTruck, path: '/p/shipping-policy' },
  { slug: 'about', title: 'About KroZenda', icon: HiOutlineBookOpen, path: '/p/about' },
  { slug: 'seller-faq', title: 'Seller FAQ', icon: HiQuestionMarkCircle, path: '/p/seller-faq' },
]

// Fallback legal text in case backend is loading or unreachable
const FALLBACK_CONTENT = {
  terms: {
    title: 'Terms & Conditions',
    version: 'v3.0',
    updatedAt: '12 Aug 2026',
    updatedBy: 'Legal Compliance Team',
    requiresAcceptance: true,
    content: `# KroZenda Terms of Service & Multi-Vendor Agreement

Welcome to KroZenda. These Terms and Conditions constitute a legally binding agreement between you and KroZenda Technologies Pvt Ltd governing your access to and use of the platform.

### 1. User Account & Mobile OTP Verification
By entering your mobile number and verifying the one-time password (OTP), you certify that you are the authorized holder of the phone number. KroZenda utilizes encrypted OTP verification for secure login, identity validation, and account provisioning.

### 2. Marketplace Platform Operations
KroZenda is an enterprise multi-vendor B2B and B2C marketplace platform facilitating dropshipping, verified factory wholesale sourcing, and direct consumer commerce across India. Resellers, sellers, and buyers agree to abide by fair marketplace conduct and regulatory guidelines.

### 3. Orders, Pricing & Deliveries
All product wholesale prices, factory supplier margins, and dispatch timelines are updated in real time. Order fulfillments are processed promptly in adherence with courier partner SLAs and automated tracking.

### 4. Cancellations & Returns
Customers and retailers are entitled to return or replace defective or non-conforming merchandise within the designated return window specified in our product listing guidelines.

### 5. Intellectual Property & Brand Integrity
All trademarks, software architectures, logos, and catalog assets are the exclusive intellectual property of KroZenda or its licensed suppliers. Unauthorized scraping or misuse is strictly prohibited.

For legal inquiries or grievance redressal:
Email: compliance@krozenda.com
Office: KroZenda Technologies Pvt Ltd, Bangalore, Karnataka, India`,
  },
  'privacy-policy': {
    title: 'Privacy Policy',
    version: 'v1.4',
    updatedAt: '12 Aug 2026',
    updatedBy: 'Data Protection Officer',
    requiresAcceptance: true,
    content: `# KroZenda Privacy & Data Protection Policy

KroZenda Technologies Pvt Ltd is committed to protecting your privacy and ensuring your personal and business data remains strictly confidential and secure.

### 1. Information We Collect
- **Identity & Contact Details**: Mobile number, legal business name, GSTIN, PAN, and delivery addresses.
- **Transactional Records**: Orders placed, payment references, settlements via Razorpay Route, and fulfillment logs.
- **Device & Technical Data**: IP address, device identifier, browser type, and authentication timestamps.

### 2. Purpose of Data Processing
We process your personal information exclusively for:
- Authenticating mobile logins and preventing fraudulent access.
- Executing pan-India logistics via integrated partners (Shiprocket, Delhivery, Bluedart).
- Calculating GST tax summaries, TDS/TCS, and supplier payouts.
- Providing transactional SMS notifications and customer support.

### 3. Data Protection & Encryption
All mobile authentication requests, tokens, and financial records are encrypted using enterprise 256-bit AES encryption. We never sell, rent, or trade your data with unauthorized third parties.

### 4. Your Rights
You have the right to review, update, or request the deletion of your account and personal records by contacting privacy@krozenda.com.`,
  },
}

export function PublicCmsPage({ defaultSlug }) {
  const params = useParams()
  const navigate = useNavigate()
  const slug = params.slug || defaultSlug || 'terms'

  const [pageData, setPageData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let isMounted = true
    setLoading(true)

    async function loadPage() {
      try {
        const { data } = await api.get(`/public/cms/${slug}`)
        if (isMounted && data?.data) {
          setPageData(data.data)
        }
      } catch {
        // Use fallback content if API hasn't loaded or page is in fallback map
        if (isMounted) {
          const fallback = FALLBACK_CONTENT[slug] || {
            title: slug.split('-').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' '),
            version: 'v1.0',
            updatedAt: '2026',
            updatedBy: 'Compliance Team',
            requiresAcceptance: false,
            content: `# ${slug.split('-').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')}\n\nOfficial documentation for KroZenda Marketplace.\n\nFor inquiries, please contact compliance@krozenda.com.`,
          }
          setPageData(fallback)
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadPage()
    window.scrollTo({ top: 0, behavior: 'smooth' })

    return () => {
      isMounted = false
    }
  }, [slug])

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 antialiased">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              title="Go back"
            >
              <HiArrowLeft className="w-5 h-5" />
            </button>

            <Link to="/auth/login" className="flex items-center space-x-2.5 group">
              <img
                src="/images/logo.png"
                alt="KroZenda Logo"
                className="h-8 w-auto object-contain"
              />
              <div className="hidden sm:block">
                <span className="text-sm font-black tracking-wider text-slate-900 block leading-tight">
                  KROZENDA
                </span>
                <span className="text-[9px] font-bold text-blue-600 tracking-widest uppercase block">
                  LEGAL & COMPLIANCE
                </span>
              </div>
            </Link>
          </div>

          {/* Right actions */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 transition-all shadow-2xs"
            >
              {copied ? (
                <>
                  <HiCheckCircle className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700 font-bold">Link Copied!</span>
                </>
              ) : (
                <>
                  <HiClipboard className="w-4 h-4 text-slate-500" />
                  <span className="hidden sm:inline">Share Link</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 transition-all shadow-2xs"
            >
              <HiPrinter className="w-4 h-4 text-slate-500" />
              <span className="hidden sm:inline">Print</span>
            </button>

            <Link
              to="/auth/login"
              className="flex items-center space-x-1 px-4 py-2 text-xs font-bold rounded-xl bg-blue-700 hover:bg-blue-800 text-white shadow-sm transition-all"
            >
              <span>Back to Login</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Sidebar: Document Switcher */}
          <aside className="lg:col-span-4 xl:col-span-3 space-y-6 print:hidden">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs sticky top-24">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 px-2">
                Legal Documents & Policies
              </h3>

              <nav className="space-y-1">
                {NAV_DOCUMENTS.map((doc) => {
                  const Icon = doc.icon
                  const isActive = slug === doc.slug
                  return (
                    <Link
                      key={doc.slug}
                      to={doc.path}
                      className={`flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                        isActive
                          ? 'bg-blue-50 text-blue-700 font-extrabold shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? 'text-blue-600' : 'text-slate-400'
                        }`}
                      />
                      <span className="truncate">{doc.title}</span>
                    </Link>
                  )
                })}
              </nav>

              {/* Compliance Support Card */}
              <div className="mt-6 pt-4 border-t border-slate-100 px-2 space-y-2">
                <div className="flex items-center space-x-2 text-slate-900 text-xs font-bold">
                  <HiShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Regulatory Compliance</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Operated in adherence with the Information Technology Act, 2000 and Consumer Protection
                  (E-Commerce) Rules, 2020.
                </p>
                <div className="pt-2 text-[11px] font-mono text-slate-600 space-y-1">
                  <div>Email: compliance@krozenda.com</div>
                  <div>Helpline: +91 1800-KROZENDA</div>
                </div>
              </div>
            </div>
          </aside>

          {/* Right Main Article / Document Reader */}
          <article className="lg:col-span-8 xl:col-span-9">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-10 lg:p-12 space-y-6">
              {loading ? (
                <div className="space-y-4 animate-pulse">
                  <div className="h-8 bg-slate-200 rounded-xl w-2/3" />
                  <div className="h-4 bg-slate-100 rounded-lg w-1/3" />
                  <div className="pt-6 space-y-3">
                    <div className="h-4 bg-slate-100 rounded w-full" />
                    <div className="h-4 bg-slate-100 rounded w-5/6" />
                    <div className="h-4 bg-slate-100 rounded w-4/6" />
                  </div>
                </div>
              ) : pageData ? (
                <>
                  {/* Document Header */}
                  <div className="border-b border-slate-200/80 pb-6 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span>Active Policy</span>
                      </span>

                      <span className="font-mono text-xs font-bold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-lg">
                        {pageData.version || 'v1.0'}
                      </span>

                      {pageData.requiresAcceptance && (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <HiScale className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Mandatory Legal Agreement</span>
                        </span>
                      )}
                    </div>

                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
                      {pageData.title}
                    </h1>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 font-medium pt-1">
                      <span>
                        Effective date:{' '}
                        <strong className="text-slate-700">{pageData.updatedAt || 'August 2026'}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Published by:{' '}
                        <strong className="text-slate-700">{pageData.updatedBy || 'KroZenda Legal'}</strong>
                      </span>
                      <span>•</span>
                      <span className="font-mono text-slate-500">
                        Route: /{pageData.slug || slug}
                      </span>
                    </div>
                  </div>

                  {/* Document Body (Structured Typography) */}
                  <div className="prose prose-slate max-w-none text-sm text-slate-700 leading-relaxed space-y-4 whitespace-pre-line font-sans">
                    {pageData.content}
                  </div>

                  {/* Document Footer Acknowledgement */}
                  <div className="mt-12 pt-6 border-t border-slate-200 bg-slate-50/70 -mx-6 sm:-mx-10 lg:-mx-12 px-6 sm:px-10 lg:px-12 py-6 rounded-b-3xl flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center space-x-2 text-xs text-slate-500">
                      <HiShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                      <span>
                        This document is officially published on the KroZenda Multi-Vendor Platform.
                      </span>
                    </div>

                    <Link
                      to="/auth/login"
                      className="w-full sm:w-auto px-5 py-2.5 bg-blue-700 hover:bg-blue-800 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all text-center"
                    >
                      Return to Sign In
                    </Link>
                  </div>
                </>
              ) : (
                <div className="py-12 text-center space-y-3">
                  <HiDocumentText className="w-12 h-12 text-slate-300 mx-auto" />
                  <h3 className="text-base font-bold text-slate-900">Document Not Found</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    The requested legal page could not be located. Please select from the documents on
                    the left sidebar.
                  </p>
                </div>
              )}
            </div>
          </article>
        </div>
      </main>

      {/* Global Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 print:hidden mt-auto">
        <div className="max-w-7xl mx-auto px-4 space-y-1">
          <p>© 2026 KroZenda Technologies Private Limited. All rights reserved.</p>
          <div className="flex items-center justify-center space-x-4 text-xs font-semibold pt-1">
            <Link to="/terms" className="hover:text-blue-700 transition-colors">
              Terms & Conditions
            </Link>
            <span>•</span>
            <Link to="/privacy-policy" className="hover:text-blue-700 transition-colors">
              Privacy Policy
            </Link>
            <span>•</span>
            <Link to="/p/vendor-agreement" className="hover:text-blue-700 transition-colors">
              Vendor Agreement
            </Link>
            <span>•</span>
            <Link to="/p/return-policy" className="hover:text-blue-700 transition-colors">
              Return Policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

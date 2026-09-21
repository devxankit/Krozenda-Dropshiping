import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { USER_ROUTES } from '../config/routes'
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
import { Footer } from '../components/layout/Footer'

const NAV_DOCUMENTS = [
  { slug: 'terms', title: 'Terms & Conditions', icon: HiScale, path: '/terms' },
  { slug: 'privacy-policy', title: 'Privacy Policy', icon: HiShieldCheck, path: '/privacy-policy' },
]

// Fallback legal text, shown while the backend loads or when no CMS page has
// been published for this slug yet. An admin-published page always wins.
//
// Written as PLAIN TEXT on purpose: the renderer below prints `content`
// inside a `whitespace-pre-line` block with no markdown parser, so any #,
// ###, ** or - markup would appear on screen as literal characters. Structure
// here comes from numbering, capitalised headings and blank lines only.
//
// Every factual claim is meant to match what the platform actually does. If
// you wire up a courier API, change payment providers or add a data processor,
// this text has to change with it.
const FALLBACK_CONTENT = {
  terms: {
    title: 'Terms & Conditions',
    version: 'v4.0',
    updatedAt: '17 Sep 2026',
    updatedBy: 'Legal Compliance Division',
    requiresAcceptance: true,
    content: `KROZENDA TERMS AND CONDITIONS

Last updated: 17 September 2026
Version: v4.0
Published by: Legal & Compliance Division

These Terms and Conditions ("Terms") constitute a legally binding agreement between you ("User", "Customer", "Buyer", or "Drop-shipper") and KroZenda Technologies Private Limited ("KroZenda", "we", "our", or "us"), governing your access to and use of the KroZenda website, mobile application, and related services (collectively, the "Platform").

By registering an account, browsing our catalog, or placing an order, you confirm that you have read, understood, and agreed to these Terms. If you do not accept these Terms in full, please refrain from using the Platform.


1. PLATFORM ROLE & MULTI-VENDOR MARKETPLACE

KroZenda operates an electronic B2B and B2C commerce and drop-shipping ecosystem connecting buyers, resellers, and independent third-party vendors and manufacturers:

   •  Intermediary Function: For products listed by independent suppliers, KroZenda acts as an electronic intermediary under Section 79 of the Information Technology Act, 2000.
   •  Contract of Sale: The commercial contract for the sale of goods is concluded directly between you and the respective seller. The seller is solely responsible for product specifications, manufacturing quality, packaging, and issuing statutory tax invoices.
   •  Direct KroZenda Sales: For select items sold directly by KroZenda, the product listing and tax invoice will explicitly designate KroZenda as the seller.
   •  Platform Services: KroZenda provides catalog display, payment routing, order synchronization, customer assistance, and automated fulfillment tracking.


2. USER ELIGIBILITY & ACCOUNT INTEGRITY

To access our commerce features and place orders, you must satisfy basic eligibility criteria:

   •  Age Competence: You must be at least 18 years of age and legally competent to enter into binding contracts under the Indian Contract Act, 1872. Minors may use the Platform only under parental or legal guardian supervision.
   •  Authentication via OTP: Accounts are created and secured using your registered 10-digit Indian mobile number and dynamic One-Time Passwords (OTPs). You are solely responsible for maintaining the confidentiality of your credentials.
   •  No Credential Sharing: KroZenda representatives will never contact you requesting your OTP, banking passwords, or UPI PIN. Never disclose these credentials to anyone.
   •  Accurate Contact Information: You agree to provide genuine, up-to-date delivery addresses and phone numbers. KroZenda cannot be held liable for failed or delayed shipments resulting from inaccurate user inputs.


3. PRODUCT CATALOG, PRICING & INVENTORY

We maintain rigorous standards for product listings, pricing accuracy, and inventory management:

   •  Currency & Taxes: All wholesale, drop-shipping, and retail prices are quoted in Indian Rupees (INR) and are inclusive of applicable Goods and Services Tax (GST) unless indicated otherwise.
   •  Live Server Price Calculation: Catalog prices and promotional discounts are validated on KroZenda’s secure servers at checkout. Any local cache or device-side display discrepancies will be overridden by live server pricing.
   •  Visual Representations: Product photographs and descriptions are provided by manufacturers and vendors. While we aim for visual fidelity, slight color variations may occur depending on screen displays and photography lighting.
   •  Inventory Synchronization: Listing an item does not constitute a perpetual guarantee of stock availability. If an ordered item is out of stock, KroZenda will cancel the unavailable item and issue an immediate full refund.


4. ORDER CONFIRMATION & CONTRACT FORMATION

Placing an order initiates a formal procurement workflow:

   •  Order Offer: Submitting an order constitutes an offer to purchase the selected items. An order is confirmed and legally binding only when KroZenda issues an Order Confirmation with an assigned Order Reference ID.
   •  Order Rejection or Cancellation: KroZenda or the merchant reserves the right to cancel an order prior to dispatch in cases of stock shortages, obvious pricing errors, delivery unserviceability, or suspected coupon manipulation.
   •  Multi-Vendor Split Dispatches: When an order contains merchandise from multiple independent vendors, items will be packaged and dispatched separately, each carrying its individual courier tracking number.


5. PAYMENT METHODS, WALLET & CASH ON DELIVERY (COD)

We offer versatile, secure payment options to accommodate buyers and drop-shippers:

   •  Online Payments: Supported via Razorpay including UPI, Credit Cards, Debit Cards, and Net Banking. All transactions adhere to stringent RBI security directives.
   •  KroZenda Wallet: Registered users can utilize instant wallet credits resulting from order cancellations, returns, or promotional allowances to make purchases across the Platform.
   •  Cash on Delivery (COD): COD is accessible for eligible delivery pin codes and qualifying basket amounts. Consignees must have exact cash ready upon delivery agent arrival.
   •  COD Fair Usage: Repeated refusal or deliberate non-acceptance of valid COD consignments without justifiable cause may result in permanent suspension of COD payment privileges.


6. PAN-INDIA SHIPPING, LOGISTICS & FULFILLMENT

Logistics are managed through integrated national courier networks covering 26,000+ Indian postal PIN codes:

   •  Integrated Carriers: Shipments are routed through premier logistics partners including Delhivery, Bluedart, Xpressbees, Shadowfax, and Shiprocket.
   •  Delivery Estimates: Estimated transit durations are 2 to 4 business days for Metros, 4 to 7 business days for Tier 2/3 cities, and 7 to 10 business days for remote regions. These timelines are estimates and subject to transit conditions.
   •  Live Tracking: Tracking numbers and carrier names are published to your Orders Dashboard upon parcel pickup by the carrier.
   •  Transfer of Title: Risk and responsibility in the purchased goods transfer to the buyer upon physical delivery and verification at the specified address.


7. CANCELLATION, RETURN, REPLACEMENT & REFUND POLICY

We provide a streamlined dispute redressal and refund framework:

   •  Order Cancellations: You may cancel an order directly from your account dashboard while it is marked "Pending" or "Processing". Once marked "Shipped", orders cannot be cancelled and must be processed as returns.
   •  7-Day Return Window: Return or replacement requests for eligible physical goods may be initiated within 7 calendar days from confirmed delivery.
   •  Condition of Returned Goods: Returned products must be unused, unaltered, unwashed, and accompanied by original packaging, brand tags, warranty cards, and accessories.
   •  Non-Returnable Goods: Customized goods, perishable products, personal hygiene merchandise, and unsealed consumables are non-returnable unless received damaged or defective.
   •  Refund Processing: Approved refunds are credited to your KroZenda Wallet within 24 hours, or refunded to the original payment source within 5 to 7 business days depending on banking clearing cycles.


8. ACCEPTABLE PLATFORM USE & PROHIBITED CONDUCT

Users agree to utilize the Platform strictly for authorized, lawful commercial activities:

   •  No Automated Scraping: You may not use automated spiders, bots, crawlers, or scrapers to extract product catalogs, pricing databases, or customer feedback.
   •  Account Integrity & Promo Abuse: Creating multiple fake accounts, circulating unauthorized voucher codes, or exploiting system errors to obtain unauthorized discounts is strictly prohibited.
   •  System Security: You must not attempt to circumvent authentication protocols, inject malicious code, overload server infrastructures, or probe system vulnerabilities.
   •  Enforcement: KroZenda reserves the right to immediately suspend or terminate accounts found violating these provisions and initiate appropriate legal action under the IT Act, 2000.


9. INTELLECTUAL PROPERTY & PROPRIETARY RIGHTS

All proprietary rights on the Platform are rigorously protected:

   •  KroZenda IP: The KroZenda trademark, logo, design system, source code, workflows, algorithms, and website layouts are the exclusive intellectual property of KroZenda Technologies Private Limited.
   •  Third-Party Trademarks: Merchant brand names, trade dress, product imagery, and logos displayed on listings remain the property of their respective trademark holders.
   •  User-Generated Content: By posting reviews, ratings, or feedback on the Platform, you grant KroZenda an unrestricted, royalty-free, perpetual license to host, display, and publish this content across our digital channels.


10. LIMITATION OF LIABILITY, GOVERNING LAW & GRIEVANCE REDRESSAL

Our liability limits, governing jurisdiction, and grievance redressal mechanisms are defined below:

   •  Liability Limitation: To the maximum extent permitted by applicable law, KroZenda’s aggregate liability for any claim arising from an order or Platform usage shall not exceed the actual amount paid by you for that specific order.
   •  Indirect Damages: KroZenda shall not be liable for indirect, punitive, special, or consequential damages, loss of anticipated business profits, or commercial interruption.
   •  Governing Law & Jurisdiction: These Terms are governed by and construed in accordance with the laws of India. Subject to amicable resolution, the courts of Bengaluru, Karnataka possess exclusive jurisdiction.
   •  Grievance Officer: In adherence with the Consumer Protection (E-Commerce) Rules, 2020:

      Grievance Officer
      KroZenda Technologies Private Limited
      Email: compliance@krozenda.com
      Customer Helpline: +91 1800-KROZENDA
      Complaints will be acknowledged within 48 hours and resolved within one month of formal submission.`,
  },
  'privacy-policy': {
    title: 'Privacy Policy',
    version: 'v2.5',
    updatedAt: '17 Sep 2026',
    updatedBy: 'Legal Compliance Division',
    requiresAcceptance: true,
    content: `KROZENDA PRIVACY POLICY

Last updated: 17 September 2026
Version: v2.5
Published by: Legal & Compliance Division

This Privacy Policy explains how KroZenda Technologies Private Limited ("KroZenda", "we", "our", "us") collects, uses, stores, processes, and protects your personal and transactional information across our web platform, mobile applications, and connected services.

We operate in compliance with the Digital Personal Data Protection Act, 2023 (DPDP Act), the Information Technology Act, 2000, and the Consumer Protection (E-Commerce) Rules, 2020.


1. INFORMATION WE COLLECT

We collect personal and transactional data necessary to operate your account, process orders, and facilitate pan-India deliveries:

   •  Contact & Identification: Mobile phone number (mandatory primary identifier for OTP verification), full name, email address, and profile photo.
   •  Delivery Addresses: Recipient name, complete shipping address, landmark, city, state, postal PIN code, and contact phone number.
   •  B2B & Vendor Verification Data: Business entity name, GSTIN certificate, PAN card details, warehouse address, and bank account details for settlement disbursements.
   •  Usage & Technical Metrics: IP address, device model, operating system, browser specifications, access timestamps, and device push notification tokens.


2. HOW WE USE YOUR INFORMATION

Your information is processed strictly for legitimate operational purposes:

   •  Account Management: Generating secure session tokens and authenticating sign-ins via dynamic One-Time Passwords (OTPs).
   •  Order Processing: Routing multi-vendor drop-shipping orders, generating automated invoices, and calculating live shipping distances.
   •  Logistics & Fulfillment: Sharing recipient dispatch details with verified courier partners and suppliers for packaging and pan-India delivery.
   •  Customer Care & Dispute Resolution: Managing customer inquiries, tracking order status, and resolving returns, cancellations, or refund claims.
   •  Regulatory & Tax Compliance: Maintaining audited sales records and tax registers in accordance with Indian statutory requirements.


3. PAYMENT PROCESSING & FINANCIAL DATA SECURITY

We treat your payment and financial information with bank-grade security:

   •  Zero Storage of Sensitive Card Credentials: We never receive, process, or store your complete debit/credit card numbers, CVV, expiry dates, net-banking credentials, or UPI PINs.
   •  PCI-DSS Certified Gateway: All online payments are handled directly by Razorpay, a certified PCI-DSS Level 1 payment aggregator.
   •  Encrypted Payment References: KroZenda stores only unique alphanumeric transaction IDs, payment status flags, and masked card identifiers (e.g. card network and last 4 digits) for verification and refund processing.


4. DATA SHARING WITH LOGISTICS & THIRD-PARTY SUPPLIERS

We share only the minimum information required to complete your orders:

   •  Drop-shipping Vendors & Manufacturers: Independent sellers receive only the recipient name, delivery address, contact phone number, and items purchased to pack and dispatch your parcel. Vendors do not receive your email address, billing records, or browsing history.
   •  Logistics Partners: Verified shipping aggregators and courier networks (including Delhivery, Bluedart, Xpressbees, Shadowfax, and Shiprocket) receive shipment delivery coordinates to perform doorstep deliveries and collect COD payments.
   •  Strict No-Sale Policy: We do not sell, rent, monetize, or trade your personal details to third-party data brokers or marketing agencies.


5. KROZENDA WALLET & TRANSACTION INTEGRITY

All financial interactions within the KroZenda internal wallet are safeguarded:

   •  Transaction Records: Every wallet credit, debit, instant refund, or promotional credit is recorded with an immutable timestamp, order reference, and balance ledger.
   •  Fraud Detection: Automated security algorithms monitor wallet usage and multiple account creations to prevent promo abuse and unauthorized transfers.
   •  Non-Transferable Balance: In accordance with RBI guidelines on closed-loop marketplace wallets, wallet balances cannot be transferred to third-party accounts or redeemed for physical currency except where mandated by law.


6. AI ASSISTANT & CONVERSATIONAL PRIVACY

Our integrated AI Assistant provides real-time account insights under strict privacy constraints:

   •  Restricted Account Scope: The AI Assistant can query only records belonging to your currently signed-in session (e.g., active orders, shipping milestones, wallet balance, and recent tickets). It cannot access any other customer's or seller's records.
   •  Data Minimization: Queries sent to our enterprise AI engine (Google Gemini API) contain only the specific question and relevant sanitized order metadata.
   •  Masking of Sensitive Details: Street addresses, payment tokens, and authentication credentials are systematically excluded from AI prompts. Chat histories can be cleared from your account settings at any time.


7. COOKIES, LOCAL STORAGE & PUSH NOTIFICATIONS

We use standard client-side storage technologies transparently:

   •  Essential Session Storage: Browser local storage and session tokens are used exclusively to maintain your active login session, cart contents, and interface preferences.
   •  Push Notification Tokens: Device tokens (Firebase Cloud Messaging) are utilized exclusively to broadcast real-time dispatch updates, delivery alerts, and critical security notices.
   •  No Third-Party Tracking Pixels: We do not use cross-site behavioral tracking cookies or third-party ad profiling trackers. You can disable notifications at any time through your browser or device settings.


8. DATA RETENTION & ARCHIVAL RULES

We retain personal information only as long as necessary to fulfill contractual and legal obligations:

   •  Account Information: Retained for the duration of your active platform membership.
   •  Tax & Accounting Archives: Invoices, order ledgers, payment proofs, and wallet transactions are preserved for up to 8 years as required under Indian GST laws and the Companies Act, 2013.
   •  Customer Support Logs: Support tickets and return inspection records are stored for 3 years to resolve potential disputes or warranty claims.
   •  Account Deletion: When you request account deletion, non-statutory data is permanently removed or irreversibly anonymized within 30 days.


9. SECURITY PROTOCOLS & ENCRYPTION MEASURES

We implement comprehensive technical and organizational safeguards:

   •  Encryption in Transit: All data transferred between your browser or mobile app and our cloud servers is protected using TLS 1.3 encryption (HTTPS).
   •  Encryption at Rest: Sensitive database records and backups are protected using industry-standard 256-bit AES encryption.
   •  Access Controls: Production databases are restricted behind virtual private networks (VPN), strict IP allowlisting, and role-based administrative credentials.
   •  Rate Limiting: Dynamic rate limiting protects login endpoints and OTP requests against automated brute-force attacks.


10. USER RIGHTS, GRIEVANCE REDRESSAL & CONTACT

Under applicable data protection laws, including the DPDP Act, 2023, you retain key rights regarding your personal information:

   •  Right to Access & Correction: You may review, verify, or correct your personal information directly through the profile settings in your KroZenda account.
   •  Right to Consent Withdrawal: You can withdraw consent for promotional communications or push notifications at any time.
   •  Grievance Officer: In accordance with the Consumer Protection (E-Commerce) Rules, 2020 and the Information Technology Act, 2000, our designated Grievance and Data Protection Officer can be reached at:

      Grievance & Data Protection Officer
      KroZenda Technologies Private Limited
      Email: compliance@krozenda.com
      Alternative Support: privacy@krozenda.com
      Customer Helpline: +91 1800-KROZENDA
      Response SLA: Acknowledgement within 48 hours; resolution within 30 calendar days.`,
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

            <Link to={USER_ROUTES.DASHBOARD} className="flex items-center space-x-2.5 group cursor-pointer transition-opacity hover:opacity-90" title="KroZenda Home">
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

            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex items-center space-x-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-blue-700 hover:bg-blue-800 text-white shadow-sm transition-all cursor-pointer"
            >
              <HiArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
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

      {/* Global Modern Footer */}
      <Footer />
    </div>
  )
}

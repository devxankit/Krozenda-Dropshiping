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
    updatedBy: 'Legal Compliance Team',
    requiresAcceptance: true,
    content: `KROZENDA TERMS AND CONDITIONS

Last updated: 17 September 2026

These Terms and Conditions ("Terms") are a legally binding agreement between you and KroZenda Technologies Private Limited ("KroZenda", "we", "us") and govern your use of the KroZenda website and mobile applications (the "Platform").

By creating an account, placing an order, or otherwise using the Platform, you confirm that you have read and accepted these Terms. If you do not agree with them, please do not use the Platform.


1. WHO WE ARE AND WHAT KROZENDA IS

KroZenda operates an online marketplace that connects buyers with independent third-party sellers.

For most products listed on the Platform, KroZenda acts as an intermediary. This means:

   •  The contract of sale for such products is formed directly between you and the seller of that product.
   •  The seller is responsible for the product, its description, its quality, its packaging, its dispatch, and for issuing the tax invoice.
   •  KroZenda provides the technology, the payment collection and settlement, the customer support channel and the dispute redressal process.

Some products are sold by KroZenda directly. Where that is the case, the product page and your invoice will identify KroZenda as the seller, and our obligations as a seller apply to that order.

The seller of every item is shown on the product page and on your order details before you pay.


2. ELIGIBILITY

To use the Platform you must be at least 18 years of age and capable of entering into a legally binding contract under the Indian Contract Act, 1872. If you are under 18, you may use the Platform only under the supervision of a parent or legal guardian who accepts these Terms on your behalf.


3. YOUR ACCOUNT

3.1  Accounts are created and accessed using your mobile number and a one-time password (OTP) sent to that number. By entering a mobile number you confirm you are its authorised subscriber.

3.2  You are responsible for everything that happens through your account. Do not share your OTP with anyone. KroZenda will never ask you for your OTP by phone, email, SMS or chat. Anyone who asks you for it is attempting fraud.

3.3  You agree to keep your account details, including your delivery addresses and contact number, accurate and up to date. We are not responsible for a delivery that fails because the address or phone number you gave us was wrong or out of date.

3.4  You may hold only one account per mobile number. We may suspend duplicate accounts created to abuse offers or coupons.


4. PRODUCT LISTINGS, PRICES AND AVAILABILITY

4.1  Product descriptions, images and specifications are supplied by the seller. We take reasonable steps to review listings but we do not independently verify every claim made by a seller.

4.2  Product colours may appear different on your screen than in reality.

4.3  Prices are shown in Indian Rupees and include applicable taxes unless stated otherwise. Delivery charges, where they apply, are shown separately at checkout before you pay.

4.4  Prices and offers can change at any time before you place an order. The price that applies to your order is the price shown on the order summary at the moment you confirm it.

4.5  Listing a product does not guarantee its availability. If an item becomes unavailable after you order it, we will cancel that item and refund you in full.


5. PLACING AN ORDER

5.1  Your order is an offer to buy. A contract is formed only when we confirm the order and it appears in your Orders list with an order reference.

5.2  We or the seller may decline or cancel an order, before or after confirmation, where:

   •  the item is out of stock;
   •  there was a pricing or listing error;
   •  the delivery address is outside our serviceable area;
   •  we reasonably suspect fraud, coupon abuse, or resale in breach of these Terms;
   •  we are unable to verify the details you provided.

If we cancel a prepaid order for any of these reasons, you will be refunded in full.

5.3  The order total, any discount applied and the final payable amount are always calculated by KroZenda's servers from live prices at the time of checkout. Any amount displayed or submitted by your device is treated as indicative only.


6. PAYMENT

6.1  We currently accept:

   •  Cash on Delivery (COD), where available for your pincode and order value;
   •  KroZenda Wallet balance;
   •  Online payment (cards, UPI, net banking and wallets) through our payment gateway partner, Razorpay.

6.2  Online payments are processed by Razorpay. Your full card number, CVV and UPI credentials are entered on the gateway and are never received or stored by KroZenda. We store only a payment reference so we can match a payment to your order and process refunds.

6.3  For COD orders, payment is collected by the delivery agent at the time of delivery. Please keep the exact amount ready. The agent may refuse to hand over the parcel if payment cannot be collected.

6.4  If money leaves your account but your order is not confirmed, the amount is normally reversed by your bank or the gateway within 5 to 7 working days. If it is not, contact us with the payment reference and we will pursue it with the gateway on your behalf.


7. KROZENDA WALLET

7.1  The Wallet holds a rupee balance that can be used towards purchases on the Platform.

7.2  Balance can arise from refunds processed to the Wallet, and from amounts you add yourself where that option is available.

7.3  Wallet balance is not a deposit, earns no interest, and cannot be transferred to another user or withdrawn as cash except where required by law.

7.4  Every credit and debit is recorded in your Wallet transaction history with the reason and the resulting balance.


8. COUPONS AND PROMOTIONAL OFFERS

8.1  Coupons are subject to the conditions published with them, which may include a minimum order value, a validity window, specific products or categories, a per-user usage limit, and a total usage limit.

8.2  A coupon has no cash value and cannot be exchanged for cash or Wallet balance.

8.3  We may withdraw a coupon, or reverse a discount, where we reasonably believe it has been obtained or used through duplicate accounts, automated tools, or any other abuse.

8.4  If an order on which a coupon was used is cancelled or returned, the coupon may or may not be restored to you depending on the terms of that specific offer.


9. DELIVERY

9.1  Delivery timelines shown on the Platform are estimates provided by the seller and are not guaranteed.

9.2  Orders containing items from more than one seller may be dispatched separately and arrive at different times. Each item shows its own status.

9.3  Where a seller has shared a courier name and tracking number, these appear on your order. Please note that KroZenda does not currently operate an automated courier integration, so tracking information is only as current as the seller has provided, and an estimated delivery date is not available for every order.

9.4  Risk in the products passes to you on delivery. Please check the parcel at the time of delivery where possible and raise any damage or shortage promptly.

9.5  If delivery fails because nobody was available at the address, or the address or phone number was incorrect, re-delivery may be attempted or the order may be returned to the seller.


10. CANCELLATION

10.1  You may cancel an order yourself from your Orders screen while it is still Pending or Processing. Once an order has been marked Shipped, it can no longer be cancelled from the app and must be handled as a return.

10.2  Where a cancelled order was paid for, the amount is refunded to your KroZenda Wallet.

10.3  KroZenda or the seller may cancel an order in the circumstances set out in clause 5.2.


11. RETURNS, REPLACEMENTS AND REFUNDS

11.1  You may raise a return or replacement request from your order details, within the return window stated on the product page. Some products are marked non-returnable, for example items that are perishable, made to order, or sealed for hygiene reasons once opened.

11.2  A return request must be approved before it takes effect. We or the seller may ask you for photographs or other information to assess the request.

11.3  Products must be returned unused, in their original condition, with all tags, accessories, free items and original packaging intact.

11.4  Where a return is approved and the refund is due, the amount is credited to your KroZenda Wallet. Where a refund to the original payment method is required by law or agreed with you, timelines will depend on your bank or the payment gateway.

11.5  A refund covers the price you paid for the product. Delivery charges are refunded where the return arises from a defect, damage, or an incorrect item being sent.

11.6  If a return is rejected because the product was found to be used, damaged by you, or not the product that was sent, the item may be sent back to you and no refund will be due.


12. REVIEWS AND CONTENT YOU POST

12.1  You may review only products you have actually purchased through your account.

12.2  You are responsible for what you post. Do not post anything unlawful, defamatory, obscene, misleading, infringing, or containing another person's personal information.

12.3  By posting a review, photograph or other content, you grant KroZenda a non-exclusive, royalty-free, worldwide licence to host, display and reproduce it on the Platform and in connection with the Platform.

12.4  We may remove content that breaches these Terms, without notice.


13. AI ASSISTANT

13.1  The Platform offers an AI assistant that answers questions about your own account, such as your orders, their status, your Wallet balance and your purchase history.

13.2  The assistant reads only data belonging to the account you are signed in to. It cannot access any other customer's information.

13.3  The assistant is provided for convenience. It can make mistakes and its answers are not a substitute for your order details, your invoice, or a response from our support team. Where the assistant and your order details disagree, your order details are authoritative.

13.4  The assistant cannot place, change or cancel orders, and cannot move money.

13.5  Your messages and the relevant account information are processed by a third-party AI provider. See our Privacy Policy for what is shared and what is not.

13.6  Please do not enter payment card details, passwords, OTPs or other sensitive information into the chat. We will never ask for them there.


14. HOW YOU MAY AND MAY NOT USE THE PLATFORM

You agree not to:

   •  use the Platform for any unlawful purpose or in breach of any applicable law;
   •  resell, scrape, copy, mirror or systematically extract listings, prices, images or other content;
   •  use bots, scripts or automated means to access the Platform, place orders, or claim offers;
   •  interfere with the Platform's operation or security, or attempt to gain unauthorised access to any account, server or data;
   •  impersonate another person, or provide false information;
   •  place orders you do not intend to accept, or repeatedly refuse COD deliveries.

We may suspend or close an account that breaches this clause.


15. INTELLECTUAL PROPERTY

The KroZenda name, logo, software, design and compilation of content on the Platform belong to KroZenda or its licensors. Product images, brand names and trademarks belong to the respective sellers or brand owners. Nothing on the Platform grants you any licence to use them except as necessary to use the Platform as an ordinary customer.


16. OUR RESPONSIBILITY AND ITS LIMITS

16.1  Nothing in these Terms limits any liability that cannot be limited under applicable law, including liability for death or personal injury caused by negligence, or for fraud.

16.2  Subject to clause 16.1, and to the extent permitted by law, KroZenda is not liable for indirect or consequential loss, loss of profit, loss of business, or loss of opportunity.

16.3  Subject to clause 16.1, and to the extent permitted by law, our total liability in connection with an order is limited to the amount you paid for that order.

16.4  For products sold by third-party sellers, the seller is responsible for the product itself. We will help you pursue a claim against the seller through our grievance process.

16.5  The Platform is provided on an "as is" basis. We do not warrant that it will be uninterrupted or error-free.


17. SUSPENSION AND CLOSURE OF ACCOUNTS

17.1  You may ask us to close your account at any time by contacting support. Certain records must be retained after closure, as explained in our Privacy Policy.

17.2  We may suspend or close your account where you have breached these Terms, where we are required to by law, or where we reasonably suspect fraud or abuse. Where we do so, we will tell you the reason unless we are legally prevented from doing so.


18. CHANGES TO THESE TERMS

We may update these Terms from time to time. The version and date at the top of this page tell you when it was last changed. Material changes will be notified to you in the app or by message. Continuing to use the Platform after a change means you accept the updated Terms. The Terms that apply to an order are those in force when you placed it.


19. GOVERNING LAW AND DISPUTES

19.1  These Terms are governed by the laws of India.

19.2  Please contact our grievance officer first. Most issues are resolved at that stage.

19.3  Subject to clause 19.2, the courts at Bengaluru, Karnataka shall have exclusive jurisdiction, without prejudice to any right you may have to approach a consumer forum at your place of residence under the Consumer Protection Act, 2019.


20. GRIEVANCE REDRESSAL

In accordance with the Consumer Protection (E-Commerce) Rules, 2020 and the Information Technology Act, 2000, our grievance officer can be contacted at:

   Grievance Officer
   KroZenda Technologies Private Limited
   Email: compliance@krozenda.com

We will acknowledge your complaint within 48 hours and aim to resolve it within one month of receipt.

For questions about these Terms, write to compliance@krozenda.com.`,
  },
  'privacy-policy': {
    title: 'Privacy Policy',
    version: 'v2.0',
    updatedAt: '17 Sep 2026',
    updatedBy: 'Data Protection Officer',
    requiresAcceptance: true,
    content: `KROZENDA PRIVACY POLICY

Last updated: 17 September 2026

This policy explains what personal data KroZenda Technologies Private Limited ("KroZenda", "we", "us") collects when you use our website or apps, why we collect it, who we share it with, and the choices and rights you have.

It is written for customers of the Platform. Sellers are covered by a separate seller agreement.


1. THE SHORT VERSION

   •  We collect what we need to run your account, take your orders, deliver them and support you.
   •  We do not sell your personal data to anyone.
   •  We never see or store your full card number, CVV or UPI PIN. Those go straight to our payment gateway.
   •  We share your delivery details with the seller of what you bought, because they are the ones shipping it.
   •  The AI assistant sends only a small, relevant slice of your own data to a third-party AI provider, and never another customer's.
   •  You can ask to see, correct or delete your data.


2. THE DATA WE COLLECT

2.1  Information you give us

   •  Mobile number. Required, this is how you sign in.
   •  Name, email address, gender and date of birth, if you choose to add them to your profile.
   •  Profile photograph, if you upload one.
   •  Delivery addresses, including the recipient's name, phone number, street address, city, state and PIN code.
   •  The contents of support tickets you raise, and any photographs you attach to a return request.
   •  Product reviews and ratings you post.
   •  Messages you type into the AI assistant.

2.2  Information generated by your use of the Platform

   •  Your orders: items, quantities, prices, amounts paid, payment method, order and delivery status.
   •  Your cart and wishlist.
   •  Your Wallet balance and the history of credits and debits.
   •  Coupons you have used and the discount each one gave.
   •  Return and replacement requests and their outcome.

2.3  Technical information

   •  A device push token, if you allow notifications, so we can send you order updates.
   •  IP address, browser or app version, and the time of your requests, recorded in our server logs.
   •  A session token stored on your device to keep you signed in.

2.4  What we deliberately do not collect

   •  Your full card number, expiry, CVV or UPI PIN. These are entered on the payment gateway's own screens. We receive only a reference for the transaction and, where applicable, the last few digits and card network so you can recognise the payment.
   •  Your bank account credentials or net banking password.
   •  GSTIN or PAN. These are collected from sellers, not from customers.


3. WHY WE USE YOUR DATA

   •  To create and secure your account, and to sign you in using an OTP.
   •  To process your orders, collect payment, and pass the delivery details to the seller who is shipping to you.
   •  To handle cancellations, returns, replacements and refunds.
   •  To operate the KroZenda Wallet and keep an accurate transaction record.
   •  To validate coupon eligibility and enforce usage limits.
   •  To send you transactional messages about your orders, such as confirmation, dispatch and delivery updates.
   •  To answer your questions through support or the AI assistant.
   •  To detect and prevent fraud, coupon abuse and misuse of the Platform.
   •  To meet our legal, tax and accounting obligations.
   •  To understand, in aggregate, how the Platform is used so that we can improve it.

We rely on your consent for optional processing such as push notifications and marketing messages, and on the necessity of performing our contract with you, and on our legal obligations, for the rest.


4. WHO WE SHARE YOUR DATA WITH

We share only what is necessary, and only with:

4.1  The seller of what you bought
     Your name, delivery address and contact number, and the items in that order, so they can pack and ship it. A seller sees only the orders placed with them.

4.2  Razorpay, our payment gateway
     To take payment and to process refunds. Razorpay receives your payment details directly from you and processes them under its own privacy policy.

4.3  Google Firebase Cloud Messaging
     To deliver push notifications to your device, if you have allowed them.

4.4  Our SMS gateway
     To deliver the OTP to your mobile number at sign-in. Only the mobile number and the message are shared.

4.5  Google (Gemini API)
     Only when you use the AI assistant, and only as described in section 5.

4.6  Government authorities, courts or regulators
     Where we are required by law to disclose information, or where disclosure is necessary to establish, exercise or defend a legal claim, or to prevent fraud or harm.

4.7  A buyer of our business
     If KroZenda is merged with or acquired by another company, your data may transfer as part of that transaction. You will be told if that happens and this policy will continue to apply until replaced.

We do not sell, rent or trade your personal data.


5. THE AI ASSISTANT

When you send a message to the AI assistant, your message is sent to our servers, not to the AI provider directly.

Our server then looks up only the information needed to answer that particular question from your own account, and sends your message along with that information to Google's Gemini API to produce a reply.

What is sent:

   •  Your message, and a limited number of recent messages from that conversation for context.
   •  A small, purpose-built extract of your own data relevant to the question, for example your order count, the status of your latest order, or your Wallet balance.

What is never sent:

   •  Any other customer's data. The assistant can only ever read data belonging to the account you are signed in to.
   •  Your password, session token, or any API key.
   •  Your full card number, CVV or bank details. We do not hold these in the first place.
   •  Internal notes written by our staff on your support tickets.
   •  Your full street address. Where location is relevant, only the city, state and PIN code are used.

Your chat history is stored against your account so you can reopen past conversations. You can delete a conversation from the chat history screen at any time.

Please do not type payment details, passwords or OTPs into the chat.


6. SECURITY

We take reasonable technical and organisational measures to protect your data, including:

   •  Traffic between your device and our servers is encrypted in transit using HTTPS.
   •  Passwords, where you have set one, are stored only as a salted one-way hash and are never readable by us or recoverable in plain text.
   •  Access to production systems is limited to staff who need it for their role, and staff permissions are role-based.
   •  Sign-in is protected by OTP, and OTP requests are rate limited to resist brute-force and enumeration attempts.
   •  Payment credentials never reach our servers.

No system can be guaranteed completely secure. If we become aware of a breach affecting your personal data, we will notify you and the relevant authority as required by law.


7. HOW LONG WE KEEP YOUR DATA

   •  Account details are kept while your account is open.
   •  Orders, invoices, payment references and Wallet transactions are retained for as long as required under Indian tax and accounting law, which is currently up to eight years, even after your account is closed.
   •  Support tickets and return requests are retained so that we have a record of how a dispute was handled.
   •  Server logs are retained for a limited period for security and troubleshooting.
   •  AI conversations are retained until you delete them, and thereafter in our records for a limited period for abuse investigation.

When you ask us to delete your account, we deactivate it and remove or anonymise what we are not legally required to keep.


8. YOUR RIGHTS

Subject to applicable law, including the Digital Personal Data Protection Act, 2023, you have the right to:

   •  Access the personal data we hold about you.
   •  Correct information that is inaccurate or incomplete. Most of this you can do yourself from your profile and address book.
   •  Ask us to delete your account and personal data, subject to the retention periods in section 7.
   •  Withdraw a consent you previously gave, such as for push notifications or marketing messages.
   •  Nominate another person to exercise your rights in the event of your death or incapacity.
   •  Complain to us, and to the relevant data protection authority, if you believe your data has been mishandled.

To exercise any of these, write to privacy@krozenda.com from the email address on your account, or raise a support ticket from within the app. We may need to verify your identity before acting on a request. We will respond within the timelines set by applicable law.


9. MARKETING AND NOTIFICATIONS

   •  Transactional messages about your orders are part of the service and are sent regardless of marketing preferences.
   •  Promotional push notifications and messages are sent only where you have allowed them, and you can turn them off at any time in your device settings or from the Settings screen in the app.


10. COOKIES AND LOCAL STORAGE

We use your browser's local storage to keep you signed in and to remember preferences such as your cart. We do not use third-party advertising cookies. Firebase may set identifiers necessary to deliver push notifications where you have enabled them. Clearing your browser data will sign you out.


11. CHILDREN

The Platform is not intended for children under 18. We do not knowingly collect personal data from a child. If you believe a child has given us personal data, contact us and we will delete it.


12. CHANGES TO THIS POLICY

We may update this policy. The version and date at the top of this page show when it last changed. Where a change is material, we will notify you in the app or by message before it takes effect.


13. HOW TO CONTACT US

   Data Protection Officer
   KroZenda Technologies Private Limited
   Email: privacy@krozenda.com

   Grievance Officer
   Email: compliance@krozenda.com

We acknowledge privacy requests and complaints within 48 hours and aim to resolve them within one month.`,
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
          </div>
        </div>
      </footer>
    </div>
  )
}

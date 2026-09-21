import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  HiChevronRight,
  HiChevronLeft,
  HiBolt,
  HiCurrencyRupee,
  HiCheckBadge,
  HiSparkles,
  HiShieldCheck,
  HiTruck,
  HiArrowPath,
  HiTag,
  HiBriefcase,
  HiBuildingOffice2,
} from 'react-icons/hi2'
import { Link, useNavigate } from 'react-router-dom'
import { SmartImage } from '../../../../components/ui/SmartImage'
import { SectionErrorBoundary } from '../../../../components/common/ErrorBoundary'
import { ProductCard } from '../ecommerce/ProductCard'
import { USER_ROUTES, userPath } from '../../../../config/routes'
import { useProductsController } from '../../controllers/useProductsController'

// All Products' Product-type toggle. 'all' is what a fresh page load shows;
// the other two ask the API to filter by Product.fulfillmentProvider so a
// buyer can isolate CJ-sourced stock from the seller's/admin's own stock.
const PRODUCT_TYPE_OPTIONS = [
  { value: 'all', label: 'All products' },
  { value: 'dropship', label: 'Dropship only' },
  { value: 'normal', label: 'Regular stock only' },
]

const BANNER_ICON_MAP = {
  truck: HiTruck,
  currency: HiCurrencyRupee,
  shield: HiShieldCheck,
  refresh: HiArrowPath,
  briefcase: HiBriefcase,
  building: HiBuildingOffice2,
  sparkles: HiSparkles,
  tag: HiTag,
}

const STRIP_THEME_CLASSES = {
  blue: { icon: 'bg-blue-50 text-blue-600', hover: 'hover:border-blue-300' },
  amber: { icon: 'bg-amber-50 text-amber-600', hover: 'hover:border-amber-300' },
  emerald: { icon: 'bg-emerald-50 text-emerald-600', hover: 'hover:border-emerald-300' },
  purple: { icon: 'bg-purple-50 text-purple-600', hover: 'hover:border-purple-300' },
}

const PASTEL_BG_COLORS = [
  'bg-amber-100/80',
  'bg-orange-100/80',
  'bg-rose-100/80',
  'bg-indigo-100/80',
  'bg-emerald-100/80',
  'bg-sky-100/80',
  'bg-teal-100/80',
  'bg-purple-100/80',
]

const heroSlideVariants = {
  enter: (direction) => ({
    x: direction > 0 ? '100%' : '-100%',
    opacity: 0,
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
  },
  exit: (direction) => ({
    zIndex: 0,
    x: direction < 0 ? '100%' : '-100%',
    opacity: 0,
  }),
}

const sectionFadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1.0] },
  },
}

export function HomeCenterFeed({
  categories = [],
  flashSale = [],
  trending = [],
  brands = [],
  banners = [],
  coupons = [],
  isLoading = {},
  timeLeft = { hours: 0, minutes: 0, seconds: 0 },
  trustTiles = [],
  className = '',
}) {
  const navigate = useNavigate()

  // "All Products" strip — the one place on the dashboard that mixes
  // dropship (CJ) and regular stock together with a toggle to tell them
  // apart, since the Hot Deals / Trending rails above only ever show
  // whatever happens to be flagged flashSale/trending.
  const [productType, setProductType] = useState('all')
  const { products: allProducts, isLoading: isAllProductsLoading } = useProductsController({
    limit: 8,
    sort: 'newest',
    ...(productType !== 'all' ? { source: productType } : {}),
  })

  // Category horizontal scroll controls
  const categoryScrollRef = useRef(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  const checkCategoryScroll = () => {
    if (categoryScrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = categoryScrollRef.current
      setCanScrollLeft(scrollLeft > 10)
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10)
    }
  }

  const scrollCategories = (direction) => {
    if (categoryScrollRef.current) {
      const scrollAmount = direction === 'left' ? -260 : 260
      categoryScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' })
    }
  }

  // Hero Banner carousel state
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0)
  const [bannerDirection, setBannerDirection] = useState(1)

  // Default hero banners reflecting the B2B/B2C marketplace branding
  const fallbackBanners = [
    {
      id: 'ref-hero-1',
      tag: 'DIRECT FACTORY WHOLESALE',
      title: 'Verified Quality Wholesale & Dropshipping',
      subtitle: 'Source directly from verified manufacturers • White-label dispatch under your brand',
      tagline: 'Verified B2B & B2C Marketplace 🛡️',
      features: [
        { label: '100% Verified Quality', icon: 'shield' },
        { label: 'Safe Escrow Protection', icon: 'sparkles' },
        { label: 'Express 24-48h Dispatch', icon: 'truck' },
      ],
      image: '/images/hero_banner_mega_sale.png',
      ctaText: 'SHOP NOW →',
      ctaPath: USER_ROUTES.LISTING,
      bgGradient: 'from-blue-700 via-indigo-700 to-slate-950',
    },
    {
      id: 'ref-hero-2',
      tag: 'HIGH MARGIN RESELLING',
      title: 'Trending Gadgets, Fashion & Electronics',
      subtitle: 'Direct factory pricing with maximum profit margins • Full GST compliance',
      tagline: 'Direct Manufacturer Tier ⚡',
      features: [
        { label: 'Direct Factory Price', icon: 'currency' },
        { label: 'Escrow Protected', icon: 'shield' },
        { label: 'Pan-India Air Cargo', icon: 'truck' },
      ],
      image: '/images/banner_wholesale_deals.png',
      ctaText: 'EXPLORE DEALS →',
      ctaPath: USER_ROUTES.LISTING,
      bgGradient: 'from-blue-600 via-indigo-600 to-blue-800',
    },
  ]

  const heroBanners = (banners || [])
    .filter((b) => b.placement === 'hero' || !b.placement)
    .slice(0, 5)

  const activeBanners = heroBanners.length > 0 ? heroBanners : fallbackBanners

  // Auto-advance banner carousel every 5.5s
  useEffect(() => {
    if (activeBanners.length <= 1) return
    const timer = setInterval(() => {
      setBannerDirection(1)
      setCurrentBannerIndex((prev) => (prev + 1) % activeBanners.length)
    }, 5500)
    return () => clearInterval(timer)
  }, [activeBanners.length])

  const nextBanner = () => {
    setBannerDirection(1)
    setCurrentBannerIndex((prev) => (prev + 1) % activeBanners.length)
  }

  const prevBanner = () => {
    setBannerDirection(-1)
    setCurrentBannerIndex((prev) => (prev - 1 + activeBanners.length) % activeBanners.length)
  }

  const formatTime = (val) => val.toString().padStart(2, '0')
  const curBanner = activeBanners[currentBannerIndex] || activeBanners[0]

  const hasCategories = categories.length > 0
  const hasFlashSale = flashSale.length > 0
  const hasTrending = trending.length > 0
  const hasBrands = brands.length > 0

  return (
    <main className={`flex-1 min-w-0 space-y-5 sm:space-y-7 md:space-y-8 ${className}`}>
      {/* 1. HERO BANNER (Blue Marketplace Theme with Feature Badges) */}
      <div className="w-full relative overflow-hidden rounded-2xl sm:rounded-3xl shadow-card group cursor-pointer aspect-[16/9] sm:aspect-[21/9] lg:aspect-[24/9] min-h-[190px] sm:min-h-[260px] lg:min-h-[300px] bg-blue-700 text-white">
        <div
          onClick={() => {
            navigate(curBanner.ctaPath || (curBanner.productId ? userPath.product(curBanner.productId) : USER_ROUTES.LISTING))
          }}
          className="w-full h-full relative overflow-hidden"
        >
          <AnimatePresence initial={false} custom={bannerDirection}>
            <motion.div
              key={currentBannerIndex}
              custom={bannerDirection}
              variants={heroSlideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: 'spring', stiffness: 300, damping: 30 },
                opacity: { duration: 0.35 },
              }}
              className="absolute inset-0 h-full w-full flex items-center justify-between overflow-hidden bg-gradient-to-r from-blue-700 via-indigo-600 to-slate-900 p-4 sm:p-7 md:p-8"
            >
              {/* Left Column Text & CTAs */}
              <div className="z-10 max-w-[62%] sm:max-w-md lg:max-w-lg space-y-1.5 sm:space-y-3">
                {curBanner.tag && (
                  <span className="inline-block px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-white/15 text-blue-100 font-extrabold text-[9px] sm:text-[10px] tracking-wider uppercase border border-white/20 backdrop-blur-xs">
                    {curBanner.tag}
                  </span>
                )}

                <h1 className="text-base sm:text-2xl md:text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight line-clamp-2">
                  {curBanner.title || 'Verified Quality Wholesale & Dropshipping'}
                </h1>

                <p className="text-[11px] sm:text-sm text-blue-100 font-normal line-clamp-2">
                  {curBanner.subtitle || 'Source directly from verified manufacturers • White-label dispatch'}
                </p>

                {/* Feature Tags Row (Desktop/Tablet) */}
                <div className="hidden sm:flex flex-wrap items-center gap-2 pt-1 text-[11px] font-semibold text-white">
                  <span className="flex items-center gap-1 bg-white/15 backdrop-blur-xs px-2.5 py-1 rounded-full shadow-2xs border border-white/20">
                    <HiCheckBadge className="w-3.5 h-3.5 text-blue-300" /> 100% Quality Checked
                  </span>
                  <span className="flex items-center gap-1 bg-white/15 backdrop-blur-xs px-2.5 py-1 rounded-full shadow-2xs border border-white/20">
                    <HiShieldCheck className="w-3.5 h-3.5 text-blue-300" /> Safe Escrow
                  </span>
                  <span className="flex items-center gap-1 bg-white/15 backdrop-blur-xs px-2.5 py-1 rounded-full shadow-2xs border border-white/20">
                    <HiTruck className="w-3.5 h-3.5 text-blue-300" /> Fast 24-48h Dispatch
                  </span>
                </div>

                {/* Shop Now CTA button */}
                <div className="pt-1 sm:pt-2">
                  <button
                    type="button"
                    className="touch-auto-target inline-flex items-center space-x-1 sm:space-x-1.5 px-3.5 py-1.5 sm:px-5 sm:py-2 rounded-full bg-white hover:bg-blue-50 text-blue-700 font-bold text-[11px] sm:text-xs shadow-md hover:scale-103 active:scale-95 transition-all"
                  >
                    <span>{curBanner.ctaText || 'SHOP NOW'}</span>
                    <HiChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  </button>
                </div>
              </div>

              {/* Right Side Visual / Photography */}
              <div className="relative w-[38%] sm:w-1/2 h-full flex items-center justify-end pointer-events-none">
                <div className="absolute top-2 right-2 text-right hidden sm:block">
                  <span className="text-xs font-semibold text-blue-200/90">
                    {curBanner.tagline || 'Verified B2B & B2C Marketplace 🛡️'}
                  </span>
                </div>
                {curBanner.image && (
                  <div className="w-full max-w-[130px] sm:max-w-[280px] md:max-w-[360px] h-[85%] relative">
                    <SmartImage
                      src={curBanner.image}
                      alt={curBanner.title}
                      priority
                      sizes="(max-width: 640px) 130px, 360px"
                      ratio="auto"
                      fit="contain"
                      className="w-full h-full object-contain filter drop-shadow-2xl"
                    />
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Carousel Chevrons (Desktop only) */}
        {activeBanners.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                prevBanner()
              }}
              className="touch-auto-target hidden sm:flex absolute left-2.5 sm:left-4 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-black/30 hover:bg-black/60 text-white items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-md"
              style={{ minWidth: '32px', minHeight: '32px' }}
              aria-label="Previous slide"
            >
              <HiChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                nextBanner()
              }}
              className="touch-auto-target hidden sm:flex absolute right-2.5 sm:right-4 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-black/30 hover:bg-black/60 text-white items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-md"
              style={{ minWidth: '32px', minHeight: '32px' }}
              aria-label="Next slide"
            >
              <HiChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </>
        )}

        {/* Carousel Indicator Dots */}
        {activeBanners.length > 1 && (
          <div className="absolute bottom-2 sm:bottom-3 right-3 sm:right-4 z-20 flex items-center space-x-1 bg-black/45 backdrop-blur-md px-2 py-0.5 rounded-full pointer-events-auto">
            {activeBanners.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setBannerDirection(idx > currentBannerIndex ? 1 : -1)
                  setCurrentBannerIndex(idx)
                }}
                className="touch-auto-target indicator-dot p-1 flex items-center justify-center focus:outline-none cursor-pointer"
                style={{ minWidth: 0, minHeight: 0, padding: '3px' }}
                aria-label={`Slide ${idx + 1}`}
              >
                <span
                  className={`block transition-all duration-300 rounded-full ${
                    idx === currentBannerIndex
                      ? 'bg-white shadow-xs'
                      : 'bg-white/40 hover:bg-white/75'
                  }`}
                  style={{
                    height: '5px',
                    width: idx === currentBannerIndex ? '18px' : '6px',
                    minWidth: idx === currentBannerIndex ? '18px' : '6px',
                    minHeight: '5px',
                  }}
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 2. CIRCULAR CATEGORY QUICK-BAR (Bubble Icons Carousel) */}
      <div
        className={`relative group/catbar py-1 ${!isLoading.categories && !hasCategories ? 'hidden' : ''}`}
      >
        {/* Left Scroll Button */}
        <button
          type="button"
          onClick={() => scrollCategories('left')}
          className={`touch-auto-target hidden sm:flex absolute -left-3 top-1/2 -translate-y-1/2 z-30 w-8 h-8 rounded-full bg-white hover:bg-blue-600 hover:text-white text-slate-700 shadow-card border border-slate-200 items-center justify-center transition-all ${
            canScrollLeft ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          style={{ minWidth: '32px', minHeight: '32px' }}
          aria-label="Scroll left categories"
        >
          <HiChevronLeft className="w-4 h-4" />
        </button>

        {/* Scrollable Bubble Row */}
        <div
          ref={categoryScrollRef}
          onScroll={checkCategoryScroll}
          className="flex items-start overflow-x-auto gap-3 sm:gap-5 md:gap-6 text-center px-1 scroll-smooth no-scrollbar"
        >
          {isLoading.categories
            ? [1, 2, 3, 4, 5, 6, 7].map((n) => (
                <div key={n} className="flex flex-col items-center shrink-0 space-y-2 w-[68px] sm:w-[78px] animate-pulse">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-slate-200" />
                  <div className="w-12 h-2.5 bg-slate-200 rounded-md" />
                </div>
              ))
            : categories.map((item, idx) => {
                const bg = PASTEL_BG_COLORS[idx % PASTEL_BG_COLORS.length]
                return (
                  <Link
                    key={item.id || item._id}
                    to={userPath.listing({ category: item.id || item._id })}
                    onClick={() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' })}
                    className="flex flex-col items-center shrink-0 group w-[66px] sm:w-[76px] focus-visible:outline-none"
                  >
                    <motion.div
                      whileHover={{ y: -3, scale: 1.06 }}
                      whileTap={{ scale: 0.95 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                      className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full ${bg} overflow-hidden shadow-card group-hover:shadow-card-hover transition-all duration-300 border border-slate-200/70 flex items-center justify-center p-1`}
                    >
                      <SmartImage
                        src={item.image}
                        alt={item.name}
                        sizes="70px"
                        ratio="1 / 1"
                        fit="contain"
                        className="h-full w-full !bg-transparent object-contain transition-transform group-hover:scale-108"
                      />
                    </motion.div>
                    <span className="text-[11px] sm:text-xs font-semibold text-slate-700 group-hover:text-blue-600 transition-colors text-center leading-tight line-clamp-1 w-full mt-1.5">
                      {item.name}
                    </span>
                  </Link>
                )
              })}
        </div>

        {/* Right Scroll Button */}
        <button
          type="button"
          onClick={() => scrollCategories('right')}
          className={`touch-auto-target hidden sm:flex absolute -right-3 top-1/2 -translate-y-1/2 z-30 w-8 h-8 rounded-full bg-white hover:bg-blue-600 hover:text-white text-slate-700 shadow-card border border-slate-200 items-center justify-center transition-all ${
            canScrollRight ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          style={{ minWidth: '32px', minHeight: '32px' }}
          aria-label="Scroll right categories"
        >
          <HiChevronRight className="w-4 h-4" />
        </button>

      </div>

      {/* 3. 🔥 HOT DEALS / FLASH SALE SECTION */}
      <SectionErrorBoundary label="Hot deals">
        {isLoading.flashSale ? (
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/70 shadow-card space-y-4">
            <div className="h-5 w-40 bg-slate-200 rounded animate-pulse" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="bg-slate-50 rounded-2xl p-3 animate-pulse space-y-2">
                  <div className="w-full aspect-square bg-slate-200 rounded-xl" />
                  <div className="w-3/4 h-3 bg-slate-200 rounded" />
                </div>
              ))}
            </div>
          </div>
        ) : hasFlashSale ? (
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={sectionFadeUp}
            className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/70 shadow-card space-y-4"
          >
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <span className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center space-x-1.5">
                  <span className="text-red-500">🔥</span>
                  <span>Hot Deals</span>
                </span>
                <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-200/60">
                  Ends in {formatTime(timeLeft.hours)}:{formatTime(timeLeft.minutes)}:{formatTime(timeLeft.seconds)}
                </span>
              </div>

              <Link
                to={userPath.listing({ flashSale: true })}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center space-x-0.5 group shrink-0"
              >
                <span>View All</span>
                <HiChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            {/* Grid of Product Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
              {flashSale.map((product) => (
                <ProductCard key={product.id || product._id} product={product} />
              ))}
            </div>
          </motion.section>
        ) : null}
      </SectionErrorBoundary>

      {/* 4. TRENDING PRODUCTS */}
      <SectionErrorBoundary label="Trending products">
        {isLoading.trending ? (
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/70 shadow-card space-y-4">
            <div className="h-5 w-48 bg-slate-200 rounded animate-pulse" />
          </div>
        ) : hasTrending ? (
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={sectionFadeUp}
            className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/70 shadow-card space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 gap-3">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight flex items-center space-x-1.5">
                  <HiCurrencyRupee className="w-4 h-4 text-emerald-600" />
                  <span>Trending High Margins</span>
                </h2>
                <p className="text-[11px] text-slate-500 font-normal">Most reordered wholesale products this week</p>
              </div>

              <Link
                to={userPath.listing({ trending: true })}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center space-x-0.5 group shrink-0"
              >
                <span>View All</span>
                <HiChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
              {trending.map((product) => (
                <ProductCard key={product.id || product._id} product={product} />
              ))}
            </div>
          </motion.section>
        ) : null}
      </SectionErrorBoundary>

      {/* 4.5 ALL PRODUCTS — mixes dropship (CJ) and regular stock, with a
          toggle to tell them apart, so a buyer isn't stuck scrolling only
          the curated Hot Deals / Trending rails to find dropship items. */}
      <SectionErrorBoundary label="All products">
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          variants={sectionFadeUp}
          className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/70 shadow-card space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">All Products</h2>
            <Link
              to={userPath.listing(productType !== 'all' ? { source: productType } : {})}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center space-x-0.5 group shrink-0"
            >
              <span>View All</span>
              <HiChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {/* Product-type toggle */}
          <div className="flex flex-wrap items-center gap-2">
            {PRODUCT_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setProductType(opt.value)}
                className={`rounded-full px-3 py-1.5 text-[11px] font-bold border transition-colors ${
                  productType === opt.value
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {isAllProductsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="bg-slate-50 rounded-2xl p-3 animate-pulse space-y-2">
                  <div className="w-full aspect-square bg-slate-200 rounded-xl" />
                  <div className="w-3/4 h-3 bg-slate-200 rounded" />
                </div>
              ))}
            </div>
          ) : allProducts.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
              {allProducts.map((product) => (
                <ProductCard key={product.id || product._id} product={product} />
              ))}
            </div>
          ) : (
            <p className="text-xs font-semibold text-slate-500 py-6 text-center">
              No products match this filter yet.
            </p>
          )}
        </motion.section>
      </SectionErrorBoundary>

      {/* 5. OFFICIAL BRAND STORES */}
      <SectionErrorBoundary label="Brand stores">
        {hasBrands && (
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={sectionFadeUp}
            className="space-y-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">Official Brand Stores</h2>
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <HiCheckBadge className="w-3 h-3 text-emerald-600" /> 100% Genuine
                </span>
              </div>
              <Link
                to={USER_ROUTES.CATEGORIES}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center space-x-0.5 group"
              >
                <span>Explore all</span>
                <HiChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 text-center">
              {brands.slice(0, 6).map((brand) => (
                <Link
                  key={brand.id || brand._id}
                  to={userPath.listing({ brand: brand.id || brand._id })}
                  className="bg-white rounded-2xl p-3 border border-slate-200/70 shadow-card hover:shadow-card-hover hover:border-blue-300 transition-all flex flex-col items-center justify-center group"
                >
                  <div className="w-full h-12 flex items-center justify-center p-1">
                    {brand.logo ? (
                      <SmartImage
                        src={brand.logo}
                        alt={brand.name}
                        sizes="100px"
                        ratio="3 / 2"
                        className="max-h-10 object-contain !bg-transparent"
                      />
                    ) : (
                      <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center uppercase">
                        {brand.name ? brand.name.slice(0, 2).toUpperCase() : 'BR'}
                      </span>
                    )}
                  </div>
                  <span className="mt-1.5 text-xs font-semibold text-slate-800 group-hover:text-blue-600 transition-colors truncate w-full">
                    {brand.name}
                  </span>
                </Link>

              ))}
            </div>
          </motion.section>
        )}
      </SectionErrorBoundary>

      {/* 6. TRUST STRIP (Displayed on small viewports where right sidebar is hidden) */}
      <div className="xl:hidden grid grid-cols-2 gap-3 pt-2">
        {trustTiles.map((tile, idx) => {
          const TileIcon = BANNER_ICON_MAP[tile.icon] || HiSparkles
          const theme = STRIP_THEME_CLASSES[tile.theme] || STRIP_THEME_CLASSES.blue
          return (
            <div
              key={tile.id || idx}
              className="bg-white rounded-2xl p-3 border border-slate-200/70 shadow-card flex items-center space-x-2.5"
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${theme.icon}`}>
                <TileIcon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-semibold text-slate-900 truncate">{tile.title}</h4>
                <p className="text-[10px] text-slate-500 truncate">{tile.subtitle}</p>
              </div>
            </div>
          )
        })}
      </div>
    </main>
  )
}

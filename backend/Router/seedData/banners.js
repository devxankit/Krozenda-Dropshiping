const SEED_BANNERS = [
  // =========================================================================
  // HERO BANNERS (5 items with WebP images)
  // =========================================================================
  {
    title: 'Direct Factory Dropship Hub',
    subtitle: 'Zero Inventory Investment • White-Label Packaging',
    tag: '⚡ DIRECT FACTORY TIER',
    image: '/uploads/banners/banner_factory_dropship.webp',
    placement: 'hero',
    ctaPath: '/app/listing',
    status: 'active',
  },
  {
    title: 'Next-Gen Audio & Tech Fest',
    subtitle: 'Up to 70% Off Premium ANC Headphones & Speakers',
    tag: '🔥 AUDIO SPECIAL',
    image: '/uploads/banners/banner_smart_gadgets.webp',
    placement: 'hero',
    ctaPath: '/app/listing',
    status: 'active',
  },
  {
    title: 'Flagship Smartphone Carnival',
    subtitle: 'Latest 5G Flagships with Zero Cost EMI & Exchange Bonus',
    tag: '📱 5G CARNIVAL',
    image: '/uploads/banners/banner_smartphone_carnival.webp',
    placement: 'hero',
    ctaPath: '/app/listing',
    status: 'active',
  },
  {
    title: 'White Label Pan-India Logistics',
    subtitle: 'Dispatch Within 24 Hours • Express Air Shipping',
    tag: '🚀 FAST DISPATCH',
    image: '/uploads/banners/banner_express_logistics.webp',
    placement: 'hero',
    ctaPath: '/app/listing',
    status: 'active',
  },
  {
    title: 'Modern Living & Smart Home Fest',
    subtitle: 'Kitchenware, Cookware & LED Lighting Deals',
    tag: '🏠 HOME ESSENTIALS',
    image: '/uploads/banners/banner_home_appliances.webp',
    placement: 'hero',
    ctaPath: '/app/categories',
    status: 'active',
  },

  // =========================================================================
  // PROMO BANNERS (4 items)
  // =========================================================================
  {
    title: 'Earn Upto ₹50,000/mo Dropshipping',
    subtitle: 'Zero inventory investment. We ship under your brand name directly to customer doorsteps.',
    tag: 'HIGH MARGIN RESELLING',
    icon: 'briefcase',
    theme: 'emerald',
    placement: 'promo',
    ctaPath: '/app/listing',
    status: 'active',
  },
  {
    title: 'Direct Factory Wholesale Prices',
    subtitle: '100% Genuine products with manufacturer GST tax invoice and bulk tiered quantity slabs.',
    tag: 'VERIFIED FACTORY SUPPLIERS',
    icon: 'building',
    theme: 'purple',
    placement: 'promo',
    ctaPath: '/app/categories',
    status: 'active',
  },
  {
    title: 'Super Flash Lightning Deals',
    subtitle: 'Up to 80% discount on trending tech, accessories and sneakers refreshed every midnight.',
    tag: 'DAILY FLASH SAVINGS',
    icon: 'sparkles',
    theme: 'amber',
    placement: 'promo',
    ctaPath: '/app/listing',
    status: 'active',
  },
  {
    title: 'Exclusive B2B Volume Pricing',
    subtitle: 'Automated GST input tax credit calculation with dedicated enterprise relationship manager.',
    tag: 'BUSINESS SAVINGS',
    icon: 'currency',
    theme: 'blue',
    placement: 'promo',
    ctaPath: '/app/listing',
    status: 'active',
  },

  // =========================================================================
  // STRIP / TRUST TILES (3 items)
  // =========================================================================
  {
    title: '24-48hr Dispatch',
    subtitle: 'Pan-India Express Air Shipping',
    icon: 'truck',
    theme: 'blue',
    placement: 'strip',
    status: 'active',
  },
  {
    title: 'Direct Factory Price',
    subtitle: 'Zero Middlemen Margin Guaranteed',
    icon: 'currency',
    theme: 'amber',
    placement: 'strip',
    status: 'active',
  },
  {
    title: 'Verified Quality Check',
    subtitle: '100% Genuine Products with GST',
    icon: 'shield',
    theme: 'emerald',
    placement: 'strip',
    status: 'active',
  },

  // =========================================================================
  // INACTIVE BANNER (1 item for admin toggle validation)
  // =========================================================================
  {
    title: 'Monsoon Clearance Mega Fest (Past Campaign)',
    subtitle: 'Exclusive discounts on monsoon footwear and waterproof gadgets.',
    tag: 'EXPIRED PROMO',
    image: '/uploads/banners/banner_monsoon_clearance.webp',
    placement: 'hero',
    ctaPath: '/app/listing',
    status: 'inactive',
  },
];

module.exports = { SEED_BANNERS };

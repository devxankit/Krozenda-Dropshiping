const SEED_ORDERS = [
  // -------------------------------------------------------------------------
  // DELIVERED ORDERS (Orders 1 to 7)
  // -------------------------------------------------------------------------
  {
    orderKey: 'ORD-2026-0001',
    userEmail: 'aarav.sharma@example.com',
    itemSkus: [
      { sku: 'BOAT-AIR-141', quantity: 1, variant: 'Active Black' },
      { sku: 'KRZ-AUTO-CHG', quantity: 1, variant: 'Metallic Grey' },
    ],
    couponCode: 'WELCOME10',
    discountAmount: 179,
    shippingFee: 0,
    paymentMethod: 'RAZORPAY',
    paymentStatus: 'PAID',
    status: 'DELIVERED',
    daysAgo: 14,
  },
  {
    orderKey: 'ORD-2026-0002',
    userEmail: 'priya.patel@example.com',
    itemSkus: [
      { sku: 'MAM-ONN-OIL', quantity: 2, variant: '150ml' },
      { sku: 'MAM-VITC-FW', quantity: 1, variant: '100ml' },
      { sku: 'WOW-ACV-SHM', quantity: 1, variant: '300ml' },
    ],
    couponCode: 'SAVE200',
    discountAmount: 200,
    shippingFee: 0,
    paymentMethod: 'WALLET',
    paymentStatus: 'PAID',
    status: 'DELIVERED',
    daysAgo: 12,
  },
  {
    orderKey: 'ORD-2026-0003',
    userEmail: 'rohan.verma@example.com',
    itemSkus: [
      { sku: 'LOGI-MXM-3S', quantity: 1, variant: 'Space Grey' },
      { sku: 'LOGI-K380-GR', quantity: 1, variant: 'Off White' },
    ],
    couponCode: null,
    discountAmount: 0,
    shippingFee: 0,
    paymentMethod: 'RAZORPAY',
    paymentStatus: 'PAID',
    status: 'DELIVERED',
    daysAgo: 10,
  },
  {
    orderKey: 'ORD-2026-0004',
    userEmail: 'vikram.malhotra@example.com',
    itemSkus: [
      { sku: 'LEV-511-DNM', quantity: 1, variant: 'Dark Indigo - 32' },
      { sku: 'LEV-TSH-HM', quantity: 2, variant: 'White / Black - L' },
    ],
    couponCode: 'FASHION15',
    discountAmount: 569,
    shippingFee: 0,
    paymentMethod: 'COD',
    paymentStatus: 'PAID',
    status: 'DELIVERED',
    daysAgo: 8,
  },
  {
    orderKey: 'ORD-2026-0005',
    userEmail: 'neha.gupta@example.com',
    itemSkus: [
      { sku: 'PRS-CKR-3L', quantity: 1, variant: 'Hard Anodized' },
      { sku: 'PGN-KTL-15L', quantity: 1, variant: 'Silver Steel' },
      { sku: 'PGN-CHP-400', quantity: 1, variant: 'Classic Green' },
    ],
    couponCode: 'SAVE200',
    discountAmount: 200,
    shippingFee: 0,
    paymentMethod: 'WALLET',
    paymentStatus: 'PAID',
    status: 'DELIVERED',
    daysAgo: 7,
  },
  {
    orderKey: 'ORD-2026-0006',
    userEmail: 'aditya.joshi@example.com',
    itemSkus: [
      { sku: 'NKE-AM-SC', quantity: 1, variant: 'White/Black - UK 9' },
      { sku: 'NKE-BTL-24Z', quantity: 1, variant: 'Anthracite 24oz' },
    ],
    couponCode: null,
    discountAmount: 0,
    shippingFee: 0,
    paymentMethod: 'RAZORPAY',
    paymentStatus: 'PAID',
    status: 'DELIVERED',
    daysAgo: 5,
  },
  {
    orderKey: 'ORD-2026-0007',
    userEmail: 'ananya.iyer@example.com',
    itemSkus: [
      { sku: 'KRZ-COCO-500', quantity: 2, variant: '500ml Glass Jar' },
      { sku: 'KRZ-HNY-500', quantity: 1, variant: '500g Wild Honey' },
      { sku: 'KRZ-ALM-500', quantity: 1, variant: '500g Raw Badam' },
    ],
    couponCode: 'FREESHIP',
    discountAmount: 0,
    shippingFee: 0,
    paymentMethod: 'COD',
    paymentStatus: 'PAID',
    status: 'DELIVERED',
    daysAgo: 4,
  },

  // -------------------------------------------------------------------------
  // SHIPPED ORDERS (Orders 8 to 11)
  // -------------------------------------------------------------------------
  {
    orderKey: 'ORD-2026-0008',
    userEmail: 'aarav.sharma@example.com',
    itemSkus: [
      { sku: 'JBL-FLIP-6', quantity: 1, variant: 'Midnight Black' },
    ],
    couponCode: 'ELECTRO10',
    discountAmount: 1000,
    shippingFee: 0,
    paymentMethod: 'RAZORPAY',
    paymentStatus: 'PAID',
    status: 'SHIPPED',
    daysAgo: 3,
  },
  {
    orderKey: 'ORD-2026-0009',
    userEmail: 'priya.patel@example.com',
    itemSkus: [
      { sku: 'PUM-SMH-V2', quantity: 1, variant: 'Puma White - UK 6' },
      { sku: 'PUM-DFL-35L', quantity: 1, variant: 'Black / Rose Gold' },
    ],
    couponCode: 'SAVE200',
    discountAmount: 200,
    shippingFee: 0,
    paymentMethod: 'WALLET',
    paymentStatus: 'PAID',
    status: 'SHIPPED',
    daysAgo: 2,
  },
  {
    orderKey: 'ORD-2026-0010',
    userEmail: 'rohan.verma@example.com',
    itemSkus: [
      { sku: 'NOISE-PULSE-2M', quantity: 1, variant: 'Jet Black' },
      { sku: 'BOAT-PB-20K', quantity: 1, variant: 'Carbon Black' },
    ],
    couponCode: null,
    discountAmount: 0,
    shippingFee: 0,
    paymentMethod: 'COD',
    paymentStatus: 'PENDING',
    status: 'SHIPPED',
    daysAgo: 2,
  },
  {
    orderKey: 'ORD-2026-0011',
    userEmail: 'vikram.malhotra@example.com',
    itemSkus: [
      { sku: 'KRZ-CMF-DBL', quantity: 1, variant: 'Navy Blue / Grey' },
      { sku: 'KRZ-SHT-KNG', quantity: 1, variant: 'Ivory White 300TC' },
    ],
    couponCode: 'SAVE200',
    discountAmount: 200,
    shippingFee: 0,
    paymentMethod: 'RAZORPAY',
    paymentStatus: 'PAID',
    status: 'SHIPPED',
    daysAgo: 1,
  },

  // -------------------------------------------------------------------------
  // PROCESSING ORDERS (Orders 12 to 15)
  // -------------------------------------------------------------------------
  {
    orderKey: 'ORD-2026-0012',
    userEmail: 'neha.gupta@example.com',
    itemSkus: [
      { sku: 'PHI-TRM-3000', quantity: 1, variant: 'Series 3000' },
      { sku: 'PHI-BLB-9W', quantity: 2, variant: 'Tunable White B22' },
    ],
    couponCode: null,
    discountAmount: 0,
    shippingFee: 0,
    paymentMethod: 'WALLET',
    paymentStatus: 'PAID',
    status: 'PROCESSING',
    daysAgo: 1,
  },
  {
    orderKey: 'ORD-2026-0013',
    userEmail: 'aditya.joshi@example.com',
    itemSkus: [
      { sku: 'ADI-TRE-HD', quantity: 1, variant: 'Collegiate Navy - L' },
      { sku: 'ADI-SHR-3S', quantity: 1, variant: 'Black - L' },
    ],
    couponCode: 'FASHION15',
    discountAmount: 600,
    shippingFee: 0,
    paymentMethod: 'RAZORPAY',
    paymentStatus: 'PAID',
    status: 'PROCESSING',
    daysAgo: 1,
  },
  {
    orderKey: 'ORD-2026-0014',
    userEmail: 'aarav.sharma@example.com',
    itemSkus: [
      { sku: 'PRS-MXG-750', quantity: 1, variant: 'Black & Gold' },
    ],
    couponCode: 'SAVE200',
    discountAmount: 200,
    shippingFee: 0,
    paymentMethod: 'COD',
    paymentStatus: 'PENDING',
    status: 'PROCESSING',
    daysAgo: 0.5,
  },
  {
    orderKey: 'ORD-2026-0015',
    userEmail: 'ananya.iyer@example.com',
    itemSkus: [
      { sku: 'KRZ-TOY-BLK', quantity: 1, variant: '100 Pcs Solid Wood' },
      { sku: 'KRZ-PZL-1000', quantity: 1, variant: 'World Map 1000 Pcs' },
    ],
    couponCode: 'FIRSTORDER',
    discountAmount: 209,
    shippingFee: 0,
    paymentMethod: 'COD',
    paymentStatus: 'PENDING',
    status: 'PROCESSING',
    daysAgo: 0.4,
  },

  // -------------------------------------------------------------------------
  // PENDING ORDERS (Orders 16 to 18)
  // -------------------------------------------------------------------------
  {
    orderKey: 'ORD-2026-0016',
    userEmail: 'rohan.verma@example.com',
    itemSkus: [
      { sku: 'SONY-WH-XM5', quantity: 1, variant: 'Silver' },
    ],
    couponCode: 'ELECTRO10',
    discountAmount: 1500,
    shippingFee: 0,
    paymentMethod: 'RAZORPAY',
    paymentStatus: 'PENDING',
    status: 'PENDING',
    daysAgo: 0.2,
  },
  {
    orderKey: 'ORD-2026-0017',
    userEmail: 'vikram.malhotra@example.com',
    itemSkus: [
      { sku: 'KRZ-YGA-MAT', quantity: 1, variant: 'Dual Purple 6mm' },
      { sku: 'KRZ-RST-SET', quantity: 1, variant: '5-Band Set' },
    ],
    couponCode: null,
    discountAmount: 0,
    shippingFee: 49,
    paymentMethod: 'COD',
    paymentStatus: 'PENDING',
    status: 'PENDING',
    daysAgo: 0.1,
  },
  {
    orderKey: 'ORD-2026-0018',
    userEmail: 'priya.patel@example.com',
    itemSkus: [
      { sku: 'KRZ-SFR-1G', quantity: 1, variant: '1g Sealed Jar' },
      { sku: 'KRZ-CSH-250', quantity: 1, variant: '250g Goa Jumbo' },
    ],
    couponCode: 'MEGA50',
    discountAmount: 150,
    shippingFee: 0,
    paymentMethod: 'WALLET',
    paymentStatus: 'PAID',
    status: 'PENDING',
    daysAgo: 0.05,
  },

  // -------------------------------------------------------------------------
  // CANCELLED ORDERS (Orders 19 to 20)
  // -------------------------------------------------------------------------
  {
    orderKey: 'ORD-2026-0019',
    userEmail: 'aditya.joshi@example.com',
    itemSkus: [
      { sku: 'RDS-JKT-DNM', quantity: 1, variant: 'Washed Blue - M' },
    ],
    couponCode: null,
    discountAmount: 0,
    shippingFee: 49,
    paymentMethod: 'COD',
    paymentStatus: 'PENDING',
    status: 'CANCELLED',
    daysAgo: 6,
  },
  {
    orderKey: 'ORD-2026-0020',
    userEmail: 'neha.gupta@example.com',
    itemSkus: [
      { sku: 'KRZ-VAC-CAR', quantity: 1, variant: '12V High Power' },
    ],
    couponCode: 'SAVE200',
    discountAmount: 200,
    shippingFee: 0,
    paymentMethod: 'WALLET',
    paymentStatus: 'REFUNDED',
    status: 'CANCELLED',
    daysAgo: 9,
  },
];

// 60 Realistic, Authentic Reviews linked to Delivered Orders
const SEED_REVIEWS = [
  // -------------------------------------------------------------------------
  // Order 1 Products (Aarav Sharma)
  // -------------------------------------------------------------------------
  {
    orderKey: 'ORD-2026-0001',
    userEmail: 'aarav.sharma@example.com',
    productSku: 'BOAT-AIR-141',
    rating: 5,
    reviewText: 'Outstanding battery life! Lasts 3-4 days easily on a single charge with heavy commute usage. Bass is super punchy and calls are clear.',
    photos: ['https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop&q=80'],
  },
  {
    orderKey: 'ORD-2026-0001',
    userEmail: 'aarav.sharma@example.com',
    productSku: 'KRZ-AUTO-CHG',
    rating: 5,
    reviewText: 'Solid metal build and fast charges my iPhone 14 via Type-C PD while keeping cool. The blue ring light is subtle and looks classy at night.',
    photos: [],
  },

  // -------------------------------------------------------------------------
  // Order 2 Products (Priya Patel)
  // -------------------------------------------------------------------------
  {
    orderKey: 'ORD-2026-0002',
    userEmail: 'priya.patel@example.com',
    productSku: 'MAM-ONN-OIL',
    rating: 4,
    reviewText: 'Noticeable reduction in hair fall after 3 weeks of consistent use twice a week. Pleasant fragrance, not like raw onion at all!',
    photos: ['https://images.unsplash.com/photo-1608248597359-52e04313f8c8?w=600&auto=format&fit=crop&q=80'],
  },
  {
    orderKey: 'ORD-2026-0002',
    userEmail: 'priya.patel@example.com',
    productSku: 'MAM-VITC-FW',
    rating: 4,
    reviewText: 'Very refreshing face wash. Leaves skin bright and oil-free without stripping away moisture. Great for daily morning use.',
    photos: [],
  },
  {
    orderKey: 'ORD-2026-0002',
    userEmail: 'priya.patel@example.com',
    productSku: 'WOW-ACV-SHM',
    rating: 5,
    reviewText: 'Completely cleared up product buildup and mild dandruff. Hair feels soft, bouncy, and squeaky clean. Highly recommend paired with conditioner.',
    photos: ['https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=600&auto=format&fit=crop&q=80'],
  },

  // -------------------------------------------------------------------------
  // Order 3 Products (Rohan Verma)
  // -------------------------------------------------------------------------
  {
    orderKey: 'ORD-2026-0003',
    userEmail: 'rohan.verma@example.com',
    productSku: 'LOGI-MXM-3S',
    rating: 5,
    reviewText: 'The holy grail of productivity mice. The quiet clicks are so satisfying in an office and the MagSpeed scroll wheel is legendary.',
    photos: ['https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=600&auto=format&fit=crop&q=80'],
  },
  {
    orderKey: 'ORD-2026-0003',
    userEmail: 'rohan.verma@example.com',
    productSku: 'LOGI-K380-GR',
    rating: 4,
    reviewText: 'Switches seamlessly between my Mac and iPad. Key travel is soft and tactile. Great battery life.',
    photos: [],
  },

  // -------------------------------------------------------------------------
  // Order 4 Products (Vikram Malhotra)
  // -------------------------------------------------------------------------
  {
    orderKey: 'ORD-2026-0004',
    userEmail: 'vikram.malhotra@example.com',
    productSku: 'LEV-511-DNM',
    rating: 5,
    reviewText: 'Authentic Levi’s quality. The 511 slim cut is neither too tight nor baggy, just the right stretch for all-day comfort.',
    photos: ['https://images.unsplash.com/photo-1542272604-780c96856592?w=600&auto=format&fit=crop&q=80'],
  },
  {
    orderKey: 'ORD-2026-0004',
    userEmail: 'vikram.malhotra@example.com',
    productSku: 'LEV-TSH-HM',
    rating: 4,
    reviewText: 'High quality combed cotton. Washed twice so far, no shrinkage or color fading on the logo.',
    photos: [],
  },

  // -------------------------------------------------------------------------
  // Order 5 Products (Neha Gupta)
  // -------------------------------------------------------------------------
  {
    orderKey: 'ORD-2026-0005',
    userEmail: 'neha.gupta@example.com',
    productSku: 'PRS-CKR-3L',
    rating: 5,
    reviewText: 'The spillage control deep lid really works! No more messy dal froth all over the gas stove. Perfect 3L size for small families.',
    photos: ['https://images.unsplash.com/photo-1584990347449-389f4170668b?w=600&auto=format&fit=crop&q=80'],
  },
  {
    orderKey: 'ORD-2026-0005',
    userEmail: 'neha.gupta@example.com',
    productSku: 'PGN-KTL-15L',
    rating: 4,
    reviewText: 'Heats water super fast in under 2 minutes. The auto cut-off gives complete peace of mind. Very economical.',
    photos: [],
  },
  {
    orderKey: 'ORD-2026-0005',
    userEmail: 'neha.gupta@example.com',
    productSku: 'PGN-CHP-400',
    rating: 5,
    reviewText: 'Must-have in every Indian kitchen. Chops 2 onions finely with just 5-6 quick pulls without any teary eyes!',
    photos: [],
  },

  // -------------------------------------------------------------------------
  // Order 6 Products (Aditya Joshi)
  // -------------------------------------------------------------------------
  {
    orderKey: 'ORD-2026-0006',
    userEmail: 'aditya.joshi@example.com',
    productSku: 'NKE-AM-SC',
    rating: 5,
    reviewText: 'Classic Air Max silhouette. Extremely comfortable for daily walks and college wear. Fits true to size with good arch support.',
    photos: ['https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80'],
  },
  {
    orderKey: 'ORD-2026-0006',
    userEmail: 'aditya.joshi@example.com',
    productSku: 'NKE-BTL-24Z',
    rating: 4,
    reviewText: 'Durable and completely leak-proof in my gym backpack. The chug cap is quick and convenient during workouts.',
    photos: [],
  },

  // -------------------------------------------------------------------------
  // Order 7 Products (Ananya Iyer)
  // -------------------------------------------------------------------------
  {
    orderKey: 'ORD-2026-0007',
    userEmail: 'ananya.iyer@example.com',
    productSku: 'KRZ-COCO-500',
    rating: 5,
    reviewText: 'Fresh natural coconut aroma! You can tell it is genuinely cold-pressed. Works wonders as a natural body moisturizer and in cooking.',
    photos: ['https://images.unsplash.com/photo-1601004890684-d8cbf643f5f2?w=600&auto=format&fit=crop&q=80'],
  },
  {
    orderKey: 'ORD-2026-0007',
    userEmail: 'ananya.iyer@example.com',
    productSku: 'KRZ-HNY-500',
    rating: 4,
    reviewText: 'Thick, raw honey with distinct floral notes. Much better quality than regular commercial supermarket brands.',
    photos: [],
  },
  {
    orderKey: 'ORD-2026-0007',
    userEmail: 'ananya.iyer@example.com',
    productSku: 'KRZ-ALM-500',
    rating: 4,
    reviewText: 'Very crunchy and uniform size badam. Zero bitter nuts in the entire 500g pouch. Packaging was vacuum sealed.',
    photos: [],
  },

  // -------------------------------------------------------------------------
  // Additional reviews across popular products to reach ~60 verified reviews
  // -------------------------------------------------------------------------
  // Electronics
  {
    orderKey: 'ORD-2026-0001',
    userEmail: 'priya.patel@example.com',
    productSku: 'BOAT-ROC-550',
    rating: 4,
    reviewText: 'Bass is heavy and deep. Ear cups are soft and comfortable even after 3 hours of listening.',
    photos: [],
  },
  {
    orderKey: 'ORD-2026-0001',
    userEmail: 'rohan.verma@example.com',
    productSku: 'JBL-FLIP-6',
    rating: 5,
    reviewText: 'Incredible sound clarity for its compact size. Perfect for pool parties and camping trips with IP67 waterproofing.',
    photos: ['https://images.unsplash.com/photo-1545454675-3531b543be5d?w=600&auto=format&fit=crop&q=80'],
  },
  {
    orderKey: 'ORD-2026-0001',
    userEmail: 'vikram.malhotra@example.com',
    productSku: 'JBL-T760NC',
    rating: 4,
    reviewText: 'Noise cancellation cuts out ambient engine rumble during flights and Metro rides quite effectively. Pure bass mode is awesome.',
    photos: [],
  },
  {
    orderKey: 'ORD-2026-0001',
    userEmail: 'neha.gupta@example.com',
    productSku: 'SONY-WH-XM5',
    rating: 5,
    reviewText: 'Unbelievable noise cancelling! Once you put these on, the world literally goes on mute. Mic quality during office Zoom calls is pristine.',
    photos: ['https://images.unsplash.com/photo-1583394838336-acd977736f90?w=600&auto=format&fit=crop&q=80'],
  },
  {
    orderKey: 'ORD-2026-0001',
    userEmail: 'aditya.joshi@example.com',
    productSku: 'SONY-WF-C500',
    rating: 4,
    reviewText: 'Crisp instrument separation. Fits comfortably in smaller ears without falling out during jogs.',
    photos: [],
  },
  {
    orderKey: 'ORD-2026-0001',
    userEmail: 'ananya.iyer@example.com',
    productSku: 'NOISE-PULSE-2M',
    rating: 4,
    reviewText: 'Big bright display that is easily readable under bright direct sunlight. Bluetooth calling speaker is surprisingly loud.',
    photos: [],
  },
  {
    orderKey: 'ORD-2026-0002',
    userEmail: 'aarav.sharma@example.com',
    productSku: 'NOISE-DIVA-GLD',
    rating: 5,
    reviewText: 'Gifted to my sister for her birthday. She loved the diamond-cut bezel and the metallic mesh strap. Looks very premium.',
    photos: [],
  },
  {
    orderKey: 'ORD-2026-0002',
    userEmail: 'rohan.verma@example.com',
    productSku: 'PHI-TAB-4218',
    rating: 4,
    reviewText: 'Transformed our TV audio experience. Dialogue clarity is crisp and the subwoofer provides punchy movie cinema vibes.',
    photos: [],
  },
  {
    orderKey: 'ORD-2026-0002',
    userEmail: 'vikram.malhotra@example.com',
    productSku: 'BOAT-WAVE-2',
    rating: 3,
    reviewText: 'Decent smartwatch for the price point. Battery lasts around 4-5 days with calling enabled.',
    photos: [],
  },

  // Mobiles
  {
    orderKey: 'ORD-2026-0003',
    userEmail: 'aarav.sharma@example.com',
    productSku: 'SAM-S23-128',
    rating: 5,
    reviewText: 'The compact flagship we all wanted. Gorgeous 120Hz AMOLED, blazing fast Snapdragon 8 Gen 2, and low-light camera photos are stellar.',
    photos: ['https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=600&auto=format&fit=crop&q=80'],
  },
  {
    orderKey: 'ORD-2026-0003',
    userEmail: 'priya.patel@example.com',
    productSku: 'APL-IPH14-128',
    rating: 5,
    reviewText: 'Smooth iOS experience, phenomenal video recording stabilization, and battery easily lasts all day on 5G.',
    photos: ['https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=600&auto=format&fit=crop&q=80'],
  },
  {
    orderKey: 'ORD-2026-0003',
    userEmail: 'aditya.joshi@example.com',
    productSku: 'OP-11R-256',
    rating: 4,
    reviewText: '100W charging is mind blowing — zero to full in less than 25 minutes! Display is smooth and gaming performance is top notch.',
    photos: [],
  },
  {
    orderKey: 'ORD-2026-0003',
    userEmail: 'neha.gupta@example.com',
    productSku: 'MI-13PRO-256',
    rating: 5,
    reviewText: 'The 1-inch Leica sensor produces true DSLR-level natural bokeh in portraits. Premium ceramic back feels luxurious in hand.',
    photos: [],
  },
  {
    orderKey: 'ORD-2026-0004',
    userEmail: 'aarav.sharma@example.com',
    productSku: 'SAM-M34-128',
    rating: 4,
    reviewText: '6000mAh battery is an absolute beast! Lasts nearly 2 full days between charges. Display is vibrant.',
    photos: [],
  },
  {
    orderKey: 'ORD-2026-0004',
    userEmail: 'priya.patel@example.com',
    productSku: 'MI-RN12-128',
    rating: 4,
    reviewText: 'Great budget 5G phone with AMOLED screen. Fast enough for daily multi-tasking and social media apps.',
    photos: [],
  },
  {
    orderKey: 'ORD-2026-0004',
    userEmail: 'rohan.verma@example.com',
    productSku: 'APL-20W-ADP',
    rating: 5,
    reviewText: 'Original Apple charger. Fast charges iPhone from 20% to 75% in about 30 minutes without overheating.',
    photos: [],
  },
  {
    orderKey: 'ORD-2026-0004',
    userEmail: 'aditya.joshi@example.com',
    productSku: 'BOAT-PB-20K',
    rating: 4,
    reviewText: 'Heavy capacity power bank, charged my phone 4 times on a weekend trip. Two-way fast charging works nicely.',
    photos: [],
  },

  // Computers
  {
    orderKey: 'ORD-2026-0005',
    userEmail: 'aarav.sharma@example.com',
    productSku: 'HP-PAV-15',
    rating: 4,
    reviewText: 'Solid work laptop. Ryzen 5 handles coding IDEs and 20+ browser tabs with ease. B&O speakers are loud and clear.',
    photos: [],
  },
  {
    orderKey: 'ORD-2026-0005',
    userEmail: 'priya.patel@example.com',
    productSku: 'LEN-IP3-I5',
    rating: 4,
    reviewText: 'Lightweight and portable. 12th gen i5 is snappy and boot time is under 8 seconds thanks to the NVMe SSD.',
    photos: [],
  },
  {
    orderKey: 'ORD-2026-0005',
    userEmail: 'rohan.verma@example.com',
    productSku: 'APL-MBA-M2',
    rating: 5,
    reviewText: 'Best laptop on the market hands down. Incredible silent fanless performance and battery easily lasts 15-16 hours.',
    photos: ['https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&auto=format&fit=crop&q=80'],
  },
  {
    orderKey: 'ORD-2026-0005',
    userEmail: 'aditya.joshi@example.com',
    productSku: 'HP-M200-WL',
    rating: 4,
    reviewText: 'Simple, no-nonsense wireless mouse. Good ergonomic grip and glides smoothly on mousepads.',
    photos: [],
  },
  {
    orderKey: 'ORD-2026-0005',
    userEmail: 'vikram.malhotra@example.com',
    productSku: 'LEN-MON-24',
    rating: 4,
    reviewText: 'Sleek bezels and sharp 1080p IPS panel. The 75Hz refresh rate makes scrolling through spreadsheets very smooth.',
    photos: [],
  },

  // Fashion
  {
    orderKey: 'ORD-2026-0006',
    userEmail: 'priya.patel@example.com',
    productSku: 'PUM-JOG-BLK',
    rating: 4,
    reviewText: 'Super soft french terry fabric. Great fit around the calves with clean ribbed cuffs.',
    photos: [],
  },
  {
    orderKey: 'ORD-2026-0006',
    userEmail: 'rohan.verma@example.com',
    productSku: 'PUM-DRY-TSH',
    rating: 4,
    reviewText: 'Breathable workout tee. Dries quickly even during intense cardio sessions.',
    photos: [],
  },
  {
    orderKey: 'ORD-2026-0006',
    userEmail: 'vikram.malhotra@example.com',
    productSku: 'RDS-JKT-DNM',
    rating: 4,
    reviewText: 'Rugged washed denim look. Heavy cotton denim that feels durable and pairs well with white sneakers.',
    photos: [],
  },
  {
    orderKey: 'ORD-2026-0006',
    userEmail: 'ananya.iyer@example.com',
    productSku: 'RDS-SHT-CHK',
    rating: 3,
    reviewText: 'Comfortable checked cotton shirt. Slightly relaxed fit, good for weekend casual wear.',
    photos: [],
  },
  {
    orderKey: 'ORD-2026-0006',
    userEmail: 'aarav.sharma@example.com',
    productSku: 'ADI-TRE-HD',
    rating: 5,
    reviewText: 'Iconic Adidas hoodie! Heavyweight fleece keeps warm and the oversized Trefoil looks timeless.',
    photos: [],
  },
  {
    orderKey: 'ORD-2026-0006',
    userEmail: 'neha.gupta@example.com',
    productSku: 'NKE-CLB-CRW',
    rating: 5,
    reviewText: 'Classic Nike crewneck. High quality fleece lining that stays soft even after machine washes.',
    photos: [],
  },

  // Footwear
  {
    orderKey: 'ORD-2026-0007',
    userEmail: 'rohan.verma@example.com',
    productSku: 'NKE-REV-6',
    rating: 4,
    reviewText: 'Very comfortable daily running shoe. Good shock absorption for road jogging.',
    photos: [],
  },
  {
    orderKey: 'ORD-2026-0007',
    userEmail: 'vikram.malhotra@example.com',
    productSku: 'PUM-SMH-V2',
    rating: 4,
    reviewText: 'Clean minimalist white leather sneakers. SoftFoam footbed feels great underfoot.',
    photos: [],
  },
  {
    orderKey: 'ORD-2026-0007',
    userEmail: 'aditya.joshi@example.com',
    productSku: 'ADI-UB-LGT',
    rating: 5,
    reviewText: 'Ultraboost never disappoints. The energy return while running is unparalleled and the Primeknit upper fits like a glove.',
    photos: ['https://images.unsplash.com/photo-1587563871167-1ee9c731aefb?w=600&auto=format&fit=crop&q=80'],
  },
  {
    orderKey: 'ORD-2026-0007',
    userEmail: 'aarav.sharma@example.com',
    productSku: 'ADI-GC-2',
    rating: 4,
    reviewText: 'Classic 3-stripes court sneakers. Go well with both jeans and shorts.',
    photos: [],
  },
  {
    orderKey: 'ORD-2026-0007',
    userEmail: 'neha.gupta@example.com',
    productSku: 'ADI-ADL-SLD',
    rating: 5,
    reviewText: 'The softest slides I have ever owned. Cloudfoam footbed relieves tired feet instantly after gym.',
    photos: [],
  },

  // Beauty & Grooming
  {
    orderKey: 'ORD-2026-0001',
    userEmail: 'ananya.iyer@example.com',
    productSku: 'MAM-UBT-SCB',
    rating: 4,
    reviewText: 'Gentle scrub particles that don’t scratch the skin. Gives a fresh glow after tanning.',
    photos: [],
  },
  {
    orderKey: 'ORD-2026-0002',
    userEmail: 'ananya.iyer@example.com',
    productSku: 'WOW-VITC-SRM',
    rating: 4,
    reviewText: 'Helped fade minor acne dark spots over 4 weeks. Absorbs fast without stickiness.',
    photos: [],
  },
  {
    orderKey: 'ORD-2026-0003',
    userEmail: 'vikram.malhotra@example.com',
    productSku: 'PHI-TRM-3000',
    rating: 5,
    reviewText: 'Smooth trimming without skin pinching. Battery easily lasts 3-4 trims per charge. Very ergonomic.',
    photos: [],
  },
  {
    orderKey: 'ORD-2026-0004',
    userEmail: 'priya.patel@example.com',
    productSku: 'PHI-STR-KER',
    rating: 4,
    reviewText: 'Heats up in 1 minute. Keratin plates glide smoothly through thick hair without pulling.',
    photos: [],
  },

  // Home & Kitchen
  {
    orderKey: 'ORD-2026-0005',
    userEmail: 'aarav.sharma@example.com',
    productSku: 'KRZ-CMF-DBL',
    rating: 5,
    reviewText: 'Incredibly cozy and warm yet lightweight. The microfiber feels like hotel luxury bedding.',
    photos: ['https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=600&auto=format&fit=crop&q=80'],
  },
  {
    orderKey: 'ORD-2026-0006',
    userEmail: 'priya.patel@example.com',
    productSku: 'KRZ-SHT-KNG',
    rating: 4,
    reviewText: 'True king size bedsheet that easily tucks in on 8-inch mattresses. Pure cotton stays cool at night.',
    photos: [],
  },
  {
    orderKey: 'ORD-2026-0007',
    userEmail: 'rohan.verma@example.com',
    productSku: 'PRS-OMG-SET',
    rating: 5,
    reviewText: 'Granite non-stick coating requires very little cooking oil. Heavy base heats evenly across dosa and stir fry.',
    photos: [],
  },
  {
    orderKey: 'ORD-2026-0001',
    userEmail: 'neha.gupta@example.com',
    productSku: 'PHI-AFR-9252',
    rating: 5,
    reviewText: 'Air fryer has made healthy snacking so easy. French fries, samosas and paneer tikka come out crispy with 90% less oil.',
    photos: ['https://images.unsplash.com/photo-1584990347449-389f4170668b?w=600&auto=format&fit=crop&q=80'],
  },
  {
    orderKey: 'ORD-2026-0002',
    userEmail: 'aditya.joshi@example.com',
    productSku: 'HAV-AP-40',
    rating: 4,
    reviewText: 'Real-time air quality indicator changed from red to green in 30 minutes. Noticeable drop in morning dust allergies.',
    photos: [],
  },

  // Fitness, Grocery & Toys
  {
    orderKey: 'ORD-2026-0003',
    userEmail: 'vikram.malhotra@example.com',
    productSku: 'KRZ-YGA-MAT',
    rating: 4,
    reviewText: 'Good 6mm thickness protects knees during workouts. Does not slip or curl up at the edges.',
    photos: [],
  },
  {
    orderKey: 'ORD-2026-0004',
    userEmail: 'rohan.verma@example.com',
    productSku: 'KRZ-DMB-10K',
    rating: 5,
    reviewText: 'Heavy-duty commercial gym quality hex dumbbells. Chrome knurling has great grip.',
    photos: [],
  },
  {
    orderKey: 'ORD-2026-0005',
    userEmail: 'ananya.iyer@example.com',
    productSku: 'KRZ-TOY-BLK',
    rating: 5,
    reviewText: 'My 4-year old toddler spends hours building towers and bridges. Smooth wooden edges with zero splinters.',
    photos: [],
  },
  {
    orderKey: 'ORD-2026-0006',
    userEmail: 'aditya.joshi@example.com',
    productSku: 'KRZ-RC-TRK',
    rating: 5,
    reviewText: 'Fast and tough remote control car! Bounces off grass, gravel and curbs without breaking. Dual battery is great.',
    photos: ['https://images.unsplash.com/photo-1594787318286-3d835c1d207f?w=600&auto=format&fit=crop&q=80'],
  },
  {
    orderKey: 'ORD-2026-0007',
    userEmail: 'priya.patel@example.com',
    productSku: 'KRZ-SFR-1G',
    rating: 5,
    reviewText: 'Pure Kashmiri kesar. Just 3-4 strands gave a deep saffron hue and royal aroma to kheer.',
    photos: [],
  },
  {
    orderKey: 'ORD-2026-0001',
    userEmail: 'aditya.joshi@example.com',
    productSku: 'KRZ-MNT-MAG',
    rating: 4,
    reviewText: 'Magnets are very strong. Holds my phone securely over Mumbai potholes and speed bumps.',
    photos: [],
  },
  {
    orderKey: 'ORD-2026-0002',
    userEmail: 'neha.gupta@example.com',
    productSku: 'KRZ-CHS-MAG',
    rating: 5,
    reviewText: 'Beautiful Sheesham wood craftsmanship. Magnetic pieces stay intact when playing during train journeys.',
    photos: [],
  },
];

// Wishlist seeding data (userEmail -> productSkus)
const SEED_WISHLISTS = [
  {
    userEmail: 'aarav.sharma@example.com',
    skus: ['SONY-WH-XM5', 'SAM-S23-128', 'JBL-FLIP-6', 'NKE-AM-SC'],
  },
  {
    userEmail: 'priya.patel@example.com',
    skus: ['ADI-UB-LGT', 'WOW-VITC-SRM', 'MAM-UBT-SCB'],
  },
  {
    userEmail: 'rohan.verma@example.com',
    skus: ['APL-MBA-M2', 'LOGI-MXM-3S'],
  },
  {
    userEmail: 'ananya.iyer@example.com',
    skus: ['KRZ-CMF-DBL'],
  },
];

// Cart seeding data (userEmail -> items[{ sku, quantity, variant }])
const SEED_CARTS = [
  {
    userEmail: 'aarav.sharma@example.com',
    items: [
      { sku: 'BOAT-AIR-141', quantity: 1, variant: 'Active Black' },
      { sku: 'KRZ-AUTO-CHG', quantity: 1, variant: 'Metallic Grey' },
      { sku: 'LEV-511-DNM', quantity: 1, variant: 'Dark Indigo - 32' },
    ],
  },
  {
    userEmail: 'priya.patel@example.com',
    items: [
      { sku: 'MAM-ONN-OIL', quantity: 2, variant: '150ml' },
      { sku: 'WOW-ACV-SHM', quantity: 1, variant: '300ml' },
    ],
  },
  {
    userEmail: 'rohan.verma@example.com',
    items: [
      { sku: 'LOGI-K380-GR', quantity: 1, variant: 'Off White' },
    ],
  },
];

module.exports = {
  SEED_ORDERS,
  SEED_REVIEWS,
  SEED_WISHLISTS,
  SEED_CARTS,
};

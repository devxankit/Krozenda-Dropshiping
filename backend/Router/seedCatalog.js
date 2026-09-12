const Category = require('../Models/Category');
const Brand = require('../Models/Brand');
const Product = require('../Models/Product');
const Role = require('../Models/Role');
const { ADMIN_PERMISSIONS } = require('../Config/permissions');

const SEED_CATEGORIES = [
  {
    name: 'Electronics & Gadgets',
    image: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=800&auto=format&fit=crop&q=80',
    isActive: true,
    isTopCategory: true,
  },
  {
    name: 'Fashion & Apparel',
    image: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=800&auto=format&fit=crop&q=80',
    isActive: true,
    isTopCategory: true,
  },
  {
    name: 'Home & Living',
    image: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=800&auto=format&fit=crop&q=80',
    isActive: true,
    isTopCategory: false,
  },
  {
    name: 'Footwear & Sneakers',
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop&q=80',
    isActive: true,
    isTopCategory: true,
  },
  {
    name: 'Beauty & Personal Care',
    image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&auto=format&fit=crop&q=80',
    isActive: true,
    isTopCategory: false,
  },
  {
    name: 'Fitness & Outdoors',
    image: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&auto=format&fit=crop&q=80',
    isActive: true,
    isTopCategory: false,
  },
];

const SEED_BRANDS = [
  {
    name: 'Boat',
    logo: '/brands/boat.svg',
    isActive: true,
  },
  {
    name: 'Boat Audio',
    logo: '/brands/boat.svg',
    isActive: true,
  },
  {
    name: 'Philips',
    logo: '/brands/philips.svg',
    isActive: true,
  },
  {
    name: 'Philips Personal Care',
    logo: '/brands/philips.svg',
    isActive: true,
  },
  {
    name: 'Nike',
    logo: '/brands/nike.svg',
    isActive: true,
  },
  {
    name: 'Samsung',
    logo: '/brands/samsung.svg',
    isActive: true,
  },
  {
    name: 'Noise Wearables',
    logo: '/brands/noise.svg',
    isActive: true,
  },
  {
    name: 'Prestige Cookware',
    logo: '/brands/prestige.svg',
    isActive: true,
  },
  {
    name: 'Krozenda Essentials',
    logo: '/brands/krozenda.svg',
    isActive: true,
  },
  {
    name: 'Integration Test Brand',
    logo: '/brands/krozenda.svg',
    isActive: true,
  },
];

const SEED_PRODUCTS = [
  {
    name: 'Wireless ANC Noise Cancelling Headphones',
    categoryName: 'Electronics & Gadgets',
    brandName: 'Boat',
    sku: 'BOAT-ANC-001',
    price: 4999,
    salePrice: 2999,
    discountPercent: 40,
    stock: 45,
    weight: 0.28,
    images: [
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=800&auto=format&fit=crop&q=80',
    ],
    description:
      'High-resolution audio with 40mm drivers, active noise cancellation, ambient sound mode, and up to 40 hours of playtime with rapid USB-C charging.',
    isActive: true,
  },
  {
    name: 'Smart Fitness Tracker Watch Pro',
    categoryName: 'Fitness & Outdoors',
    brandName: 'Philips',
    sku: 'PHIL-WATCH-02',
    price: 6999,
    salePrice: 3499,
    discountPercent: 50,
    stock: 28,
    weight: 0.15,
    images: [
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=800&auto=format&fit=crop&q=80',
    ],
    description:
      'Full-color vibrant AMOLED display with continuous heart rate monitoring, SpO2 sensor, sleep analytics, 5ATM water resistance, and 14 days of battery.',
    isActive: true,
  },
  {
    name: 'UltraBoost Athletic Running Sneakers',
    categoryName: 'Footwear & Sneakers',
    brandName: 'Nike',
    sku: 'NIKE-RUN-03',
    price: 8999,
    salePrice: 5999,
    discountPercent: 33,
    stock: 18,
    weight: 0.72,
    images: [
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=800&auto=format&fit=crop&q=80',
    ],
    description:
      'Engineered knit mesh upper engineered for ultra-light breathability. Responsive foam midsole gives springy rebound for marathons and daily training.',
    isActive: true,
  },
  {
    name: 'Minimalist Matte Ceramic Planter & Vase',
    categoryName: 'Home & Living',
    brandName: 'Krozenda Essentials',
    sku: 'KROZ-DECOR-04',
    price: 1499,
    salePrice: 999,
    discountPercent: 33,
    stock: 60,
    weight: 1.1,
    images: [
      'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?w=800&auto=format&fit=crop&q=80',
    ],
    description:
      'Handcrafted terracotta stoneware finished with a silk matte glaze. Elegant minimalist silhouette designed to accent modern homes and office desks.',
    isActive: true,
  },
  {
    name: 'Organic Botanical Rejuvenating Face Serum',
    categoryName: 'Beauty & Personal Care',
    brandName: 'Krozenda Essentials',
    sku: 'KROZ-SERUM-05',
    price: 1999,
    salePrice: 1299,
    discountPercent: 35,
    stock: 85,
    weight: 0.09,
    images: [
      'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1608248597359-2c7ebba7a840?w=800&auto=format&fit=crop&q=80',
    ],
    description:
      'Formulated with 10% Niacinamide, low molecular weight Hyaluronic Acid, and Centella Asiatica for barrier strengthening, skin hydration, and youthful glow.',
    isActive: true,
  },
  {
    name: 'Ultra-Slim Mechanical Gaming Keyboard RGB',
    categoryName: 'Electronics & Gadgets',
    brandName: 'Samsung',
    sku: 'SAMS-KB-06',
    price: 5499,
    salePrice: 4299,
    discountPercent: 22,
    stock: 12,
    weight: 0.85,
    images: [
      'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=800&auto=format&fit=crop&q=80',
    ],
    description:
      'Low profile tactile switches with hot-swappable sockets, brushed aluminum top plate, customizable per-key RGB backlighting, and 2.4GHz + Bluetooth connectivity.',
    isActive: true,
  },
  {
    name: 'Classic Tailored Linen Casual Shirt',
    categoryName: 'Fashion & Apparel',
    brandName: 'Krozenda Essentials',
    sku: 'KROZ-SHIRT-07',
    price: 2499,
    salePrice: 1699,
    discountPercent: 32,
    stock: 35,
    weight: 0.32,
    images: [
      'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=800&auto=format&fit=crop&q=80',
    ],
    description:
      'Woven from 100% Normandy flax linen. Garment washed for incredible softness right out of the box with relaxed classic collar and tailored fit.',
    isActive: true,
  },
  {
    name: 'Stainless Steel Insulated Thermal Flask (1L)',
    categoryName: 'Fitness & Outdoors',
    brandName: 'Boat',
    sku: 'BOAT-FLASK-08',
    price: 1299,
    salePrice: 799,
    discountPercent: 38,
    stock: 50,
    weight: 0.45,
    images: [
      'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&auto=format&fit=crop&q=80',
    ],
    description:
      'Double-wall vacuum insulation keeps beverages piping hot for 12 hours or refreshingly ice-cold for 24 hours. Food grade 18/8 stainless steel, 100% leak proof.',
    isActive: true,
  },
];

async function seedCatalog() {
  try {
    const categoryMap = {};
    for (const cat of SEED_CATEGORIES) {
      const doc = await Category.findOneAndUpdate(
        { name: cat.name },
        { name: cat.name, image: cat.image, isActive: cat.isActive },
        { upsert: true, new: true }
      );
      categoryMap[cat.name] = doc._id;
    }

    const brandMap = {};
    for (const brand of SEED_BRANDS) {
      const doc = await Brand.findOneAndUpdate(
        { name: brand.name },
        { name: brand.name, logo: brand.logo, isActive: brand.isActive },
        { upsert: true, new: true }
      );
      brandMap[brand.name] = doc._id;
    }

    for (const prod of SEED_PRODUCTS) {
      const categoryId = categoryMap[prod.categoryName];
      const brandId = brandMap[prod.brandName];

      await Product.findOneAndUpdate(
        { sku: prod.sku },
        {
          name: prod.name,
          sku: prod.sku,
          category: categoryId,
          brand: brandId,
          price: prod.price,
          salePrice: prod.salePrice,
          discountPercent: prod.discountPercent,
          stock: prod.stock,
          weight: prod.weight,
          images: prod.images,
          description: prod.description,
          isActive: prod.isActive,
        },
        { upsert: true, new: true }
      );
    }

    // Backfill images for any existing products that currently have no images
    const fallbackProductImages = [
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=800&auto=format&fit=crop&q=80',
    ];

    const productsWithoutImages = await Product.find({
      $or: [{ images: { $size: 0 } }, { images: { $exists: false } }, { images: null }],
    });
    for (let i = 0; i < productsWithoutImages.length; i++) {
      const p = productsWithoutImages[i];
      p.images = [fallbackProductImages[i % fallbackProductImages.length]];
      await p.save();
    }

    // Backfill images for categories without images
    const existingCats = await Category.find({
      $or: [{ image: null }, { image: '' }, { image: { $exists: false } }],
    });
    for (const c of existingCats) {
      const match = SEED_CATEGORIES.find(
        (sc) =>
          sc.name.toLowerCase().includes(c.name.toLowerCase()) ||
          c.name.toLowerCase().includes(sc.name.toLowerCase())
      );
      c.image = match
        ? match.image
        : 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800&auto=format&fit=crop&q=80';
      await c.save();
    }

    // Ensure initial top categories exist
    const topCategoryCount = await Category.countDocuments({ isTopCategory: true });
    if (topCategoryCount === 0) {
      await Category.updateMany(
        {
          $or: [
            { name: { $regex: /electronics/i } },
            { name: { $regex: /fashion/i } },
            { name: { $regex: /footwear/i } },
          ],
        },
        { $set: { isTopCategory: true } }
      );
    }

    // Ensure initial flash sale products exist
    const flashSaleCount = await Product.countDocuments({ isFlashsale: true });
    if (flashSaleCount === 0) {
      const candidates = await Product.find({ isActive: true }).limit(3);
      if (candidates.length > 0) {
        await Product.updateMany(
          { _id: { $in: candidates.map((p) => p._id) } },
          { $set: { isFlashsale: true } }
        );
      }
    }

    // Ensure initial trending products exist
    const trendingCount = await Product.countDocuments({ isTrending: true });
    if (trendingCount === 0) {
      const trendingCandidates = await Product.find({ isActive: true, isFlashsale: { $ne: true } }).limit(4);
      if (trendingCandidates.length > 0) {
        await Product.updateMany(
          { _id: { $in: trendingCandidates.map((p) => p._id) } },
          { $set: { isTrending: true } }
        );
      }
    }

    // Backfill logos for brands without logos
    const existingBrands = await Brand.find({
      $or: [{ logo: null }, { logo: '' }, { logo: { $exists: false } }],
    });
    for (const b of existingBrands) {
      const match = SEED_BRANDS.find(
        (sb) =>
          sb.name.toLowerCase().includes(b.name.toLowerCase()) ||
          b.name.toLowerCase().includes(sb.name.toLowerCase())
      );
      b.logo = match
        ? match.logo
        : 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=800&auto=format&fit=crop&q=80';
      await b.save();
    }

    // Seed default RBAC roles if none exist
    const roleCount = await Role.countDocuments();
    if (roleCount === 0) {
      const defaultRoles = [
        {
          name: 'Super Administrator',
          permissions: [...ADMIN_PERMISSIONS],
          isActive: true,
        },
        {
          name: 'Catalog Manager',
          permissions: [
            'admin.access',
            'admin.dashboard.view',
            'admin.catalog.view',
            'admin.catalog.manage',
            'admin.catalog.approve',
            'admin.catalog.products',
            'admin.catalog.categories',
            'admin.catalog.inventory',
            'admin.catalog.supplier_sync',
          ],
          isActive: true,
        },
        {
          name: 'Order Fulfilment Specialist',
          permissions: [
            'admin.access',
            'admin.dashboard.view',
            'admin.orders.view',
            'admin.orders.manage',
            'admin.orders.list',
            'admin.orders.sub_orders',
            'admin.orders.shipments',
            'admin.returns.manage',
            'admin.orders.invoices',
          ],
          isActive: true,
        },
        {
          name: 'Finance & Accounts Officer',
          permissions: [
            'admin.access',
            'admin.dashboard.view',
            'admin.finance.view',
            'admin.finance.manage',
            'admin.finance.overview',
            'admin.finance.settlements',
            'admin.finance.rules',
            'admin.payout.prepare',
            'admin.accounting.view',
            'admin.tax.export',
          ],
          isActive: true,
        },
        {
          name: 'Customer Support Representative',
          permissions: [
            'admin.access',
            'admin.dashboard.view',
            'admin.orders.view',
            'admin.orders.list',
            'admin.returns.manage',
            'admin.people.view',
            'admin.people.customers',
            'admin.people.support',
          ],
          isActive: true,
        },
        {
          name: 'Marketing & Growth Lead',
          permissions: [
            'admin.access',
            'admin.dashboard.view',
            'admin.marketing.view',
            'admin.marketing.manage',
            'admin.marketing.coupons',
            'admin.marketing.banners',
            'admin.marketing.notifications',
            'admin.marketing.reviews',
          ],
          isActive: true,
        },
      ];

      for (const r of defaultRoles) {
        await Role.create(r);
      }
      console.log(`[SeedCatalog] Seeded ${defaultRoles.length} default RBAC roles.`);
    }

    console.log(
      `[SeedCatalog] Seeded and ensured all catalog items and roles are ready.`
    );
  } catch (error) {
    console.error('[SeedCatalog] Error seeding catalog:', error);
  }
}

module.exports = seedCatalog;

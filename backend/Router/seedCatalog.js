const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

// Models
const Category = require('../Models/Category');
const Brand = require('../Models/Brand');
const Product = require('../Models/Product');
const Banner = require('../Models/Banner');
const Vendor = require('../Models/Vendor');
const Customer = require('../Models/Customer');
const Address = require('../Models/Address');
const Coupon = require('../Models/Coupon');
const Order = require('../Models/Order');
const Review = require('../Models/Review');
const Wishlist = require('../Models/Wishlist');
const Cart = require('../Models/Cart');
const Role = require('../Models/Role');
const { ADMIN_PERMISSIONS } = require('../Config/permissions');

// Seed Datasets
const { SEED_CATEGORIES } = require('./seedData/categories');
const { SEED_BRANDS } = require('./seedData/brands');
const { SEED_PRODUCTS } = require('./seedData/products');
const { SEED_BANNERS } = require('./seedData/banners');
const { SEED_VENDORS } = require('./seedData/vendors');
const { SEED_USERS, SEED_ADDRESSES } = require('./seedData/users');
const { SEED_COUPONS } = require('./seedData/coupons');
const {
  SEED_ORDERS,
  SEED_REVIEWS,
  SEED_WISHLISTS,
  SEED_CARTS,
} = require('./seedData/ordersAndReviews');

async function seedCatalog() {
  console.log('[SeedCatalog] Starting full production-like database seeding...');

  try {
    // =======================================================================
    // 1. SEED CATEGORIES (12 Categories with WebP Assets)
    // =======================================================================
    console.log('[SeedCatalog] Seeding categories...');
    const activeCategoryNames = SEED_CATEGORIES.map((c) => c.name);
    await Category.deleteMany({ name: { $nin: activeCategoryNames } });

    const categoryMap = {};
    for (const cat of SEED_CATEGORIES) {
      const doc = await Category.findOneAndUpdate(
        { name: cat.name },
        {
          $set: {
            name: cat.name,
            image: cat.image,
            isActive: cat.isActive,
            isTopCategory: cat.isTopCategory,
          },
        },
        { upsert: true, new: true }
      );
      categoryMap[cat.name] = doc._id;
    }
    console.log(`[SeedCatalog] Seeded ${Object.keys(categoryMap).length} categories.`);

    // =======================================================================
    // 2. SEED BRANDS (27 Brands)
    // =======================================================================
    console.log('[SeedCatalog] Seeding brands...');
    const brandMap = {};
    for (const brand of SEED_BRANDS) {
      const doc = await Brand.findOneAndUpdate(
        { name: brand.name },
        {
          $set: {
            name: brand.name,
            logo: brand.logo,
            isActive: brand.isActive,
          },
        },
        { upsert: true, new: true }
      );
      brandMap[brand.name] = doc._id;
    }
    console.log(`[SeedCatalog] Seeded ${Object.keys(brandMap).length} brands.`);

    // =======================================================================
    // 3. SEED PRODUCTS (102 Products across 12 Categories)
    // =======================================================================
    console.log('[SeedCatalog] Seeding products...');
    const productMap = {};
    for (const prod of SEED_PRODUCTS) {
      const categoryId = categoryMap[prod.categoryName];
      const brandId = brandMap[prod.brandName] || null;

      if (!categoryId) {
        console.warn(`[SeedCatalog] Category not found for product "${prod.name}" (${prod.categoryName})`);
        continue;
      }

      const doc = await Product.findOneAndUpdate(
        { sku: prod.sku },
        {
          $set: {
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
            isFlashsale: prod.isFlashsale,
            isTrending: prod.isTrending,
          },
        },
        { upsert: true, new: true }
      );
      productMap[prod.sku] = doc;
    }
    console.log(`[SeedCatalog] Seeded ${Object.keys(productMap).length} products.`);

    // Backfill images for any existing products in DB that lack images
    const fallbackProductImages = [
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop&q=80',
    ];
    const productsWithoutImages = await Product.find({
      $or: [{ images: { $size: 0 } }, { images: { $exists: false } }, { images: null }],
    });
    for (let i = 0; i < productsWithoutImages.length; i++) {
      const p = productsWithoutImages[i];
      p.images = [fallbackProductImages[i % fallbackProductImages.length]];
      await p.save();
    }

    // =======================================================================
    // 4. SEED BANNERS (13 Banners: Hero, Promo, Strip with WebP Assets)
    // =======================================================================
    console.log('[SeedCatalog] Seeding banners...');
    const activeBannerTitles = SEED_BANNERS.map((b) => b.title);
    await Banner.deleteMany({ title: { $nin: activeBannerTitles } });

    let bannerCount = 0;
    for (const b of SEED_BANNERS) {
      await Banner.findOneAndUpdate(
        { title: b.title, placement: b.placement },
        {
          $set: {
            title: b.title,
            subtitle: b.subtitle || '',
            tag: b.tag || '',
            icon: b.icon || 'sparkles',
            theme: b.theme || 'blue',
            image: b.image || null,
            placement: b.placement || 'hero',
            ctaPath: b.ctaPath || '',
            status: b.status || 'active',
            isDeleted: false,
          },
        },
        { upsert: true, new: true }
      );
      bannerCount++;
    }
    console.log(`[SeedCatalog] Seeded ${bannerCount} banners.`);

    // =======================================================================
    // 5. SEED VENDORS (10 Indian B2C/B2B Sellers)
    // =======================================================================
    console.log('[SeedCatalog] Seeding vendors...');
    const vendorPasswordHash = await bcrypt.hash('Vendor@123', 10);
    let vendorCount = 0;
    for (const v of SEED_VENDORS) {
      const categoryId = categoryMap[v.categoryName] || null;
      await Vendor.findOneAndUpdate(
        { email: v.email.toLowerCase() },
        {
          $set: {
            vendorType: v.vendorType,
            name: v.name,
            email: v.email.toLowerCase(),
            mobile: v.mobile,
            password: vendorPasswordHash,
            profileImage: v.profileImage,
            category: categoryId,
            gstRegistered: v.gstRegistered,
            business: v.business,
            contactPerson: v.contactPerson,
            address: v.address,
            bank: v.bank,
            verificationStatus: v.verificationStatus,
            isActive: v.isActive,
          },
        },
        { upsert: true, new: true }
      );
      vendorCount++;
    }
    console.log(`[SeedCatalog] Seeded ${vendorCount} vendors.`);

    // =======================================================================
    // 6. SEED USERS (8 Customers)
    // =======================================================================
    console.log('[SeedCatalog] Seeding users...');
    const userPasswordHash = await bcrypt.hash('Customer@123', 10);
    const userMap = {};
    for (const u of SEED_USERS) {
      const doc = await Customer.findOneAndUpdate(
        { email: u.email.toLowerCase() },
        {
          $set: {
            name: u.name,
            email: u.email.toLowerCase(),
            mobileNumber: u.mobileNumber,
            password: userPasswordHash,
            gender: u.gender,
            dob: u.dob,
            walletBalance: u.walletBalance,
            isActive: u.isActive,
            isDeleted: false,
          },
        },
        { upsert: true, new: true }
      );
      userMap[u.email.toLowerCase()] = doc;
    }
    console.log(`[SeedCatalog] Seeded ${Object.keys(userMap).length} users.`);

    // =======================================================================
    // 7. SEED ADDRESSES (12 Addresses)
    // =======================================================================
    console.log('[SeedCatalog] Seeding addresses...');
    const userAddressMap = {};
    let addressCount = 0;
    for (const addr of SEED_ADDRESSES) {
      const user = userMap[addr.userEmail.toLowerCase()];
      if (!user) continue;

      const doc = await Address.findOneAndUpdate(
        { user: user._id, line1: addr.line1 },
        {
          $set: {
            user: user._id,
            type: addr.type,
            fullName: addr.fullName,
            phone: addr.phone,
            line1: addr.line1,
            line2: addr.line2 || '',
            city: addr.city,
            state: addr.state,
            pincode: addr.pincode,
            country: addr.country || 'India',
            isDefault: addr.isDefault,
          },
        },
        { upsert: true, new: true }
      );
      if (addr.isDefault || !userAddressMap[addr.userEmail.toLowerCase()]) {
        userAddressMap[addr.userEmail.toLowerCase()] = doc;
      }
      addressCount++;
    }
    console.log(`[SeedCatalog] Seeded ${addressCount} user addresses.`);

    // =======================================================================
    // 8. SEED COUPONS (8 Coupons)
    // =======================================================================
    console.log('[SeedCatalog] Seeding coupons...');
    let couponCount = 0;
    for (const c of SEED_COUPONS) {
      let resolvedCategoryIds = [];
      if (c.applicableTo === 'CATEGORIES' && c.categoryNames?.length) {
        resolvedCategoryIds = c.categoryNames
          .map((cn) => categoryMap[cn])
          .filter(Boolean);
      }

      await Coupon.findOneAndUpdate(
        { code: c.code.toUpperCase() },
        {
          $set: {
            code: c.code.toUpperCase(),
            description: c.description,
            discountType: c.discountType,
            discountValue: c.discountValue,
            maxDiscountAmount: c.maxDiscountAmount,
            minOrderAmount: c.minOrderAmount,
            usageLimit: c.usageLimit,
            usedCount: c.usedCount,
            perUserLimit: c.perUserLimit,
            applicableTo: c.applicableTo,
            categoryIds: resolvedCategoryIds,
            customerEligibility: c.customerEligibility,
            startDate: c.startDate,
            endDate: c.endDate,
            isActive: c.isActive,
          },
        },
        { upsert: true, new: true }
      );
      couponCount++;
    }
    console.log(`[SeedCatalog] Seeded ${couponCount} coupons.`);

    // =======================================================================
    // 9. SEED ORDERS (20 Orders with Full Status Histories)
    // =======================================================================
    console.log('[SeedCatalog] Seeding orders...');
    const orderMap = {};
    for (const ord of SEED_ORDERS) {
      const user = userMap[ord.userEmail.toLowerCase()];
      if (!user) continue;

      const userAddr = userAddressMap[ord.userEmail.toLowerCase()] || {
        fullName: user.name,
        phone: user.mobileNumber || '9876543210',
        line1: 'Flat 101, Central Avenue',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        country: 'India',
      };

      const items = [];
      for (const item of ord.itemSkus) {
        const prod = productMap[item.sku];
        if (!prod) continue;
        items.push({
          product: prod._id,
          name: prod.name,
          image: prod.images?.[0] || null,
          price: Number(prod.salePrice ?? prod.price),
          quantity: item.quantity,
          variant: item.variant || '',
        });
      }

      if (items.length === 0) continue;

      const subtotal = items.reduce((acc, it) => acc + it.price * it.quantity, 0);
      const discount = Number(ord.discountAmount || 0);
      const shipping = Number(ord.shippingFee || 0);
      const total = Math.max(0, subtotal - discount + shipping);

      // Build realistic chronological status history
      const nowMs = Date.now();
      const baseMs = nowMs - ord.daysAgo * 86400000;
      let statusHistory = [];
      let deliveredAt = null;

      if (ord.status === 'DELIVERED') {
        deliveredAt = new Date(baseMs);
        statusHistory = [
          { status: 'PENDING', at: new Date(baseMs - 3 * 86400000) },
          { status: 'PROCESSING', at: new Date(baseMs - 2 * 86400000) },
          { status: 'SHIPPED', at: new Date(baseMs - 1 * 86400000) },
          { status: 'DELIVERED', at: deliveredAt },
        ];
      } else if (ord.status === 'SHIPPED') {
        statusHistory = [
          { status: 'PENDING', at: new Date(baseMs - 2 * 86400000) },
          { status: 'PROCESSING', at: new Date(baseMs - 1 * 86400000) },
          { status: 'SHIPPED', at: new Date(baseMs) },
        ];
      } else if (ord.status === 'PROCESSING') {
        statusHistory = [
          { status: 'PENDING', at: new Date(baseMs - 1 * 86400000) },
          { status: 'PROCESSING', at: new Date(baseMs) },
        ];
      } else if (ord.status === 'CANCELLED') {
        statusHistory = [
          { status: 'PENDING', at: new Date(baseMs - 1 * 86400000) },
          { status: 'CANCELLED', at: new Date(baseMs) },
        ];
      } else {
        statusHistory = [{ status: 'PENDING', at: new Date(baseMs) }];
      }

      // Upsert order by user and statusHistory initial timestamp
      const existingOrder = await Order.findOne({
        user: user._id,
        'shippingAddress.fullName': userAddr.fullName,
        subtotal: subtotal,
        status: ord.status,
      });

      let orderDoc;
      if (existingOrder) {
        existingOrder.items = items;
        existingOrder.discountAmount = discount;
        existingOrder.couponCode = ord.couponCode;
        existingOrder.shippingFee = shipping;
        existingOrder.total = total;
        existingOrder.paymentMethod = ord.paymentMethod;
        existingOrder.paymentStatus = ord.paymentStatus;
        existingOrder.status = ord.status;
        existingOrder.deliveredAt = deliveredAt;
        existingOrder.statusHistory = statusHistory;
        orderDoc = await existingOrder.save();
      } else {
        orderDoc = await Order.create({
          user: user._id,
          items,
          shippingAddress: {
            fullName: userAddr.fullName,
            phone: userAddr.phone,
            line1: userAddr.line1,
            line2: userAddr.line2 || '',
            city: userAddr.city,
            state: userAddr.state,
            pincode: userAddr.pincode,
            country: userAddr.country || 'India',
          },
          subtotal,
          discountAmount: discount,
          couponCode: ord.couponCode,
          shippingFee: shipping,
          total,
          paymentMethod: ord.paymentMethod,
          paymentStatus: ord.paymentStatus,
          status: ord.status,
          deliveredAt,
          statusHistory,
          createdAt: statusHistory[0].at,
        });
      }

      orderMap[ord.orderKey] = orderDoc;
    }
    console.log(`[SeedCatalog] Seeded ${Object.keys(orderMap).length} orders.`);

    // =======================================================================
    // 10. SEED REVIEWS (60 Verified Reviews)
    // =======================================================================
    console.log('[SeedCatalog] Seeding reviews...');
    let reviewCount = 0;
    // Fallback delivered order for any edge case
    const anyDeliveredOrder = Object.values(orderMap).find((o) => o.status === 'DELIVERED');

    for (const rev of SEED_REVIEWS) {
      const user = userMap[rev.userEmail.toLowerCase()];
      const prod = productMap[rev.productSku];
      const order = orderMap[rev.orderKey] || anyDeliveredOrder;

      if (!user || !prod || !order) continue;

      await Review.findOneAndUpdate(
        { user: user._id, product: prod._id },
        {
          $set: {
            user: user._id,
            product: prod._id,
            order: order._id,
            rating: rev.rating,
            reviewText: rev.reviewText,
            photos: rev.photos || [],
          },
        },
        { upsert: true, new: true }
      );
      reviewCount++;
    }
    console.log(`[SeedCatalog] Seeded ${reviewCount} reviews.`);

    // =======================================================================
    // 11. AGGREGATE PRODUCT RATINGS & REVIEW COUNTS
    // =======================================================================
    console.log('[SeedCatalog] Aggregating product ratings...');
    const reviewStats = await Review.aggregate([
      {
        $group: {
          _id: '$product',
          avgRating: { $avg: '$rating' },
          count: { $sum: 1 },
        },
      },
    ]);

    for (const stat of reviewStats) {
      await Product.findByIdAndUpdate(stat._id, {
        rating: Math.round(stat.avgRating * 10) / 10,
        reviewsCount: stat.count,
      });
    }
    console.log(`[SeedCatalog] Synced ratings for ${reviewStats.length} reviewed products.`);

    // =======================================================================
    // 12. SEED WISHLISTS & CARTS
    // =======================================================================
    console.log('[SeedCatalog] Seeding wishlists and carts...');
    for (const w of SEED_WISHLISTS) {
      const user = userMap[w.userEmail.toLowerCase()];
      if (!user) continue;

      const items = w.skus
        .map((sku) => productMap[sku]?._id)
        .filter(Boolean)
        .map((productId) => ({ product: productId, addedAt: new Date() }));

      await Wishlist.findOneAndUpdate(
        { user: user._id },
        { $set: { user: user._id, items } },
        { upsert: true, new: true }
      );
    }

    for (const c of SEED_CARTS) {
      const user = userMap[c.userEmail.toLowerCase()];
      if (!user) continue;

      const items = c.items
        .map((it) => {
          const prod = productMap[it.sku];
          if (!prod) return null;
          return {
            product: prod._id,
            quantity: it.quantity,
            variant: it.variant || '',
            addedAt: new Date(),
          };
        })
        .filter(Boolean);

      await Cart.findOneAndUpdate(
        { user: user._id },
        { $set: { user: user._id, items } },
        { upsert: true, new: true }
      );
    }
    console.log('[SeedCatalog] Wishlists and carts seeded.');

    // =======================================================================
    // 13. SEED DEFAULT RBAC ROLES (if none exist)
    // =======================================================================
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

    console.log('================================================================');
    console.log('[SeedCatalog] SUCCESS: Entire multi-vendor marketplace seeded!');
    console.log('================================================================');
  } catch (error) {
    console.error('[SeedCatalog] Error seeding catalog:', error);
  }
}

module.exports = seedCatalog;

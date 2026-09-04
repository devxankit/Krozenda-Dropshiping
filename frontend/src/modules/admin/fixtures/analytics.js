// Shapes match schemas/analyticsSchema.js. Money is in PAISE.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug']

export function salesAnalyticsFixture() {
  return {
    kpis: [
      { key: 'revenue', label: 'Net revenue', value: 1246840000, format: 'money', delta: { direction: 'up', label: '12.4%' }, caption: 'August 2026' },
      { key: 'orders', label: 'Orders', value: 8942, format: 'count', delta: { direction: 'up', label: '6.1%' }, caption: '3,204 sub-orders open' },
      { key: 'aov', label: 'Average order value', value: 139400, format: 'money', delta: { direction: 'up', label: '5.9%' }, caption: 'B2B pulls this up' },
      { key: 'refundRate', label: 'Refund rate', value: 2.6, format: 'percent', delta: { direction: 'down', label: '0.4 pt' }, caption: 'of captured value' },
    ],
    revenueTrend: [
      { label: 'Jan', revenue: 720000000, refunds: 24000000 },
      { label: 'Feb', revenue: 810000000, refunds: 27000000 },
      { label: 'Mar', revenue: 890000000, refunds: 31000000 },
      { label: 'Apr', revenue: 970000000, refunds: 29000000 },
      { label: 'May', revenue: 1060000000, refunds: 34000000 },
      { label: 'Jun', revenue: 1160000000, refunds: 36000000 },
      { label: 'Jul', revenue: 1250000000, refunds: 38000000 },
      { label: 'Aug', revenue: 1246840000, refunds: 32400000 },
    ],
    ordersByModel: [
      { label: 'Marketplace', value: 5218 },
      { label: 'Dropshipping', value: 2604 },
      { label: 'Own stock', value: 1120 },
    ],
    topCategories: [
      { label: 'Home & Kitchen', revenue: 384200000, orders: 2841 },
      { label: 'Apparel', revenue: 296400000, orders: 2210 },
      { label: 'Electronics', revenue: 241800000, orders: 986 },
      { label: 'Beauty & Personal Care', revenue: 168900000, orders: 1520 },
      { label: 'Home Décor', revenue: 96400000, orders: 742 },
      { label: 'Grocery & Staples', revenue: 59140000, orders: 643 },
    ],
    paymentMix: [
      { label: 'UPI', value: 5814 },
      { label: 'Credit card', value: 1602 },
      { label: 'Net banking', value: 921 },
      { label: 'Debit card', value: 605 },
    ],
  }
}

export function vendorAnalyticsFixture() {
  return {
    kpis: [
      { key: 'active', label: 'Active sellers', value: 318, format: 'count', delta: { direction: 'up', label: '+9' }, caption: '12 awaiting KYC' },
      { key: 'acceptance', label: 'Acceptance rate', value: 96.2, format: 'percent', delta: { direction: 'up', label: '1.1 pt' }, caption: 'orders accepted by vendors' },
      { key: 'dispatch', label: 'Median dispatch', value: 18.4, format: 'ratio', delta: { direction: 'down', label: '2.3 h' }, caption: 'hours from accept to AWB' },
      { key: 'rto', label: 'RTO rate', value: 1.7, format: 'percent', delta: { direction: 'up', label: '0.2 pt' }, caption: 'of shipped sub-orders' },
    ],
    fulfilmentSpeed: MONTHS.map((label, index) => ({
      label,
      dispatchHours: [26.1, 25.2, 24.0, 22.8, 21.5, 20.4, 19.2, 18.4][index],
      transitDays: [4.6, 4.5, 4.3, 4.2, 4.0, 3.9, 3.8, 3.7][index],
    })),
    vendors: [
      { id: 'slr-2184', name: 'Nova Retail Pvt Ltd', model: 'Marketplace', orders: 1284, revenue: 214600000, acceptanceRate: 98.4, avgDispatchHours: 12.2, rtoRate: 0.9, rating: 4.6 },
      { id: 'slr-1902', name: 'Arya Manufacturing', model: 'Dropshipping', orders: 1102, revenue: 186400000, acceptanceRate: 97.1, avgDispatchHours: 16.8, rtoRate: 1.4, rating: 4.4 },
      { id: 'own-001', name: 'Krozenda Own Stock', model: 'Own stock', orders: 1120, revenue: 156840000, acceptanceRate: 100, avgDispatchHours: 8.4, rtoRate: 0.6, rating: 4.7 },
      { id: 'slr-2077', name: 'Meghna Wholesale', model: 'Dropshipping', orders: 864, revenue: 142900000, acceptanceRate: 94.8, avgDispatchHours: 22.6, rtoRate: 2.1, rating: 4.1 },
      { id: 'slr-1640', name: 'Sunrise Traders', model: 'Marketplace', orders: 742, revenue: 98200000, acceptanceRate: 89.3, avgDispatchHours: 31.4, rtoRate: 4.8, rating: 3.6 },
      { id: 'slr-2410', name: 'Bharat Textiles LLP', model: 'Marketplace', orders: 618, revenue: 86400000, acceptanceRate: 95.6, avgDispatchHours: 19.1, rtoRate: 1.8, rating: 4.3 },
      { id: 'slr-2266', name: 'Kritika Enterprises', model: 'Dropshipping', orders: 504, revenue: 71200000, acceptanceRate: 92.4, avgDispatchHours: 26.9, rtoRate: 3.2, rating: 3.9 },
    ],
  }
}

export function catalogAnalyticsFixture() {
  return {
    kpis: [
      { key: 'live', label: 'Live SKUs', value: 104220, format: 'count', delta: { direction: 'up', label: '2,140' }, caption: 'across 318 sellers' },
      { key: 'pending', label: 'Awaiting approval', value: 34, format: 'count', delta: null, caption: '28 marketplace · 6 dropship' },
      { key: 'sellThrough', label: 'Sell-through', value: 62.8, format: 'percent', delta: { direction: 'up', label: '3.2 pt' }, caption: 'SKUs with a sale this month' },
      { key: 'returnRate', label: 'Return rate', value: 1.1, format: 'percent', delta: { direction: 'down', label: '0.3 pt' }, caption: 'damaged, wrong or missing only' },
    ],
    categoryRevenue: [
      { label: 'Home & Kitchen', revenue: 384200000 },
      { label: 'Apparel', revenue: 296400000 },
      { label: 'Electronics', revenue: 241800000 },
      { label: 'Beauty & Personal Care', revenue: 168900000 },
      { label: 'Home Décor', revenue: 96400000 },
      { label: 'Grocery & Staples', revenue: 59140000 },
    ],
    topProducts: [
      { id: 'prd-1', name: 'Nirvaan Triply Stainless Steel Kadai, 1.2 L', sku: 'KZ-HK-STL-1200', units: 2841, revenue: 34062900, returnRate: 0.7 },
      { id: 'prd-2', name: 'Aarohi Cotton Table Runner, 180 cm', sku: 'KZ-HD-RNR-180', units: 2104, revenue: 18914960, returnRate: 0.4 },
      { id: 'prd-3', name: 'Vayu 1.5 Ton 3-Star Inverter AC', sku: 'KZ-EL-AC-1503', units: 412, revenue: 148320000, returnRate: 2.4 },
      { id: 'prd-4', name: 'Surya Cold-Pressed Groundnut Oil, 5 L', sku: 'KZ-GR-OIL-5000', units: 1862, revenue: 16758000, returnRate: 0.2 },
      { id: 'prd-5', name: 'Meher Handloom Cotton Kurta', sku: 'KZ-AP-KRT-M', units: 1640, revenue: 22960000, returnRate: 3.8 },
    ],
    stockRisk: [
      { id: 'prd-9', name: 'Nirvaan Silicone Spatula Set of 3', sku: 'KZ-HK-SPT-003', onHand: 42, daysCover: 3 },
      { id: 'prd-8', name: 'Aarohi Jute Storage Basket, Large', sku: 'KZ-HD-BSK-LG', onHand: 18, daysCover: 2 },
      { id: 'prd-7', name: 'Vayu Ceiling Fan 1200 mm, BLDC', sku: 'KZ-EL-FAN-1200', onHand: 96, daysCover: 6 },
      { id: 'prd-6', name: 'Surya Turmeric Powder, 500 g', sku: 'KZ-GR-TUR-500', onHand: 240, daysCover: 8 },
    ],
  }
}

export function customerAnalyticsFixture() {
  return {
    kpis: [
      { key: 'total', label: 'Registered buyers', value: 24816, format: 'count', delta: { direction: 'up', label: '1,842' }, caption: '2,104 are B2B' },
      { key: 'repeat', label: 'Repeat rate', value: 38.4, format: 'percent', delta: { direction: 'up', label: '2.6 pt' }, caption: 'two or more orders' },
      { key: 'b2bShare', label: 'B2B share of revenue', value: 44.2, format: 'percent', delta: { direction: 'up', label: '4.1 pt' }, caption: 'dealers, distributors, wholesalers' },
      { key: 'basket', label: 'Items per order', value: 3.2, format: 'ratio', delta: { direction: 'flat', label: '0.0' }, caption: 'B2C 2.1 · B2B 41.6' },
    ],
    acquisition: MONTHS.map((label, index) => ({
      label,
      newBuyers: [1420, 1560, 1680, 1740, 1810, 1920, 2010, 1842][index],
      returningBuyers: [820, 910, 1040, 1160, 1280, 1420, 1560, 1690][index],
    })),
    buyerMix: [
      { label: 'Retail (B2C)', value: 22712 },
      { label: 'Dealer', value: 968 },
      { label: 'Distributor', value: 604 },
      { label: 'Wholesaler', value: 532 },
    ],
    topCities: [
      { label: 'Bengaluru', orders: 1284, revenue: 186400000 },
      { label: 'Mumbai', orders: 1162, revenue: 174200000 },
      { label: 'Delhi NCR', orders: 1048, revenue: 158900000 },
      { label: 'Hyderabad', orders: 812, revenue: 112400000 },
      { label: 'Pune', orders: 704, revenue: 96800000 },
      { label: 'Surat', orders: 486, revenue: 124600000 },
    ],
  }
}

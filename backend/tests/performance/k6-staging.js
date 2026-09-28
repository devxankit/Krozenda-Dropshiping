// k6 script for a STAGING environment (never production, never the shared
// Atlas-backed dev API). Read-only storefront traffic by default; set
// BUYER_TOKEN + ADDRESS_ID to add cart traffic for a disposable test buyer.
//
//   k6 run -e BASE_URL=https://staging-api.example.com tests/performance/k6-staging.js
//   k6 run -e BASE_URL=... -e PROFILE=stress tests/performance/k6-staging.js

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL;
if (!BASE || /krozenda\.(com|in)|atlas|:5000/.test(BASE)) {
  throw new Error('Set BASE_URL to a staging host. Production and the shared dev API are refused.');
}

const PROFILES = {
  smoke: [{ duration: '1m', target: 10 }],
  normal: [{ duration: '2m', target: 50 }, { duration: '5m', target: 50 }, { duration: '1m', target: 0 }],
  heavy: [{ duration: '2m', target: 100 }, { duration: '5m', target: 100 }, { duration: '1m', target: 0 }],
  stress: [{ duration: '2m', target: 100 }, { duration: '2m', target: 200 }, { duration: '2m', target: 300 }, { duration: '2m', target: 0 }],
  spike: [{ duration: '30s', target: 10 }, { duration: '10s', target: 300 }, { duration: '1m', target: 300 }, { duration: '30s', target: 10 }],
  soak: [{ duration: '5m', target: 50 }, { duration: '2h', target: 50 }, { duration: '5m', target: 0 }],
};

export const options = {
  stages: PROFILES[__ENV.PROFILE || 'smoke'],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800', 'p(99)<2000'],
  },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

const TERMS = ['shirt', 'phone', 'shoe', 'bag', 'watch'];

export default function () {
  const list = http.get(`${BASE}/catalog/products?page=${1 + Math.floor(Math.random() * 5)}`, { tags: { name: 'listing' } });
  check(list, { 'listing 200': (r) => r.status === 200 });
  http.get(`${BASE}/catalog/categories`, { tags: { name: 'categories' } });
  http.get(`${BASE}/catalog/products?search=${TERMS[Math.floor(Math.random() * TERMS.length)]}`, { tags: { name: 'search' } });

  const items = list.status === 200 ? list.json('data.items') || [] : [];
  if (items.length) {
    const id = items[Math.floor(Math.random() * items.length)].id;
    check(http.get(`${BASE}/catalog/products/${id}`, { tags: { name: 'detail' } }), { 'detail 200': (r) => r.status === 200 });

    if (__ENV.BUYER_TOKEN) {
      const headers = { Authorization: `Bearer ${__ENV.BUYER_TOKEN}`, 'Content-Type': 'application/json' };
      http.post(`${BASE}/user/cart/items`, JSON.stringify({ productId: id, quantity: 1 }), { headers, tags: { name: 'cart add' } });
      http.get(`${BASE}/user/cart`, { headers, tags: { name: 'cart get' } });
    }
  }
  sleep(1 + Math.random() * 2);
}

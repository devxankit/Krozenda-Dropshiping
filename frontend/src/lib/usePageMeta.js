import { useEffect } from 'react'

// Per-page document metadata.
//
// The app is a single Vite SPA with one static <title>Krozenda</title> in
// index.html, so every product, category and order page shared the same title,
// had no description, no canonical and no Open Graph tags. That is invisible
// to a shopper but it is what a crawler, a link preview in WhatsApp, and the
// browser's own history/tab list all read.
//
// This is client-side metadata: it fixes tab titles, bookmarks, share sheets
// and history, and crawlers that execute JavaScript will see it. It is NOT a
// substitute for server-side rendering if full search-engine indexing of
// product pages becomes a requirement — that is a separate architectural
// decision and is called out in the audit report rather than pretended away.

const DEFAULT_TITLE = 'Krozenda'

function upsertTag(selector, create) {
  let el = document.head.querySelector(selector)
  if (!el) {
    el = create()
    document.head.appendChild(el)
  }
  return el
}

function setMeta(name, content, attr = 'name') {
  if (!content) return
  const el = upsertTag(`meta[${attr}="${name}"]`, () => {
    const node = document.createElement('meta')
    node.setAttribute(attr, name)
    return node
  })
  el.setAttribute('content', content)
}

function setCanonical(href) {
  if (!href) return
  const el = upsertTag('link[rel="canonical"]', () => {
    const node = document.createElement('link')
    node.setAttribute('rel', 'canonical')
    return node
  })
  el.setAttribute('href', href)
}

function setJsonLd(id, data) {
  const existing = document.getElementById(id)
  if (!data) {
    existing?.remove()
    return
  }
  const el =
    existing ||
    (() => {
      const node = document.createElement('script')
      node.type = 'application/ld+json'
      node.id = id
      document.head.appendChild(node)
      return node
    })()
  el.textContent = JSON.stringify(data)
}

export function usePageMeta({
  title,
  description,
  image,
  // Defaults to the current URL with query/hash stripped, which is what
  // deduplicates /app/product/:id?from=search against /app/product/:id.
  canonical,
  noindex = false,
  structuredData = null,
} = {}) {
  useEffect(() => {
    const fullTitle = title ? `${title} | Krozenda` : DEFAULT_TITLE
    document.title = fullTitle

    setMeta('description', description)
    setMeta('robots', noindex ? 'noindex, nofollow' : 'index, follow')

    const url = canonical || `${window.location.origin}${window.location.pathname}`
    setCanonical(url)

    setMeta('og:title', fullTitle, 'property')
    setMeta('og:description', description, 'property')
    setMeta('og:type', structuredData?.['@type'] === 'Product' ? 'product' : 'website', 'property')
    setMeta('og:url', url, 'property')
    setMeta('og:image', image, 'property')

    setMeta('twitter:card', image ? 'summary_large_image' : 'summary')
    setMeta('twitter:title', fullTitle)
    setMeta('twitter:description', description)
    setMeta('twitter:image', image)

    setJsonLd('krozenda-structured-data', structuredData)

    return () => {
      // Structured data is per-page and must not leak into the next screen —
      // a product's Product schema left behind on the cart page is worse than
      // having none at all.
      setJsonLd('krozenda-structured-data', null)
    }
  }, [title, description, image, canonical, noindex, structuredData])
}

// Builds schema.org Product JSON-LD from a product as the API returns it.
// Only emits `offers` when there is a real price and a real availability —
// inventing "InStock" for a product whose stock we do not know is exactly the
// kind of fabricated data the audit forbids.
export function buildProductStructuredData(product, { url, reviewCount, ratingValue } = {}) {
  if (!product) return null

  const price = product.salePrice ?? product.price
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    ...(product.description ? { description: product.description.slice(0, 500) } : {}),
    ...(product.images?.length ? { image: product.images } : {}),
    ...(product.sku ? { sku: product.sku } : {}),
    ...(product.brand?.name ? { brand: { '@type': 'Brand', name: product.brand.name } } : {}),
  }

  if (Number.isFinite(price) && price > 0) {
    data.offers = {
      '@type': 'Offer',
      price: String(price),
      priceCurrency: 'INR',
      availability:
        product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      ...(url ? { url } : {}),
    }
  }

  // Emitted only when reviews genuinely exist. A product with no reviews gets
  // no aggregateRating rather than a fabricated one.
  if (reviewCount > 0 && ratingValue > 0) {
    data.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: String(ratingValue),
      reviewCount: String(reviewCount),
    }
  }

  return data
}

export function buildBreadcrumbStructuredData(crumbs = []) {
  if (crumbs.length === 0) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      ...(crumb.url ? { item: crumb.url } : {}),
    })),
  }
}

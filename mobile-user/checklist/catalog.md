# Catalog area checklist

Status: V = Verified (API shape checked with curl), B = Built, not tested on device.

| Screen / piece | Web route + guard | API calls (shape parsed) | Native replacements | Status |
|---|---|---|---|---|
| CategoryListScreen | /app/categories, public | GET /catalog/categories -> data.items | FlatList 2 cols, pull-to-refresh, BottomNavbar(categories). List/grid switcher is hidden on phones in web: omitted | API V, UI B |
| CatalogBrowseScreen (listing/search) | /app/listing, /app/search, public | GET /catalog/products (params page,limit,sort,search,category,brand,minPrice,maxPrice,rating,inStock,minDiscount,flashSale,trending,source) -> data.items + pagination; GET /catalog/brands; GET /catalog/categories; GET /catalog/products/settings | Filters in route params (useCatalogParams, router.setParams, no history entry per change); filter panel = bottom Sheet; sort select = Sheet; web Pagination ported inline (prev / page-of / next); debounce 400ms search | API V, UI B |
| CatalogFilterPanel / FilterSheet | n/a | settings -> dropshippingEnabled | Sheet, TextInput, custom checkbox | B |
| ProductCard | n/a | none (wishlist store) | Pressable; `style` replaces className; same props product/layout/priority | B |
| CategorySection | n/a | none (static list) | rows of 2 | B |
| ProductDetailScreen | /app/product/:productId, public | GET /catalog/products/:id; /related; /delivery?pincode; GET /user/reviews?productId (existing reviewService); cart store addItem | Gallery dots, variants, bulk table, delivery card, reviews tab, share via RN Share (`${webOrigin}/app/product/id`), scroll to variant picker, pull-to-refresh. Web has no sticky action bar (BottomNavbar only) - same here | API V, UI B |
| DeliveryCheckCard | in PDP | GET /catalog/products/:id/delivery (V) | last PIN in AsyncStorage | API V, UI B |
| CartPageScreen | /app/cart (protected group) | cartStore hydrate/updateQuantity/removeItem | Checkout -> USER_ROUTES.CHECKOUT_ADDRESS | B |
| CartQuantityStepper | in PDP | cartStore.setQuantity | - | B |
| Controllers/services/schemas | - | ported verbatim; useShippingQuoteController uses existing orderService | - | B |

Deviations: filter changes replace route params rather than push history; "Write a Review" goes to `/reviews`; ProductCard 'priority' accepted but unused.
Barcode components not used by these screens: not ported.

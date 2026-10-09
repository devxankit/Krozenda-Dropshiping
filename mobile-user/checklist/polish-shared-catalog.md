# Polish pass: shared UI, home, catalog (not run on a device)

## Shared
- motion.jsx: `usePop` no longer pops on mount (only on later changes); added `fadeOut`.
- SmartImage: new `srcSet` + `displayWidth` props pick the smallest backend derivative (`url 400w, ...`) that covers the display size x device pixel ratio (max 3); falls back to canonical `src`. Loaded flag now tied to the active src (recycled cells no longer skip the placeholder). `cachePolicy="memory-disk"`, 160ms fade.
- Button: PressableScale (scale 0.97) instead of bare Pressable. Sheet: grab handle (sheet variant) + labelled backdrop. ToastHost: slide/fade in+out, live-region role, always mounted so the last toast can exit. BottomNavbar: PressableScale tabs + labels. AsyncBoundary: Error/Empty fade in, retry is PressableScale.

## Per screen
- ProductCard (home, listing, search, related): memo'd, PressableScale card, heart = PressableScale + usePop with 8px hitSlop, srcSet thumbnail (160/96 css px).
- Listing/Search: renderItem/keyExtractor module-level, first 6 cards stagger-enter, FlatList tuned (initialNumToRender 8, maxToRenderPerBatch 8, windowSize 7, removeClippedSubviews), search debounce 350ms (requests already abort via react-query signal), a11y roles/labels on back/clear/filter/chip-remove, Filters button PressableScale.
- Home: product grids enter staggered (first 6), category bar PressableScale, cart badge pop, a11y labels on bell/cart/banner dots/View all.
- Categories: first 6 tiles enter, FlatList tuned, a11y roles.
- Product detail: gallery cross-fades on image change (keyed Animated.View + fadeIn) and uses `imageSrcSets`; Add to Cart is PressableScale with a tinted "Added" state; Buy Now/back/share/cart PressableScale; wishlist heart pop; cart badge pop.
- Cart: lines enter, exit (fade) and re-layout smoothly (`smoothLayout`); thumbnail uses srcSet; stepper buttons get 6px hitSlop; Checkout is PressableScale.
- CartQuantityStepper: number pops on change, buttons PressableScale with tinted background.

## Deliberately skipped
- FlashList v2: listing grid has a header with chips, a half-width spacer item, dimming while refetching and `columnWrapperStyle` gaps; migrating without a device to verify is riskier than the gain. FlatList is tuned instead.
- Controllers/useCatalogParams: audited, already use query signals, shared keys, long staleTime, route-param filters; no change needed.
- CategorySection (static web-ported content), CatalogFilterPanel and DeliveryCheckCard internals: untouched.
- Cart quantity pop in CartPageScreen lines (would need a per-line component).

## Risks / untested
- Reanimated entering/exiting/layout inside FlatList and ScrollView (cart) never run on device; verify no flicker when paging or filtering the grid.
- `removeClippedSubviews` on Android grids: check images do not go blank on fast scroll.
- srcSet parsing assumes the backend format `url Nw, url Nw` (no commas inside URLs).
- ESLint clean on all touched folders.

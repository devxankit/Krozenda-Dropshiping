// Translates the live DOM, so a screen does not have to be rewritten to be
// translatable.
//
// Wrapping every string in the buyer app in `t()` would mean editing ~30
// screens, and it still would not translate the half of the page that matters
// most — product names, category titles, vendor copy, order statuses — because
// those arrive from the API at runtime and are not in the source at all. This
// walks the rendered output instead: whatever is on screen gets translated,
// wherever it came from.
//
// How it stays correct across React re-renders:
//
//   * Every node it touches remembers two things — the English it started
//     from, and the exact string this module last wrote. If the node still
//     holds what we wrote, the source is the remembered English. If it holds
//     something else, React just replaced it and that new value IS the source.
//     So a re-render can never cause a translation to be re-translated.
//   * A MutationObserver catches every re-render, and the re-translation is
//     applied synchronously inside the observer callback — a microtask after
//     React's write and before the browser paints. Cached strings therefore
//     never flash English.
//   * The observer is detached while writing, so the module never reacts to
//     its own edits.

// Never descend into these.
//
// `svg` is deliberately NOT on the list. It was, on the reasoning that the icon
// set renders paths rather than text — true, but it also excluded every chart:
// recharts draws axis labels, legends and tooltips as <text> inside an <svg>,
// and the admin panel is largely charts. Walking an icon costs a visit to two
// empty nodes, which is nothing next to leaving a dashboard half translated.
// An <svg> that genuinely must not be touched — a wordmark, a logotype — takes
// data-no-translate like anything else.
const SKIP_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'TEXTAREA',
  'CODE',
  'PRE',
  'CANVAS',
  'IFRAME',
  'OPTION',
])

// Attributes that reach the buyer as prose. `value` is deliberately absent:
// on an input it is what the buyer typed, and translating that would corrupt
// their own data.
const TRANSLATABLE_ATTRS = ['placeholder', 'title', 'aria-label', 'alt']

const TEXT_KEY = '#text'

// Same rule the API applies: blank strings, numbers, prices, dates and lone
// punctuation come back unchanged anyway, so they are not worth a slot.
const NON_TRANSLATABLE = /^[\s\d\p{P}\p{S}]*$/u

// Order ids, tracking numbers, coupon codes, SKUs — a token with a digit and
// no space in it. Real UI copy containing a number almost always has a space
// somewhere ("2 items", "Save 20%"), so this separates them cleanly, and it
// keeps an order number from being mangled into something unsearchable.
const IDENTIFIER = /^(?=.*\d)\S+$/

function isTranslatable(text) {
  return Boolean(text) && !NON_TRANSLATABLE.test(text) && !IDENTIFIER.test(text)
}

// Leading/trailing whitespace is layout — `{' '}` between inline elements,
// indentation in JSX — and belongs to the document, not to the sentence. It is
// split off before translating and put back after, or words run together.
const EDGES = /^(\s*)([\s\S]*?)(\s*)$/

// Per node, per key: { source, applied }. A WeakMap so a node removed from the
// document takes its entry with it — this can run for a whole session without
// accumulating anything.
const NODE_STATE = new WeakMap()

function slotFor(node, key) {
  let slots = NODE_STATE.get(node)
  if (!slots) {
    slots = Object.create(null)
    NODE_STATE.set(node, slots)
  }
  return slots[key] || (slots[key] = { source: null, applied: null })
}

// The heart of it: decide what the English behind the current value is.
function resolveSource(slot, current) {
  // Still holding what we wrote — so the English is what we remembered.
  if (slot.applied !== null && slot.applied === current) return slot.source
  // React (or anything else) has written here since. Whatever is there now is
  // the new source, and our previous translation is void.
  slot.source = current
  slot.applied = null
  return current
}

function shouldSkip(el) {
  return (
    SKIP_TAGS.has(el.tagName.toUpperCase()) ||
    el.hasAttribute('data-no-translate') ||
    el.getAttribute('translate') === 'no'
  )
}

function collectText(node, items) {
  const current = node.nodeValue
  if (!current) return
  const slot = slotFor(node, TEXT_KEY)
  const source = resolveSource(slot, current)
  const [, prefix, core, suffix] = EDGES.exec(source)
  if (!isTranslatable(core)) return
  items.push({ node, key: TEXT_KEY, slot, core, prefix, suffix })
}

function collectAttrs(el, items) {
  for (const attr of TRANSLATABLE_ATTRS) {
    if (!el.hasAttribute(attr)) continue
    const current = el.getAttribute(attr)
    const slot = slotFor(el, attr)
    const source = resolveSource(slot, current)
    const core = source.trim()
    if (!isTranslatable(core)) continue
    items.push({ node: el, key: attr, slot, core, prefix: '', suffix: '' })
  }
}

function walk(root, items) {
  if (root.nodeType === Node.TEXT_NODE) {
    collectText(root, items)
    return
  }
  if (root.nodeType !== Node.ELEMENT_NODE || shouldSkip(root)) return

  collectAttrs(root, items)

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node.nodeType !== Node.ELEMENT_NODE) return NodeFilter.FILTER_ACCEPT
      // REJECT, not SKIP: it drops the element's whole subtree, which is the
      // point for an <svg> full of paths.
      return shouldSkip(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    },
  })

  let node = walker.nextNode()
  while (node) {
    if (node.nodeType === Node.ELEMENT_NODE) collectAttrs(node, items)
    else collectText(node, items)
    node = walker.nextNode()
  }
}

function write(item, translated) {
  const next = item.prefix + translated + item.suffix
  if (item.key === TEXT_KEY) item.node.nodeValue = next
  else item.node.setAttribute(item.key, next)
  // Back at the source — English was selected, or the API had nothing to
  // offer for this string. Forget that we ever wrote here, so the node counts
  // as pristine next time instead of being rewritten on every pass.
  item.slot.applied = next === item.slot.source ? null : next
}

// Puts every string this module has replaced back to its English source.
// Used when the buyer switches back to English: one pass, then the observer
// can stand down entirely rather than walking the tree forever for nothing.
export function restoreAll(root) {
  const items = []
  walk(root, items)
  for (const item of items) {
    if (item.slot.applied === null) continue
    write(item, item.core)
  }
}

// Starts translating `root` and everything rendered into it from now on.
// Returns a function that stops it. `lookup` answers from cache synchronously
// or returns undefined; `ensure` fetches and resolves once the cache can.
export function startAutoTranslate({ root, lookup, ensure }) {
  const OBSERVE = {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: TRANSLATABLE_ATTRS,
  }

  let stopped = false

  const observer = new MutationObserver((records) => {
    const roots = []
    for (const record of records) {
      // A removal needs nothing — the node is gone, and its slot goes with
      // it. Only what arrived, changed or was re-attributed is worth a walk.
      if (record.type === 'childList') for (const added of record.addedNodes) roots.push(added)
      else roots.push(record.target)
    }
    pass(roots)
  })

  function pass(roots) {
    if (stopped) return

    const items = []
    const seen = new Set()
    for (const root_ of roots) {
      if (!root_ || !root_.isConnected || seen.has(root_)) continue
      seen.add(root_)
      walk(root_, items)
    }
    if (!items.length) return

    const missing = []
    const ready = []
    for (const item of items) {
      const hit = lookup(item.core)
      if (hit === undefined) missing.push(item.core)
      else if (hit !== item.core || item.slot.applied !== null) ready.push([item, hit])
    }

    if (ready.length) {
      // Detached while writing so none of this comes back as a mutation. The
      // window is synchronous, so nothing else can touch the DOM inside it.
      observer.disconnect()
      for (const [item, translated] of ready) write(item, translated)
      if (!stopped) observer.observe(root, OBSERVE)
    }

    if (!missing.length) return

    // Re-scan rather than reusing these item references: by the time the
    // request lands, React may have replaced the very nodes they point at.
    const retryRoots = [...seen]
    ensure(missing).then(() => pass(retryRoots.filter((n) => n.isConnected)))
  }

  // Observe first, then do the opening pass, so the pass's own
  // disconnect/reconnect cycle starts from a consistent state.
  observer.observe(root, OBSERVE)
  pass([root])

  return () => {
    stopped = true
    observer.disconnect()
  }
}

// Regression check for ../autoTranslate.js — `npm run test:i18n`.
//
// A plain node script rather than a test suite: this project has no frontend
// test runner, and the engine imports nothing, so it loads straight into jsdom
// with no build step, no config and no framework. If a real runner arrives
// later, the cases below transfer as-is.
//
// It earns its keep because the engine is the one piece of this feature that
// cannot be checked by reading it: MutationObserver timing, TreeWalker
// filtering and — the case that matters most — never mistaking its own output
// for a fresh English source, which would translate a translation.
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body></body></html>')
for (const key of ['document', 'Node', 'NodeFilter', 'MutationObserver']) {
  globalThis[key] = dom.window[key]
}

const { startAutoTranslate, restoreAll } = await import('../autoTranslate.js')

// --- a fake dictionary + provider -------------------------------------------
const DICT = new Map()
let fetches = 0
const asked = []

const lookup = (text) => DICT.get(text)
const ensure = (texts) => {
  fetches += 1
  asked.push([...texts])
  return Promise.resolve().then(() => {
    for (const t of texts) DICT.set(t, `hi:${t}`)
  })
}

const tick = () => new Promise((r) => setTimeout(r, 0))

let failures = 0
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) console.log(`        expected ${JSON.stringify(expected)}\n        actual   ${JSON.stringify(actual)}`)
}

const body = dom.window.document.body
const $ = (sel) => body.querySelector(sel)

body.innerHTML = `
  <h1 id="title">Privacy Policy</h1>
  <p id="price">₹1,299</p>
  <p id="order">ORD-2024-0011</p>
  <p id="mixed">Save 20% today</p>
  <input id="field" placeholder="Search products" value="typed by the buyer" />
  <svg id="chart"><text id="axis">Revenue</text></svg>
  <svg id="logo" data-no-translate><text>Krozenda</text></svg>
  <span id="skip" data-no-translate>Krozenda</span>
  <p id="spaced">  Add to cart  </p>
  <select id="lang"><option>हिन्दी</option></select>
`

const stop = startAutoTranslate({ root: body, lookup, ensure })
await tick()

check('translates plain copy', $('#title').textContent, 'hi:Privacy Policy')
check('leaves a price alone', $('#price').textContent, '₹1,299')
check('leaves an order id alone', $('#order').textContent, 'ORD-2024-0011')
check('translates copy containing a number', $('#mixed').textContent, 'hi:Save 20% today')
check('translates a placeholder', $('#field').getAttribute('placeholder'), 'hi:Search products')
check('never touches what the buyer typed', $('#field').getAttribute('value'), 'typed by the buyer')
check('translates chart text inside <svg>', $('#axis').textContent, 'hi:Revenue')
check('leaves a wordmark marked data-no-translate', $('#logo text').textContent, 'Krozenda')
check('honours data-no-translate', $('#skip').textContent, 'Krozenda')
check('preserves surrounding whitespace', $('#spaced').textContent, '  hi:Add to cart  ')
check('skips <option> so language names stay native', $('#lang option').textContent, 'हिन्दी')

// --- the re-render case -----------------------------------------------------
const fetchesBefore = fetches
$('#title').textContent = 'Privacy Policy' // React re-rendering the same copy
await tick()
check('re-applies after a React re-render', $('#title').textContent, 'hi:Privacy Policy')
check('and does so from cache, with no new fetch', fetches, fetchesBefore)

// The critical one: a translation must never be treated as a source.
await tick()
await tick()
check('never translates its own output', $('#title').textContent, 'hi:Privacy Policy')
check('still no extra fetches', fetches, fetchesBefore)

// --- newly rendered content -------------------------------------------------
const added = dom.window.document.createElement('p')
added.textContent = 'Order placed'
body.appendChild(added)
await tick()
await tick()
check('picks up content added later', added.textContent, 'hi:Order placed')

// --- switching back to English ---------------------------------------------
stop()
restoreAll(body)
check('restores the English source', $('#title').textContent, 'Privacy Policy')
check('restores a placeholder too', $('#field').getAttribute('placeholder'), 'Search products')
check('restores whitespace exactly', $('#spaced').textContent, '  Add to cart  ')

console.log(`\nasked for: ${JSON.stringify(asked)}`)
console.log(failures ? `\n${failures} FAILED` : '\nall passed')
process.exit(failures ? 1 : 0)

import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost:5173/admin/accounting/vouchers',
  pretendToBeVisual: true,
})
const { window } = dom
const globals = [
  'window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement',
  'HTMLSelectElement', 'Element', 'Node', 'Event', 'KeyboardEvent', 'MouseEvent',
  'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'localStorage',
  'sessionStorage', 'SVGElement',
]
for (const k of globals) {
  if (window[k] !== undefined) {
    try {
      Object.defineProperty(globalThis, k, { value: window[k], writable: true, configurable: true })
    } catch {}
  }
}
globalThis.ResizeObserver ||= class { observe() {} unobserve() {} disconnect() {} }
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const { createServer } = await import('vite')
const React = (await import('react')).default
const { act } = React
const { createRoot } = await import('react-dom/client')
const { MemoryRouter, useLocation, useNavigate } = await import('react-router-dom')
const { QueryClientProvider, QueryClient } = await import('@tanstack/react-query')

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
const { AppRoutes } = await server.ssrLoadModule('/src/routes/index.jsx')
const { ADMIN_ROUTES } = await server.ssrLoadModule('/src/config/routes.js')
const storeMod = await server.ssrLoadModule('/src/lib/authStore.js')
const authService = await server.ssrLoadModule('/src/modules/admin/services/authService.js')
const fin = await server.ssrLoadModule('/src/modules/admin/fixtures/finance.js')

const log = console.log
const errs = []
console.error = (...a) => {
  const s = a.map(String).join(' ')
  if (!/act\(|useLayoutEffect|Future Flag|defaultProps|not wrapped|width\(0\)/i.test(s)) errs.push(s)
}

storeMod.useAuthStore.getState().setSession(
  await authService.verifyAdminTwoFactor({ code: '123456', challengeId: 'x' }),
)

let go = null
let path = null
function Spy() {
  path = useLocation().pathname
  go = useNavigate()
  return null
}

const c = window.document.getElementById('root')
const root = createRoot(c)
const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
const h = React.createElement
const wait = (ms) => act(async () => { await new Promise((r) => setTimeout(r, ms)) })

async function until(label, fn, tries = 50) {
  for (let i = 0; i < tries; i += 1) {
    if (fn()) return true
    await wait(100)
  }
  log('   TIMEOUT: ' + label)
  return false
}

const doc = window.document.body
const txt = () => doc.textContent
const btnBy = (label) => [...doc.querySelectorAll('button')].find((b) => b.textContent.trim() === label)
const click = (el) => act(async () => { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true })) })

function setVal(el, value) {
  const proto =
    el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype
    : el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype
    : window.HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value)
  el.dispatchEvent(new window.Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
}

const tbBalanced = () => {
  const r = fin.trialBalanceFixture().rows
  return r.reduce((t, x) => t + x.debit, 0) === r.reduce((t, x) => t + x.credit, 0)
}
// Read what the screen actually shows. Asserting against a fixture module
// the app may not share is how the first run of this probe fooled itself.
function shownNetProfit() {
  const row = [...doc.querySelectorAll('tr')].find((tr) => /Net profit before tax/.test(tr.textContent))
  if (!row) return null
  const cell = [...row.querySelectorAll('td')].find((td) => /₹/.test(td.textContent))
  return cell ? cell.textContent.trim() : null
}
async function gotoAndRead(route, ready) {
  await act(async () => { go(route) })
  await until(route, ready)
  return shownNetProfit()
}

await act(async () => {
  root.render(
    h(QueryClientProvider, { client: qc },
      h(MemoryRouter, { initialEntries: [ADMIN_ROUTES.JOURNAL_VOUCHERS], future: { v7_startTransition: true, v7_relativeSplatPath: true } },
        h(React.Fragment, null, h(Spy), h(AppRoutes)))))
})
await until('vouchers page', () => btnBy('New voucher'))
await until('voucher rows', () => /JV\/2627/.test(txt()))
log('1. page              =', path)
log('   New voucher button=', Boolean(btnBy('New voucher')))
log('   row action menus  =', doc.querySelectorAll('button[aria-label="Row actions"]').length)
log('   search box        =', Boolean(doc.querySelector('#ledger-search')))

log('')
log('2. net profit the P&L shows BEFORE the posting')
const before = await gotoAndRead(ADMIN_ROUTES.PNL, () => /Net profit before tax/.test(txt()))
log('   net profit        =', before)

log('')
log('3. post a voucher through the form: Dr 6030 750.00 / Cr 2050 750.00')
await act(async () => { go(ADMIN_ROUTES.JOURNAL_VOUCHERS) })
await until('vouchers page again', () => btnBy('New voucher'))
await click(btnBy('New voucher'))
await until('drawer', () => doc.querySelector('#voucher-narration'))
await act(async () => { setVal(doc.querySelector('#voucher-narration'), 'Probe posting from the UI') })

const selects = [...doc.querySelectorAll('select[id^="line-"]')]
log('   line rows         =', selects.length, '| account options =', selects[0] ? selects[0].options.length : 0)
await act(async () => { setVal(selects[0], '6030') })
await act(async () => { setVal([...doc.querySelectorAll('input[id$="-debit"]')][0], '750.00') })
await act(async () => { setVal([...doc.querySelectorAll('select[id^="line-"]')][1], '2050') })
await act(async () => { setVal([...doc.querySelectorAll('input[id$="-credit"]')][1], '750.00') })

const indicator = /Balanced|Out by [^A-Z]*/.exec(txt())
log('   balance indicator =', indicator ? indicator[0].trim() : '(none)')

const submit = btnBy('Post to ledger')
log('   submit label      =', submit ? JSON.stringify(submit.textContent.trim()) : '(missing)')
await click(submit)
await until('toast element', () => doc.querySelector('[role="status"]'))

const toastEl = doc.querySelector('[role="status"]')
const toastText = toastEl ? toastEl.textContent.trim() : '(none)'
log('   toast             =', toastText.slice(0, 70))
log('   ' + (/posted/i.test(toastText) ? 'PASS' : 'FAIL') + '  a toast confirmed the posting')
await until('row in list', () => /Probe posting from the UI/.test(txt()))
log('   ' + (/Probe posting from the UI/.test(txt()) ? 'PASS' : 'FAIL') + '  the new voucher appears in the list')

log('')
log('4. the statements the posting should have moved')
await act(async () => { go(ADMIN_ROUTES.TRIAL_BALANCE) })
await until('trial balance', () => /In balance|Out of balance/.test(txt()))
const tbText = /In balance[^A]*|Out of balance[^A]*/.exec(txt())
log('   trial balance     =', tbText ? tbText[0].slice(0, 55).trim() : '(none)')
log('   ' + (/In balance/.test(txt()) ? 'PASS' : 'FAIL') + '  trial balance still agrees on screen')
await act(async () => { go(ADMIN_ROUTES.PNL) })
await until('pnl', () => /Net profit before tax/.test(txt()))
await until('pnl refetch after invalidation', () => shownNetProfit() !== before)
const after = shownNetProfit()
log('   net profit AFTER  =', after)
log('   ' + (after && before && after !== before ? 'PASS' : 'FAIL') + '  the P&L moved because of the posting')

log('')
log('5. expenses + chart of accounts wiring')
await act(async () => { go(ADMIN_ROUTES.EXPENSES) })
await until('expenses', () => btnBy('Record expense'))
await until('expense rows', () => /Amazon Web Services|Meta Platforms/.test(txt()))
log('   Record expense    =', Boolean(btnBy('Record expense')), '| row menus =', doc.querySelectorAll('button[aria-label="Row actions"]').length)
await act(async () => { go(ADMIN_ROUTES.CHART_OF_ACCOUNTS) })
await until('coa', () => btnBy('New account'))
await until('coa rows', () => /Share capital/.test(txt()))
log('   New account       =', Boolean(btnBy('New account')), '| row menus =', doc.querySelectorAll('button[aria-label="Row actions"]').length)

log('')
if (errs.length) {
  log('--- console errors ---')
  errs.slice(0, 3).forEach((e) => log(e.split('\n').slice(0, 5).join('\n')))
} else {
  log('no console errors')
}

await server.close()
process.exit(0)

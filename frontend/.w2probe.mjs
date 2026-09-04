import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost:5173/admin/finance/settlements',
  pretendToBeVisual: true,
})
const { window } = dom
for (const k of ['window','document','navigator','HTMLElement','HTMLInputElement','HTMLTextAreaElement','HTMLSelectElement','Element','Node','Event','KeyboardEvent','MouseEvent','getComputedStyle','requestAnimationFrame','cancelAnimationFrame','localStorage','sessionStorage','SVGElement']) {
  if (window[k] !== undefined) { try { Object.defineProperty(globalThis, k, { value: window[k], writable: true, configurable: true }) } catch {} }
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
const { ADMIN_ROUTES, adminPath } = await server.ssrLoadModule('/src/config/routes.js')
const storeMod = await server.ssrLoadModule('/src/lib/authStore.js')
const authService = await server.ssrLoadModule('/src/modules/admin/services/authService.js')
const { ADMIN_ROLE_PRESETS } = await server.ssrLoadModule('/src/modules/admin/constants.js')

const log = console.log
const errs = []
console.error = (...a) => {
  const s = a.map(String).join(' ')
  if (!/act\(|useLayoutEffect|Future Flag|defaultProps|not wrapped|width\(0\)/i.test(s)) errs.push(s)
}

const session = await authService.verifyAdminTwoFactor({ code: '123456', challengeId: 'x' })
storeMod.useAuthStore.getState().setSession(session)

let go = null
let path = null
function Spy() { path = useLocation().pathname; go = useNavigate(); return null }

const c = window.document.getElementById('root')
const doc = window.document.body
const root = createRoot(c)
const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
const h = React.createElement
const wait = (ms) => act(async () => { await new Promise((r) => setTimeout(r, ms)) })
async function until(label, fn, tries = 50) {
  for (let i = 0; i < tries; i += 1) { if (fn()) return true; await wait(100) }
  log('   TIMEOUT: ' + label)
  return false
}
const txt = () => doc.textContent
const btnBy = (label) => [...doc.querySelectorAll('button')].find((b) => b.textContent.trim() === label)
const click = (el) => act(async () => { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true })) })
function setVal(el, value) {
  const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value)
  el.dispatchEvent(new window.Event('input', { bubbles: true }))
}
const toastText = () => {
  const t = doc.querySelector('[role="status"]')
  return t ? t.textContent.trim() : '(none)'
}

await act(async () => {
  root.render(h(QueryClientProvider, { client: qc },
    h(MemoryRouter, { initialEntries: [adminPath.settlementBatch('stl-1')], future: { v7_startTransition: true, v7_relativeSplatPath: true } },
      h(React.Fragment, null, h(Spy), h(AppRoutes)))))
})
await until('batch page', () => btnBy('Approve and release'))
log('1. batch page        =', path)
log('   approve button    =', Boolean(btnBy('Approve and release')), '| reject =', Boolean(btnBy('Reject batch')))

log('')
log('2. a WRONG two-factor code must be refused')
await click(btnBy('Approve and release'))
await until('release dialog', () => doc.querySelectorAll('input[inputmode="numeric"]').length === 6)
let boxes = [...doc.querySelectorAll('input[inputmode="numeric"]')]
for (let i = 0; i < 6; i += 1) {
  await act(async () => { setVal([...doc.querySelectorAll('input[inputmode="numeric"]')][i], '0') })
}
await click(btnBy('Release payout'))
await until('rejection message', () => /not accepted|did not save/i.test(txt()))
log('   ' + (/not accepted/i.test(txt()) ? 'PASS' : 'FAIL') + '  wrong code refused: ' + ((/That code was not accepted/.exec(txt()) || ['(none)'])[0]))
log('   ' + (!/UTR/.test(toastText()) ? 'PASS' : 'FAIL') + '  no payout toast fired on the bad code')

log('')
log('3. a VALID code releases the payout')
boxes = [...doc.querySelectorAll('input[inputmode="numeric"]')]
for (let i = 0; i < 6; i += 1) {
  await act(async () => { setVal([...doc.querySelectorAll('input[inputmode="numeric"]')][i], String(i + 1)) })
}
await click(btnBy('Release payout'))
await until('payout toast', () => /released/i.test(toastText()))
log('   toast             =', toastText().slice(0, 80))
log('   ' + (/UTR/.test(toastText()) ? 'PASS' : 'FAIL') + '  a UTR was issued on release')

log('')
log('4. RBAC: a Finance Manager prepares but must NOT be able to approve')
await act(async () => {
  storeMod.useAuthStore.getState().setSession({
    ...session,
    roles: ['finance_manager'],
    permissions: [...ADMIN_ROLE_PRESETS.finance_manager],
  })
})
await act(async () => { go(adminPath.settlementBatch('stl-2')) })
await until('batch as finance manager', () => /Batch stl-2|Approval needs/.test(txt()))
await wait(400)
log('   approve button    =', Boolean(btnBy('Approve and release')))
log('   ' + (!btnBy('Approve and release') ? 'PASS' : 'FAIL') + '  approve is hidden from Finance Manager')
log('   ' + (/Approval needs a Super Admin/.test(txt()) ? 'PASS' : 'FAIL') + '  the fallback explains why')

log('')
log('5. row actions on the money lists (back as Super Admin)')
await act(async () => { storeMod.useAuthStore.getState().setSession(session) })
for (const [label, route, ready] of [
  ['transactions', ADMIN_ROUTES.TRANSACTIONS, /pay_/],
  ['refunds', ADMIN_ROUTES.REFUNDS, /rfnd_/],
  ['vendor ledgers', ADMIN_ROUTES.VENDOR_LEDGERS, /Closing balance is a sub-ledger/],
]) {
  await act(async () => { go(route) })
  await until(label, () => ready.test(txt()))
  await until(label + ' rows', () => doc.querySelectorAll('button[aria-label="Row actions"]').length > 0)
  log('   ' + label.padEnd(15) + ' row menus =', doc.querySelectorAll('button[aria-label="Row actions"]').length)
}

log('')
if (errs.length) { log('--- console errors ---'); errs.slice(0, 3).forEach((e) => log(e.split('\n').slice(0, 5).join('\n'))) }
else log('no console errors')

await server.close()
process.exit(0)

import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost:5173/admin/catalog/approvals',
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
const { ADMIN_ROUTES } = await server.ssrLoadModule('/src/config/routes.js')
const storeMod = await server.ssrLoadModule('/src/lib/authStore.js')
const authService = await server.ssrLoadModule('/src/modules/admin/services/authService.js')

const log = console.log
const errs = []
console.error = (...a) => {
  const s = a.map(String).join(' ')
  if (!/act\(|useLayoutEffect|Future Flag|defaultProps|not wrapped|width\(0\)/i.test(s)) errs.push(s)
}
storeMod.useAuthStore.getState().setSession(await authService.verifyAdminTwoFactor({ code: '123456', challengeId: 'x' }))

let go = null
function Spy() { useLocation(); go = useNavigate(); return null }
const c = window.document.getElementById('root')
const doc = window.document.body
const root = createRoot(c)
const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
const h = React.createElement
const wait = (ms) => act(async () => { await new Promise((r) => setTimeout(r, ms)) })
async function until(label, fn, tries = 60) {
  for (let i = 0; i < tries; i += 1) { if (fn()) return true; await wait(100) }
  log('   TIMEOUT: ' + label)
  return false
}
const txt = () => doc.textContent
const btnBy = (label) => [...doc.querySelectorAll('button')].find((b) => b.textContent.trim() === label)
const allBtns = (label) => [...doc.querySelectorAll('button')].filter((b) => b.textContent.trim() === label)
const click = (el) => act(async () => { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true })) })
function setVal(el, value) {
  const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype
    : el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype
    : window.HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value)
  el.dispatchEvent(new window.Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
}
const toastText = () => { const t = doc.querySelector('[role="status"]'); return t ? t.textContent.trim() : '(none)' }
const menus = () => doc.querySelectorAll('button[aria-label="Row actions"]').length

await act(async () => {
  root.render(h(QueryClientProvider, { client: qc },
    h(MemoryRouter, { initialEntries: [ADMIN_ROUTES.CATALOG_APPROVALS], future: { v7_startTransition: true, v7_relativeSplatPath: true } },
      h(React.Fragment, null, h(Spy), h(AppRoutes)))))
})
await until('approvals', () => btnBy('Approve'))
log('1. approval queue')
log('   approve buttons   =', allBtns('Approve').length, '| reject =', allBtns('Reject').length)
const blockedBefore = /Blocked by category approval/i.test(txt())
log('   a product is blocked by its category =', blockedBefore)

log('')
log('2. approving the CATEGORY should unblock the product waiting on it')
// apr-4 is the category "Electronics > Air Purifiers"; find its row's Approve.
const rows = [...doc.querySelectorAll('li')]
const catRow = rows.find((li) => /Air Purifiers/.test(li.textContent) && /New sub-category/.test(li.textContent))
const catApprove = catRow ? [...catRow.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Approve') : null
log('   category row found=', Boolean(catRow), '| its approve enabled =', catApprove ? !catApprove.disabled : 'n/a')
await click(catApprove)
await until('approval toast', () => /approved/i.test(toastText()))
log('   toast             =', toastText().slice(0, 90))
await until('queue refresh', () => !/New sub-category/.test(txt()))
log('   ' + (!/Blocked by category approval/i.test(txt()) ? 'PASS' : 'FAIL') + '  the blocked product was released by approving its category')

log('')
log('3. catalog row actions')
for (const [label, route, ready] of [
  ['products', ADMIN_ROUTES.PRODUCTS, /Nirvaan Triply/],
  ['categories', ADMIN_ROUTES.CATEGORIES, /Category tree/],
  ['attributes', ADMIN_ROUTES.ATTRIBUTES, /attributes/],
  ['inventory', ADMIN_ROUTES.INVENTORY, /Bhiwandi warehouse/],
]) {
  await act(async () => { go(route) })
  await until(label, () => ready.test(txt()))
  await until(label + ' rows', () => menus() > 0)
  log('   ' + label.padEnd(12) + ' row menus =', menus())
}

log('')
log('4. adjust stock actually changes available (on-hand minus reserved)')
await act(async () => { go(ADMIN_ROUTES.INVENTORY) })
await until('inventory', () => menus() > 0)
const firstMenu = doc.querySelector('button[aria-label="Row actions"]')
await click(firstMenu)
await until('menu open', () => btnBy('Adjust stock'))
await click(btnBy('Adjust stock'))
await until('adjust dialog', () => doc.querySelector('#inventory-onhand'))
await act(async () => { setVal(doc.querySelector('#inventory-onhand'), '2000') })
await act(async () => { setVal(doc.querySelector('#inventory-reason'), 'Cycle count correction') })
log('   projected line    =', (/\d+ would be available to sell/.exec(txt()) || ['(none)'])[0])
await click(btnBy('Post adjustment'))
await until('adjust toast', () => /on hand/i.test(toastText()))
log('   toast             =', toastText().slice(0, 90))
log('   ' + (/2000 on hand/.test(toastText()) ? 'PASS' : 'FAIL') + '  stock adjustment applied')

log('')
log('5. create a category through the form')
await act(async () => { go(ADMIN_ROUTES.CATEGORIES) })
await until('categories', () => btnBy('New category'))
await click(btnBy('New category'))
await until('category drawer', () => doc.querySelector('#category-name'))
await act(async () => { setVal(doc.querySelector('#category-name'), 'Probe Category') })
await act(async () => { setVal(doc.querySelector('#category-commission'), '9.5') })
await click(btnBy('Create category'))
await until('category toast', () => /added/i.test(toastText()))
log('   toast             =', toastText().slice(0, 70))
await until('appears in tree', () => /Probe Category/.test(txt()))
log('   ' + (/Probe Category/.test(txt()) ? 'PASS' : 'FAIL') + '  new category appears in the tree')

log('')
if (errs.length) { log('--- console errors ---'); errs.slice(0, 3).forEach((e) => log(e.split('\n').slice(0, 5).join('\n'))) }
else log('no console errors')

await server.close()
process.exit(0)

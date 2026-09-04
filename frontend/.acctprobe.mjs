import { createServer } from 'vite'
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
const f = await server.ssrLoadModule('/src/modules/admin/fixtures/finance.js')
const money = (p) => '₹' + (p / 100).toLocaleString('en-IN')
const tb = () => { const r = f.trialBalanceFixture().rows; return [r.reduce((t,x)=>t+x.debit,0), r.reduce((t,x)=>t+x.credit,0)] }
const bs = () => { const l = f.balanceSheetFixture().lines; const g=(n)=>l.find(x=>x.label===n).current; return [g('Total assets'), g('Total liabilities and equity')] }
const pnlProfit = () => { const l = f.profitAndLossFixture().lines; const t = l.filter(x=>x.kind==='total').pop(); return t ? t.current : null }
const check = (label, [a, b]) => console.log(`${a === b ? 'PASS' : 'FAIL'}  ${label}: ${money(a)} vs ${money(b)}`)

console.log('--- at rest ---')
check('trial balance Dr=Cr', tb()); check('assets = liab+equity', bs())
const beforeTb = tb()[0], beforeProfit = pnlProfit()
console.log('net profit =', money(beforeProfit))

console.log('\n--- post a balanced voucher: Dr 6030 hosting 500000 / Cr 2050 accruals 500000 ---')
const v = f.createJournalVoucherFixture({ date: '2026-09-04', narration: 'Probe posting', lines: [ { code: '6030', debit: 500000, credit: 0 }, { code: '2050', debit: 0, credit: 500000 } ] })
console.log('created', v.number, v.status, money(v.debit))
check('trial balance still Dr=Cr', tb()); check('assets = liab+equity', bs())
console.log(`${pnlProfit() === beforeProfit - 500000 ? 'PASS' : 'FAIL'}  profit fell by exactly the expense: ${money(beforeProfit)} -> ${money(pnlProfit())}`)
console.log(`${tb()[0] === beforeTb + 500000 ? 'PASS' : 'FAIL'}  debit total grew by the posting`)

console.log('\n--- reverse it ---')
f.reverseJournalVoucherFixture(v.id)
check('trial balance still Dr=Cr', tb())
console.log(`${pnlProfit() === beforeProfit ? 'PASS' : 'FAIL'}  profit restored to ${money(beforeProfit)} (got ${money(pnlProfit())})`)

console.log('\n--- rejections ---')
const reject = (label, fn) => { try { fn(); console.log('FAIL  ' + label + ' was allowed') } catch (e) { console.log('PASS  ' + label + ' -> ' + e.message) } }
reject('unbalanced voucher', () => f.createJournalVoucherFixture({ narration: 'x', lines: [{ code: '6030', debit: 100, credit: 0 }, { code: '2050', debit: 0, credit: 90 }] }))
reject('single-sided voucher', () => f.createJournalVoucherFixture({ narration: 'x', lines: [{ code: '6030', debit: 100, credit: 0 }] }))
reject('unknown account', () => f.createJournalVoucherFixture({ narration: 'x', lines: [{ code: '9999', debit: 100, credit: 0 }, { code: '2050', debit: 0, credit: 100 }] }))
reject('deleting a posted voucher', () => f.deleteJournalVoucherFixture('jv-1'))
reject('re-reversing a reversed voucher', () => f.reverseJournalVoucherFixture(v.id))
reject('deactivating an account with a balance', () => f.setAccountActiveFixture('1010', false))

console.log('\n--- expense posts to the ledger ---')
const p0 = pnlProfit()
const e = f.createExpenseFixture({ date: '2026-09-04', category: 'Hosting & infrastructure', vendor: 'AWS', narration: 'probe', amount: 200000, gst: 36000, itcClaimable: true })
check('trial balance still Dr=Cr', tb()); check('assets = liab+equity', bs())
console.log(`${pnlProfit() === p0 - 200000 ? 'PASS' : 'FAIL'}  claimable GST stayed OUT of the P&L: profit ${money(p0)} -> ${money(pnlProfit())} (expected -${money(200000)})`)
f.deleteExpenseFixture(e.id)
console.log(`${pnlProfit() === p0 ? 'PASS' : 'FAIL'}  deleting the expense restored profit`)
check('trial balance after delete', tb())
await server.close(); process.exit(0)

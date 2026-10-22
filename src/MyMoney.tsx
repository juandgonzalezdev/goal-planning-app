import { useState } from 'react'
import { compareExtraPayments, PAYOFF_LIMIT_MONTHS, type ExtraPaymentComparison } from './domain/loanPayoff'
import { parseDecimalInput } from './ui/decimalInput'
import './MyMoney.css'

type DebtType = 'Personal Loan' | 'Car Loan' | 'Credit Card' | 'Other'
type Debt = { id: number; type: DebtType; name: string; balance: string; interest: string; payment: string }

const fmt = (n: number) => Number.isFinite(n)
  ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' PLN'
  : '—'

const PAYOFF_MESSAGES: Record<Exclude<ExtraPaymentComparison['status'], 'compared'>, string> = {
  'invalid-input': 'Add a valid remaining balance, yearly interest rate, and monthly payment.',
  'one-off-above-balance': 'The one-time extra payment can\'t be more than the remaining balance.',
  'payment-too-low': 'Your regular payment must cover the interest.',
  'longer-than-limit': `With this monthly payment, paying this off would take more than ${PAYOFF_LIMIT_MONTHS} months (${PAYOFF_LIMIT_MONTHS / 12} years).`,
}

export function MyMoney({ onBack }: { onBack: () => void }) {
  const [income, setIncome] = useState('')
  const [expenses, setExpenses] = useState('')
  const [savings, setSavings] = useState('')
  const [debts, setDebts] = useState<Debt[]>([])
  const [openId, setOpenId] = useState<number | null>(null)
  const [extraById, setExtraById] = useState<Record<number, string>>({})
  const [oneOffById, setOneOffById] = useState<Record<number, string>>({})
  const addDebt = () => {
    const id = Math.max(0, ...debts.map(d => d.id)) + 1
    setDebts(ds => [...ds, { id, type: 'Personal Loan', name: '', balance: '', interest: '', payment: '' }])
    setOpenId(id)
  }
  const editDebt = (id: number, change: Partial<Debt>) => setDebts(ds => ds.map(d => d.id === id ? { ...d, ...change } : d))
  const totalDebt = debts.reduce((sum, d) => sum + (Number.isFinite(parseDecimalInput(d.balance)) ? parseDecimalInput(d.balance) : 0), 0)
  const monthlyDebt = debts.reduce((sum, d) => sum + (Number.isFinite(parseDecimalInput(d.payment)) ? parseDecimalInput(d.payment) : 0), 0)
  const moneyLeft = parseDecimalInput(income) - parseDecimalInput(expenses) - monthlyDebt

  return (
    <div className="money-app">
      <div className="money-top"><button type="button" className="money-link" onClick={onBack}>← My Goals</button><span className="money-eyebrow">PRIVATE PREVIEW · NOT SAVED</span></div>
      <h1>My Money</h1>
      <p className="money-muted">See what you earn, spend, save, and still need to pay.</p>
      <section className="money-panel">
        <h2>Monthly Money</h2>
        <p className="money-muted">Use the amounts you normally receive and spend in one month.</p>
        <div className="money-fields">
          <label>Monthly Income (PLN)<input inputMode="decimal" value={income} onChange={e => setIncome(e.target.value)} placeholder="0.00" /></label>
          <label>Monthly Expenses (PLN)<input inputMode="decimal" value={expenses} onChange={e => setExpenses(e.target.value)} placeholder="0.00" /></label>
          <label>Money Saved (PLN)<input inputMode="decimal" value={savings} onChange={e => setSavings(e.target.value)} placeholder="0.00" /></label>
        </div>
        <p className="money-muted money-small">If you add loan or card payments below, don't also count them in Monthly Expenses.</p>
      </section>
      <section className="money-panel">
        <div className="money-section-head"><h2>My Loans & Cards</h2><button type="button" className="money-cta secondary" onClick={addDebt}>+ Add</button></div>
        {debts.length === 0 && <p className="money-muted">No loans or cards added yet.</p>}
        {debts.map(d => {
          const balance = parseDecimalInput(d.balance)
          const interestRate = parseDecimalInput(d.interest)
          const regular = parseDecimalInput(d.payment)
          const extraText = extraById[d.id] ?? '0'
          const oneOffText = oneOffById[d.id] ?? '0'
          const extra = parseDecimalInput(extraText)
          const oneOff = parseDecimalInput(oneOffText)
          const comparison = compareExtraPayments({ balance, yearlyRate: interestRate, regularPayment: regular, extraMonthly: extra, oneOffPayment: oneOff })
          const isOpen = openId === d.id
          return <div className="money-debt" key={d.id}>
            <div className="money-section-head"><strong>{d.name.trim() || d.type}</strong><button type="button" className="money-link" onClick={() => {setDebts(ds => ds.filter(x => x.id !== d.id)); if (openId === d.id) setOpenId(null)}}>Remove</button></div>
            <div className="money-fields">
              <label>Type<select value={d.type} onChange={e => editDebt(d.id, { type: e.target.value as DebtType })}><option>Personal Loan</option><option>Car Loan</option><option>Credit Card</option><option>Other</option></select></label>
              <label>Name (optional)<input value={d.name} onChange={e => editDebt(d.id, { name: e.target.value })} placeholder="e.g. My Car" /></label>
              <label>Remaining Balance (PLN)<input inputMode="decimal" value={d.balance} onChange={e => editDebt(d.id, { balance: e.target.value })} placeholder="e.g. 12000.00" /></label>
              <label>Yearly Interest (%)<input inputMode="decimal" value={d.interest} onChange={e => editDebt(d.id, { interest: e.target.value })} placeholder="e.g. 9.49" /></label>
              <label>{d.type === 'Credit Card' ? 'Planned Monthly Payment (PLN)' : 'Monthly Payment (PLN)'}<input inputMode="decimal" value={d.payment} onChange={e => editDebt(d.id, { payment: e.target.value })} placeholder="e.g. 500.00" /></label>
            </div>
            <button type="button" className="money-cta secondary" aria-expanded={isOpen} aria-controls={`calculator-${d.id}`} onClick={() => setOpenId(isOpen ? null : d.id)}>{isOpen ? 'Hide Calculator ↑' : 'Try Extra Payments ↓'}</button>
            {isOpen && <div id={`calculator-${d.id}`} className="money-inline-calculator">
              <h3>What If I Pay Extra?</h3>
              <p className="money-muted">Try a different amount. See your savings right here. No target date needed.</p>
              <div className="money-fields">
                <label>Extra Each Month (PLN)<input inputMode="decimal" value={extraText} onChange={e => setExtraById(p => ({...p,[d.id]:e.target.value}))} placeholder="0" /></label>
                <label>One-Time Extra Payment (PLN)<input inputMode="decimal" value={oneOffText} onChange={e => setOneOffById(p => ({...p,[d.id]:e.target.value}))} placeholder="0" /></label>
              </div>
              <div className="money-presets">{[0,100,200,500,1000].map(n => <button type="button" key={n} onClick={() => setExtraById(p => ({...p,[d.id]:String(n)}))}>{n === 0 ? 'No extra' : `+${n} PLN`}</button>)}</div>
              {comparison.status === 'compared' ? <div className="money-metrics" aria-live="polite">
                <div><span>Without Extra</span><strong>{comparison.withoutExtra.months} months</strong><small>Interest: {fmt(comparison.withoutExtra.interest)}</small></div>
                <div><span>With Extra</span><strong>{comparison.withExtra.months} months</strong><small>Interest: {fmt(comparison.withExtra.interest)}</small></div>
                <div><span>Months Saved</span><strong>{comparison.monthsSaved}</strong></div>
                <div><span>Interest Saved</span><strong>{fmt(comparison.interestSaved)}</strong></div>
              </div> : <p className="money-muted" role="status">{PAYOFF_MESSAGES[comparison.status]}</p>}
              <p className="money-muted money-small">Estimate only. Assumes the same interest rate, monthly payments, no new borrowing, and extra payments that shorten the loan rather than lower your regular payment. Your bank may calculate differently.</p>
              {d.type === 'Credit Card' && <p className="money-muted money-small">Credit card minimum payments may change each month. Use the amount you plan to pay, not the minimum shown after a past payment.</p>}
            </div>}
          </div>
        })}
      </section>
      <section className="money-panel"><h2>Your Overview</h2><div className="money-metrics">
        <div><span>Remaining Balance</span><strong>{fmt(totalDebt)}</strong></div>
        <div><span>Loan & Card Payments</span><strong>{fmt(monthlyDebt)}</strong></div>
        <div><span>Money Saved</span><strong>{savings.trim() && Number.isFinite(parseDecimalInput(savings)) ? fmt(parseDecimalInput(savings)) : 'Not added'}</strong></div>
        <div><span>Money Left Each Month</span><strong>{income.trim() && expenses.trim() && Number.isFinite(moneyLeft) ? fmt(moneyLeft) : 'Add income & expenses'}</strong></div>
      </div><p className="money-muted money-small">These are numbers you entered, not confirmed bank balances. No goals are created from this information.</p></section>
      <p className="money-foot">This preview keeps data in your current browser session only. Refreshing the page clears it. Nothing is saved or sent to a bank.</p>
    </div>
  )
}

import { useState, type FormEvent } from 'react'
import { evaluateGoalPlan, type GoalPlanResult } from './domain/evaluateGoalPlan'
import './App.css'

type Fields = {
  targetAmount: string
  alreadySaved: string
  targetDate: string
  comfortableContribution: string
}

const todayString = () => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const addMonths = (date: string, count: number) => {
  const [year, month, day] = date.split('-').map(Number)
  const first = new Date(year, month - 1 + count, 1)
  const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  return `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`
}

// Input amounts are PLN; the domain engine receives integers in grosze.
function toGrosze(value: string): number | null {
  const normalized = value.trim().replace(',', '.')
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null
  const [whole, fraction = ''] = normalized.split('.')
  const number = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  return Number.isSafeInteger(number) ? number : null
}

function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
}

const money = (grosze: number) => new Intl.NumberFormat('en-GB', {
  style: 'currency', currency: 'PLN', minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(grosze / 100)

const presets: Record<string, Fields> = {
  'Home deposit': { targetAmount: '25000', alreadySaved: '5700', targetDate: addMonths(todayString(), 60), comfortableContribution: '310' },
  'Short deadline': { targetAmount: '300', alreadySaved: '0', targetDate: addMonths(todayString(), 0), comfortableContribution: '300' },
  'Already funded': { targetAmount: '5000', alreadySaved: '5000', targetDate: addMonths(todayString(), 6), comfortableContribution: '200' },
}

function ResultView({ result, target }: { result: GoalPlanResult; target: number }) {
  const labels: Record<GoalPlanResult['status'], string> = {
    funded: 'Goal already funded',
    'invalid-target-date': 'Review your target date',
    'not-applicable': 'Monthly plan not applicable',
    supported: 'Plan is supported',
    'needs-adjustment': 'Plan needs adjustment',
  }
  const explanations: Record<GoalPlanResult['status'], string> = {
    funded: 'Your recorded savings already meet this target. You can choose what to do next.',
    'invalid-target-date': 'The date is today or in the past, and there is still an amount remaining.',
    'not-applicable': 'There are no complete monthly contribution opportunities before this deadline. Consider reviewing the timeline.',
    supported: 'Your chosen monthly contribution is at least the calculated requirement.',
    'needs-adjustment': 'Your chosen monthly contribution is below the calculated requirement. You can explore another amount or date.',
  }
  const isMonthly = result.status === 'supported' || result.status === 'needs-adjustment'
  const ratio = target > 0 ? Math.max(0, Math.min(100, ((target - result.remainingAmount) / target) * 100)) : 0
  return (
    <section className="panel result-panel" aria-live="polite">
      <div className="eyebrow">YOUR PLAN ANALYSIS</div>
      <h2 className={`result-title status-${result.status}`}>{labels[result.status]}</h2>
      <p className="result-description">{explanations[result.status]}</p>
      <div className="metrics">
        <div className="metric"><span>Remaining amount</span><strong>{money(result.remainingAmount)}</strong></div>
        <div className="metric"><span>Days remaining</span><strong>{result.status === 'funded' ? '—' : result.daysRemaining}</strong></div>
        <div className="metric"><span>Monthly opportunities</span><strong>{'monthlyOpportunities' in result ? result.monthlyOpportunities : '—'}</strong></div>
        <div className="metric"><span>Required monthly</span><strong>{isMonthly ? money(result.requiredMonthlyContribution) : '—'}</strong></div>
      </div>
      {result.status === 'needs-adjustment' && <div className="detail warning">Monthly shortfall <strong>{money(result.monthlyShortfall)}</strong></div>}
      {result.status === 'supported' && <div className="detail positive">Monthly surplus <strong>{money(result.monthlySurplus)}</strong></div>}
      <div className="progress-head"><span>Goal progress</span><span>{ratio.toFixed(1)}%</span></div>
      <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={ratio} aria-label="Goal progress"><div style={{ width: `${ratio}%` }}/></div>
      <p className="disclaimer">Based only on the amounts and dates you entered. This is not an assessment of your full financial situation. You decide what to do next.</p>
    </section>
  )
}

function App() {
  const [fields, setFields] = useState<Fields>({ targetAmount: '30000', alreadySaved: '24200', targetDate: addMonths(todayString(), 4), comfortableContribution: '800' })
  const [evaluation, setEvaluation] = useState<{ result: GoalPlanResult; target: number } | null>(null)
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)
  const setField = (name: keyof Fields, value: string) => { setFields(old => ({ ...old, [name]: value })); setDirty(true) }

  function onEvaluate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const target = toGrosze(fields.targetAmount)
    const saved = toGrosze(fields.alreadySaved)
    const contribution = toGrosze(fields.comfortableContribution)
    if (target === null || target <= 0 || saved === null || contribution === null || !isValidCalendarDate(fields.targetDate)) {
      setError('Enter a positive target, non-negative amounts with up to two decimals, and a valid date.')
      setEvaluation(null)
      setDirty(false)
      return
    }
    setError('')
    setEvaluation({ target, result: evaluateGoalPlan({ today: todayString(), targetDate: fields.targetDate, targetAmount: target, alreadySaved: saved, comfortableContribution: contribution }) })
    setDirty(false)
  }

  return (
    <div className="app-shell">
      <header className="app-header"><div className="brand"><span className="brand-symbol">◎</span><span>goal planning</span></div><span className="header-caption">PERSONAL · PROTOTYPE 0.1</span></header>
      <main className="main-content">
        <div className="intro"><span className="eyebrow">MAKE YOUR NEXT MOVE WITH CLARITY</span><h1>Plan with clearer numbers.</h1><p>Set a goal, choose your monthly contribution and explore what the numbers say.<br/>Calculations run entirely on this device.</p></div>
        <div className="workspace">
          <section className="panel input-panel">
            <h2>Create a personal goal</h2>
            <p className="section-subtitle">Enter four planning inputs. Nothing is saved or shared.</p>
            <form onSubmit={onEvaluate} noValidate>
              <label htmlFor="target">Target amount (PLN)</label><input id="target" inputMode="decimal" value={fields.targetAmount} onChange={e => setField('targetAmount', e.target.value)} />
              <label htmlFor="saved">Already saved (PLN)</label><input id="saved" inputMode="decimal" value={fields.alreadySaved} onChange={e => setField('alreadySaved', e.target.value)} />
              <label htmlFor="date">Target date</label><input id="date" type="date" value={fields.targetDate} onChange={e => setField('targetDate', e.target.value)} />
              <label htmlFor="monthly">Comfortable monthly contribution (PLN)</label><input id="monthly" inputMode="decimal" value={fields.comfortableContribution} onChange={e => setField('comfortableContribution', e.target.value)} />
              <div className="scenario-label">Try a scenario</div>
              <div className="scenario-row">{Object.entries(presets).map(([name, preset]) => <button type="button" className="scenario-button" key={name} onClick={() => { setFields(preset); setError(''); setDirty(true) }}>{name}</button>)}</div>
              {error && <p className="input-error" role="alert">{error}</p>}
              <button type="submit" className="primary-button">Evaluate goal <span aria-hidden="true">→</span></button>
            </form>
          </section>
          {evaluation ? <div className="result-wrapper">{dirty && <div className="stale-note">Inputs changed. Select “Evaluate goal” to refresh your analysis.</div>}<ResultView result={evaluation.result} target={evaluation.target}/></div> : <section className="panel empty-panel"><div className="empty-mark">↗</div><h2>Your plan analysis</h2><p>Complete the four fields and select “Evaluate goal” to see your result.</p></section>}
        </div>
        <footer className="footer-note">Goal Planning App · Prototype 0.1 · Planning information only · No account or bank connection</footer>
      </main>
    </div>
  )
}
export default App

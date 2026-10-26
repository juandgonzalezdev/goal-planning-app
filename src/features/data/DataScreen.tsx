import { useState } from 'react'
import type { YearMonth } from '../../domain/calendar'
import type { FinanceData, Id, Owner } from '../../domain/finance/types'
import type { CalendarDate } from '../../domain/goalTime'
import { outcomeText, type SaveOutcome } from '../../ui/saveOutcome'
import { AccountsSection } from './AccountsSection'
import { BillsSection } from './BillsSection'
import { DebtsSection } from './DebtsSection'
import { ExchangeSection } from './ExchangeSection'
import { GoalsSection } from './GoalsSection'
import { IncomeSection } from './IncomeSection'

export type DataScreenProps = {
  data: FinanceData
  isDemo: boolean
  months: YearMonth[]
  month: YearMonth
  today: CalendarDate
  owner: Owner
  newId: () => string
  onChange: (change: (data: FinanceData) => FinanceData) => SaveOutcome
  onReplace: (data: FinanceData) => SaveOutcome
  onOpenBill: (id: Id | null) => void
  onOpenDebt: (id: Id | null) => void
  onOpenGoal: (id: Id) => void
  onAddGoal: () => void
  onResetDemo: () => void
}

/**
 * Manage Your Data: the one place to see and edit every record: income
 * and pay days, bills, cards and loans, account balances and goals. Home,
 * Bills and Cards open these same records, so a change made anywhere
 * shows everywhere. Export and import stay at the end.
 */
export function DataScreen(props: DataScreenProps) {
  const { data, isDemo } = props
  const [message, setMessage] = useState('')
  const say = (done: string, outcome: SaveOutcome) => setMessage(outcomeText(done, outcome))
  return (
    <div className="tab-screen">
      <h1 className="tab-title">Manage Your Data</h1>
      <p className="muted-note">
        {isDemo
          ? 'Demo: Alex is invented. Change anything to try it out; nothing here is saved, and your own space is never touched.'
          : 'Everything you enter is saved on this device only. No bank is connected.'}
      </p>
      <p className="muted-note" role="status">{message}</p>
      <IncomeSection {...props} say={say} />
      <BillsSection {...props} />
      <DebtsSection {...props} />
      <AccountsSection {...props} say={say} />
      <GoalsSection {...props} say={say} />
      {isDemo && (
        <section className="block" aria-labelledby="data-demo">
          <h2 id="data-demo" className="section-title">Demo</h2>
          <p className="field-help">Put Alex’s original example back. Only the demo changes.</p>
          <button type="button" className="button-secondary" onClick={() => { props.onResetDemo(); setMessage('The demo is back to the original example.') }}>Reset Demo</button>
        </section>
      )}
      <ExchangeSection data={data} isDemo={isDemo} onReplace={props.onReplace} />
    </div>
  )
}

/** What each section gets: the screen's props, and `say` to show a message after a change. */
export type SectionProps = DataScreenProps & { say: (done: string, outcome: SaveOutcome) => void }

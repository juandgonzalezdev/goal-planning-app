import { useState } from 'react'
import { ResetDemoConfirm } from '../../components/ResetDemoConfirm'
import type { YearMonth } from '../../domain/calendar'
import type { FinanceData, Id, Owner } from '../../domain/finance/types'
import type { CalendarDate } from '../../domain/goalTime'
import { outcomeText, type SaveOutcome } from '../../ui/saveOutcome'
import { AccountsSection } from './AccountsSection'
import { BillsSection } from './BillsSection'
import { DataBlockFrame } from './DataBlockFrame'
import { DataBlocksContext, setAllBlocksOpen, type DataView } from './dataBlocks'
import { DebtsSection } from './DebtsSection'
import { ExchangeSection } from './ExchangeSection'
import { GoalsSection } from './GoalsSection'
import { IncomeSection } from './IncomeSection'
import { ReportSection } from './ReportSection'

export type DataScreenProps = {
  data: FinanceData
  isDemo: boolean
  months: YearMonth[]
  month: YearMonth
  today: CalendarDate
  owner: Owner
  newId: () => string
  /** Open blocks, filters and the item shown in detail: kept while moving around the app. */
  view: DataView
  onViewChange: (view: DataView) => void
  onChange: (change: (data: FinanceData) => FinanceData) => SaveOutcome
  onReplace: (data: FinanceData) => SaveOutcome
  onOpenBill: (id: Id | null) => void
  onOpenDebt: (id: Id | null) => void
  onOpenGoal: (id: Id) => void
  onAddGoal: () => void
  onReviewEmergency: () => void
  onResetDemo: () => void
}

/**
 * Manage Your Data: the one place to see and edit every record, in six
 * blocks that open and close, always in the same order: Income, Bills,
 * Cards & Loans, Accounts & Balances, Goals & Emergency Fund, and Reports
 * & Backup. Home, Bills and Cards open these same records, so a change
 * made anywhere shows everywhere. Reset Demo stays apart, at the end.
 */
export function DataScreen(props: DataScreenProps) {
  const { data, isDemo, view, onViewChange } = props
  const [message, setMessage] = useState('')
  const say = (done: string, outcome: SaveOutcome) => setMessage(outcomeText(done, outcome))
  return (
    <div className="tab-screen">
      <div className="data-head">
        <h1 className="tab-title">Manage Your Data</h1>
        <span className="inline-actions">
          <button type="button" className="button-small" onClick={() => onViewChange(setAllBlocksOpen(view, true))}>Expand All</button>
          <button type="button" className="button-small" onClick={() => onViewChange(setAllBlocksOpen(view, false))}>Collapse All</button>
        </span>
      </div>
      <p className="muted-note">
        {isDemo
          ? 'Demo: Alex is invented. Change anything to try it out; nothing here is saved, and your own space is never touched.'
          : 'Everything you enter is saved on this device only. No bank is connected.'}
      </p>
      <p className="muted-note" role="status">{message}</p>
      <DataBlocksContext.Provider value={{ view, onViewChange }}>
        <div className="data-blocks">
          <IncomeSection {...props} say={say} />
          <BillsSection {...props} />
          <DebtsSection {...props} />
          <AccountsSection {...props} say={say} />
          <GoalsSection {...props} say={say} />
          <DataBlockFrame block="reports" summary={isDemo ? 'PDF report and backup file' : 'PDF report, backup file and restore'}>
            <ReportSection data={data} isDemo={isDemo} months={props.months} month={props.month} today={props.today} />
            <ExchangeSection data={data} isDemo={isDemo} onReplace={props.onReplace} />
          </DataBlockFrame>
        </div>
      </DataBlocksContext.Provider>
      {isDemo && (
        <section className="block demo-zone" aria-labelledby="data-demo">
          <h2 id="data-demo" className="section-title">Demo</h2>
          <p className="field-help">Put Alex’s original example back. Only the demo changes; your own space is never touched.</p>
          <ResetDemoConfirm onReset={props.onResetDemo} showDone />
        </section>
      )}
    </div>
  )
}

/** What each section gets: the screen's props, and `say` to show a message after a change. */
export type SectionProps = DataScreenProps & { say: (done: string, outcome: SaveOutcome) => void }

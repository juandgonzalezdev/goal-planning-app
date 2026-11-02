import { useState } from 'react'
import { Icon } from '../../components/Icon'
import type { YearMonth } from '../../domain/calendar'
import type { FinanceData, Id, Owner } from '../../domain/finance/types'
import type { CalendarDate } from '../../domain/goalTime'
import { outcomeText, type ChangeSpace, type SaveOutcome } from '../../ui/saveOutcome'
import { AccountsSection } from './AccountsSection'
import { CardsLoansSection } from './CardsLoansSection'
import { IncomeSection } from './IncomeSection'
import { MoneyBlocksContext, setAllBlocksOpen, type MoneyView } from './moneyBlocks'

export type MoneyScreenProps = {
  data: FinanceData
  isDemo: boolean
  months: YearMonth[]
  /** The month shared by Home, Bills and Cards & Loans. */
  month: YearMonth
  onMonthChange: (month: YearMonth) => void
  today: CalendarDate
  owner: Owner
  newId: () => string
  /** Open blocks, filters and the item shown in detail: kept while moving around the app. */
  view: MoneyView
  onViewChange: (view: MoneyView) => void
  onChange: ChangeSpace
  onOpenDebt: (id: Id | null) => void
  onOpenGoal: (id: Id) => void
  /** Settings, on Reports & Backup. */
  onOpenReports: () => void
}

/**
 * Money: income, accounts and savings, cards and loans, to look at and
 * change in one place, in three blocks that open and close, always in the
 * same order. Home and History open these same records, so a change made
 * anywhere shows everywhere. Reports & Backup are in Settings, linked at
 * the end.
 */
export function MoneyScreen(props: MoneyScreenProps) {
  const { isDemo, view, onViewChange } = props
  const [message, setMessage] = useState('')
  const say = (done: string, outcome: SaveOutcome) => setMessage(outcomeText(done, outcome))
  const sectionProps = { ...props, say, tell: setMessage }
  return (
    <div className="tab-screen">
      <div className="data-head">
        <h1 className="tab-title">Money</h1>
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
      <MoneyBlocksContext.Provider value={{ view, onViewChange }}>
        <div className="data-blocks">
          <IncomeSection {...sectionProps} />
          <AccountsSection {...sectionProps} />
          <CardsLoansSection {...sectionProps} />
        </div>
      </MoneyBlocksContext.Provider>
      <section className="block" aria-labelledby="money-reports">
        <h2 id="money-reports" className="section-title">Reports &amp; Backup</h2>
        <p className="field-help">{isDemo ? 'The PDF report and the backup file are in Settings.' : 'The PDF report, the backup file and Restore Backup are in Settings.'}</p>
        <button type="button" className="button-small align-start" onClick={props.onOpenReports}>Open Reports &amp; Backup <Icon name="arrowRight" size={16} /></button>
      </section>
    </div>
  )
}

/** What each section gets: the screen's props, `say` to show a message after a change, and `tell` for a message with no change. */
export type SectionProps = MoneyScreenProps & { say: (done: string, outcome: SaveOutcome) => void; tell: (text: string) => void }

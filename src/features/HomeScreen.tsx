import type { YearMonth } from '../domain/calendar'
import type { ConfirmedGoal } from '../domain/goal'
import type { CalendarDate } from '../domain/goalTime'
import { monthlyOverview } from '../domain/finance/overview'
import type { FinanceData } from '../domain/finance/types'
import { formatAmount } from '../ui/format'
import { BillsByCategory } from './home/BillsByCategory'
import { OurGoals } from './home/OurGoals'
import { OurMoney } from './home/OurMoney'
import { OutstandingDebt } from './home/OutstandingDebt'
import { YearlyNetIncome } from './home/YearlyNetIncome'
import { MonthSwitch } from './MonthSwitch'

type Props = {
  data: FinanceData
  months: YearMonth[]
  month: YearMonth
  onMonthChange: (month: YearMonth) => void
  confirmedGoal: ConfirmedGoal | null
  today: CalendarDate
  onOpen: (screen: 'bills' | 'cards' | 'data' | 'goals') => void
}

/**
 * Home, as in Demo v5.9 and in its order: Monthly Overview, Outstanding
 * Debt, Monthly Bills · By Category, Our Money, Our Goals and, last,
 * Yearly Net Income. Every number is worked out from the space's data on
 * each render, so it follows any change made in another tab.
 */
export function HomeScreen({ data, months, month, onMonthChange, confirmedGoal, today, onOpen }: Props) {
  const overview = monthlyOverview(data, month)
  const money = (minor: number) => formatAmount(minor, data.space.currency)
  const hasIncome = data.income.some(entry => entry.month === month)
  const individual = data.space.mode === 'individual'

  return (
    <div className="tab-screen">
      <h1 className="visually-hidden">Home</h1>
      <MonthSwitch months={months} value={month} onChange={onMonthChange} />
      <section className="stat-grid" aria-label="Monthly Overview">
        <button type="button" className="stat" onClick={() => onOpen('data')}><small>{individual ? 'Income' : 'Household Income'}</small><b>{hasIncome ? money(overview.householdIncome) : '—'}</b></button>
        <button type="button" className="stat" onClick={() => onOpen('bills')}><small>Monthly Commitments</small><b>{money(overview.monthlyCommitments)}</b></button>
        <button type="button" className="stat" onClick={() => onOpen('bills')}>
          <small>Monthly Left to Pay</small><b>{money(overview.leftToPay)}</b>{overview.unknownBillCount > 0 && <small>+ unknown amount</small>}
        </button>
        <button type="button" className="stat" onClick={() => onOpen('cards')}><small>Total Debt</small><b>{money(overview.totalDebt)}</b></button>
      </section>
      <OutstandingDebt data={data} />
      <BillsByCategory data={data} month={month} />
      <OurMoney data={data} title={individual ? 'My Money' : 'Our Money'} />
      <OurGoals data={data} title={individual ? 'My Goals' : 'Our Goals'} today={today} confirmedGoal={confirmedGoal} onOpenPlanner={() => onOpen('goals')} />
      <YearlyNetIncome data={data} year={Number(today.slice(0, 4))} />
    </div>
  )
}

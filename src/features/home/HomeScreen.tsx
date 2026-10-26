import type { YearMonth } from '../../domain/calendar'
import type { CalendarDate } from '../../domain/goalTime'
import { monthEnd } from '../../domain/finance/spending'
import type { FinanceData, Id } from '../../domain/finance/types'
import type { BillsChartView } from '../../data/uiPrefs'
import { AllAmountsToggle } from '../../ui/privacy'
import type { SaveOutcome } from '../../ui/saveOutcome'
import { LeftToPay } from './LeftToPay'
import { MonthSummary } from './MonthSummary'
import { SpendingByCategory } from './SpendingByCategory'
import { HomeGoals } from './HomeGoals'
import { HomeMoney } from './HomeMoney'
import { TotalDebt } from './TotalDebt'
import { YearSummary } from './YearSummary'
import { MonthSwitch } from '../../components/MonthSwitch'

type Props = {
  data: FinanceData
  months: YearMonth[]
  month: YearMonth
  onMonthChange: (month: YearMonth) => void
  today: CalendarDate
  chartView: BillsChartView
  onChartViewChange: (view: BillsChartView) => void
  onChange: (change: (data: FinanceData) => FinanceData) => SaveOutcome
  onOpen: (screen: 'bills' | 'cards' | 'data' | 'goals' | 'history') => void
  onOpenGoal: (id: Id) => void
  onAddGoal: () => void
  onOpenDebt: (id: Id) => void
  onOpenBill: (id: Id) => void
  onOpenExpense: (id: Id) => void
  emergencyLater: boolean
  onEmergencyLater: () => void
  onReviewEmergency: () => void
}

/**
 * Home, in the order of the questions it answers:
 * 1. How is my month? 2. What do I still have to pay? 3. Where did my
 * money go? 4. How much do I owe? 5. What money do I have? 6. What am I
 * saving for? The Year Summary stays last. Every number is worked out
 * from the space's records on each render, so it follows any change made
 * anywhere else. Balances are the ones entered by the end of the month
 * shown (or today, for the month still going): never worked back from
 * today's balance.
 */
export function HomeScreen(props: Props) {
  const { data, months, month, onMonthChange, today, onOpen } = props
  const individual = data.space.mode === 'individual'
  const asOf = monthEnd(month) < today ? monthEnd(month) : today

  return (
    <div className="tab-screen">
      <h1 className="visually-hidden">Home</h1>
      <MonthSwitch months={months} value={month} onChange={onMonthChange} />
      <AllAmountsToggle />
      <MonthSummary data={data} month={month} today={today} onOpenIncome={() => onOpen('data')} onOpenBills={() => onOpen('bills')} onOpenHistory={() => onOpen('history')} />
      <LeftToPay data={data} month={month} today={today} onOpenBills={() => onOpen('bills')} onOpenBill={props.onOpenBill} />
      <SpendingByCategory data={data} month={month} today={today} view={props.chartView} onViewChange={props.onChartViewChange} onChange={props.onChange}
        onOpenBill={props.onOpenBill} onOpenExpense={props.onOpenExpense} />
      <TotalDebt data={data} asOf={asOf} onOpenDebt={props.onOpenDebt} onOpenCards={() => onOpen('cards')} />
      <HomeMoney data={data} title={individual ? 'My Money' : 'Our Money'} asOf={asOf} onOpenGoal={props.onOpenGoal} onOpenData={() => onOpen('data')} />
      <HomeGoals data={data} title={individual ? 'My Goals' : 'Our Goals'} asOf={asOf} emergencyLater={props.emergencyLater}
        onEmergencyLater={props.onEmergencyLater} onReviewEmergency={props.onReviewEmergency}
        onViewAll={() => onOpen('goals')} onAddGoal={props.onAddGoal} onOpenGoal={props.onOpenGoal} />
      <YearSummary data={data} year={Number(month.slice(0, 4))} today={today} month={month} onSelectMonth={onMonthChange} />
    </div>
  )
}

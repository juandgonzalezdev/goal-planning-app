import type { YearMonth } from '../../domain/calendar'
import type { ConfirmedGoal } from '../../domain/goal'
import type { CalendarDate } from '../../domain/goalTime'
import { monthlyOverview } from '../../domain/finance/overview'
import type { FinanceData, Id } from '../../domain/finance/types'
import type { BillsChartView } from '../../data/uiPrefs'
import type { SaveOutcome } from '../../ui/saveOutcome'
import { BillsByCategory } from './BillsByCategory'
import { LeftToPay } from './LeftToPay'
import { MonthOverview } from './MonthOverview'
import { OurGoals, PlannerSection } from './OurGoals'
import { OurMoney } from './OurMoney'
import { TotalDebt } from './TotalDebt'
import { YearlyNetIncome } from './YearlyNetIncome'
import { MonthSwitch } from '../../components/MonthSwitch'

type Props = {
  data: FinanceData
  months: YearMonth[]
  month: YearMonth
  onMonthChange: (month: YearMonth) => void
  confirmedGoal: ConfirmedGoal | null
  plannedGoalSaved: boolean
  today: CalendarDate
  chartView: BillsChartView
  onChartViewChange: (view: BillsChartView) => void
  onChange: (change: (data: FinanceData) => FinanceData) => SaveOutcome
  onOpen: (screen: 'bills' | 'cards' | 'data' | 'goals' | 'planner') => void
  onOpenGoal: (id: Id) => void
  onAddGoal: () => void
  onOpenDebt: (id: Id) => void
  onOpenBill: (id: Id) => void
  onSavePlannedGoal: () => void
}

/**
 * Home, in the order of the questions it answers:
 * 1. How is my month? 2. What do I still have to pay? 3. What are my bills
 * for? 4. How much do I owe? 5. What money do I have? 6. What am I saving
 * for? 7. How can I plan another goal? Yearly Net Income stays last, as in
 * Demo v5.9. Every number is worked out from the space's records on each
 * render, so it follows any change made anywhere else.
 */
export function HomeScreen(props: Props) {
  const { data, months, month, onMonthChange, today, onOpen } = props
  const overview = monthlyOverview(data, month)
  const individual = data.space.mode === 'individual'

  return (
    <div className="tab-screen">
      <h1 className="visually-hidden">Home</h1>
      <MonthSwitch months={months} value={month} onChange={onMonthChange} />
      <MonthOverview overview={overview} currency={data.space.currency} onOpenIncome={() => onOpen('data')} onOpenBills={() => onOpen('bills')} />
      <LeftToPay overview={overview} month={month} currency={data.space.currency} onOpenBills={() => onOpen('bills')} />
      <BillsByCategory data={data} month={month} view={props.chartView} onViewChange={props.onChartViewChange} onChange={props.onChange} onOpenBill={props.onOpenBill} />
      <TotalDebt data={data} onOpenDebt={props.onOpenDebt} onOpenCards={() => onOpen('cards')} />
      <OurMoney data={data} title={individual ? 'My Money' : 'Our Money'} onOpenGoal={props.onOpenGoal} onOpenData={() => onOpen('data')} />
      <OurGoals data={data} title={individual ? 'My Goals' : 'Our Goals'} today={today}
        onViewAll={() => onOpen('goals')} onAddGoal={props.onAddGoal} onOpenGoal={props.onOpenGoal} />
      <PlannerSection confirmedGoal={props.confirmedGoal} currency={data.space.currency} today={today} savedAsGoal={props.plannedGoalSaved}
        onOpenPlanner={() => onOpen('planner')} onSaveAsGoal={props.onSavePlannedGoal} />
      <YearlyNetIncome data={data} year={Number(today.slice(0, 4))} />
    </div>
  )
}

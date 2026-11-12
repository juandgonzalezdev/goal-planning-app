import type { FinanceData, Owner } from '../../domain/finance/types'
import type { CalendarDate } from '../../domain/goalTime'
import type { ChangeSpace } from '../../ui/saveOutcome'

/** What a Getting Started stage with a form gets: the same records, owner and save as Money. */
export type StageProps = {
  data: FinanceData
  today: CalendarDate
  /** Who a new record belongs to: the person in an Individual space, `shared` in a Duo (as in Money). */
  owner: Owner
  newId: () => string
  onChange: ChangeSpace
}

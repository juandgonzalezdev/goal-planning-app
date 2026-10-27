import type { YearMonth } from '../domain/calendar'
import { formatYearMonth } from '../ui/format'
import { Icon } from './Icon'

/**
 * The month above Home, Bills, Cards and their detail screens: previous
 * and next buttons and a list of the months that can be shown. Changing
 * the month never changes any record. A month opened from a link outside
 * the list (an older bill payment in History) is shown as it is, and the
 * arrows lead back into the list.
 */
export function MonthSwitch({ months, value, onChange }: { months: YearMonth[]; value: YearMonth; onChange: (month: YearMonth) => void }) {
  const index = months.indexOf(value)
  const outside = index < 0
  const previous = outside ? [...months].reverse().find(month => month < value) : months[index - 1]
  const next = outside ? months.find(month => month > value) : months[index + 1]
  return (
    <div className="month-picker" role="group" aria-label="Month">
      <button type="button" className="icon-button" aria-label="Previous month" disabled={!previous} onClick={() => previous && onChange(previous)}>
        <Icon name="chevronLeft" size={20} />
      </button>
      <select aria-label="Month" value={value} onChange={event => onChange(event.target.value)}>
        {outside && <option value={value}>{formatYearMonth(value)}</option>}
        {months.map(month => <option key={month} value={month}>{formatYearMonth(month)}</option>)}
      </select>
      <button type="button" className="icon-button" aria-label="Next month" disabled={!next} onClick={() => next && onChange(next)}>
        <Icon name="chevronRight" size={20} />
      </button>
    </div>
  )
}

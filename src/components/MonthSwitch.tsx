import type { YearMonth } from '../domain/calendar'
import { formatYearMonth } from '../ui/format'
import { Icon } from './Icon'

/**
 * The month above Home and Bills: previous and next buttons and a list of
 * the months that can be shown. Changing the month never changes any record.
 */
export function MonthSwitch({ months, value, onChange }: { months: YearMonth[]; value: YearMonth; onChange: (month: YearMonth) => void }) {
  const index = months.indexOf(value)
  return (
    <div className="month-picker" role="group" aria-label="Month">
      <button type="button" className="icon-button" aria-label="Previous month" disabled={index <= 0} onClick={() => onChange(months[index - 1])}>
        <Icon name="chevronLeft" size={20} />
      </button>
      <select aria-label="Month" value={value} onChange={event => onChange(event.target.value)}>
        {months.map(month => <option key={month} value={month}>{formatYearMonth(month)}</option>)}
      </select>
      <button type="button" className="icon-button" aria-label="Next month" disabled={index < 0 || index >= months.length - 1} onClick={() => onChange(months[index + 1])}>
        <Icon name="chevronRight" size={20} />
      </button>
    </div>
  )
}

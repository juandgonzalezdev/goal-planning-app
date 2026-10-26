import type { YearMonth } from '../domain/calendar'
import { formatYearMonth } from '../ui/format'

/** The month buttons above Home and Bills, as in v5.9. */
export function MonthSwitch({ months, value, onChange }: { months: YearMonth[]; value: YearMonth; onChange: (month: YearMonth) => void }) {
  return (
    <div className="month-switch" role="group" aria-label="Month">
      {months.map(month => (
        <button key={month} type="button" aria-pressed={month === value} className={month === value ? 'is-active' : ''} onClick={() => onChange(month)}>
          {formatYearMonth(month)}
        </button>
      ))}
    </div>
  )
}

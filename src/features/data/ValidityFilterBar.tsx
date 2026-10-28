import type { CalendarDate } from '../../domain/goalTime'
import { VALIDITY_NAMES, type Validity, type ValidityFilter } from '../../domain/finance/validity'
import { referenceDay } from '../../ui/format'

type Props = {
  /** What is filtered, for screen readers: "Income sources" or "Bills". */
  label: string
  value: ValidityFilter
  counts: Record<ValidityFilter, number>
  onChange: (filter: ValidityFilter) => void
  today: CalendarDate
  isDemo: boolean
}

/**
 * Active / Upcoming / Ended / All, with how many there are of each.
 * Upcoming only appears when something starts later. The filter only
 * hides lines on screen: no record is changed or removed.
 */
export function ValidityFilterBar({ label, value, counts, onChange, today, isDemo }: Props) {
  const options: ValidityFilter[] = ['active', ...(counts.upcoming > 0 ? ['upcoming' as const] : []), 'ended', 'all']
  return (
    <div className="validity-filter">
      <div className="segmented" role="group" aria-label={`Show ${label.toLowerCase()}`}>
        {options.map(option => (
          <button key={option} type="button" aria-pressed={value === option} className={value === option ? 'is-active' : ''} onClick={() => onChange(option)}>
            {option === 'all' ? 'All' : VALIDITY_NAMES[option]} <span className="filter-count">{counts[option]}</span>
          </button>
        ))}
      </div>
      <small className="muted-note">Active, Upcoming and Ended are worked out for {referenceDay(today, isDemo)}.</small>
    </div>
  )
}

/** A small tag with the status of one line. */
export function ValidityTag({ validity }: { validity: Validity }) {
  return <span className={`validity-tag is-${validity}`}>{VALIDITY_NAMES[validity]}</span>
}

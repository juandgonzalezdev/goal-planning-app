import { MONTH_NAMES_LONG } from '../ui/format'

type Props = {
  /** Id of the month list; the year list gets `${id}-year`. A link to the field (an error) focuses the month. */
  id: string
  label: string
  /** 'YYYY-MM', or '' for no month (only when `noneLabel` is given). */
  value: string
  onChange: (value: string) => void
  /** The years offered, earliest first. The value's own year is always added. */
  years: number[]
  /** When given, the month list starts with this choice (e.g. "No end month"), which means ''. */
  noneLabel?: string
  /** The year a month gets when it is chosen from "none". */
  defaultYear: number
  error?: string
  help?: string
}

/**
 * A month and a year chosen from two lists drawn by the app, so their names
 * are always in the app's language (the browser's own month field shows
 * the device's language, e.g. Spanish on a Spanish Windows).
 */
export function MonthYearField({ id, label, value, onChange, years, noneLabel, defaultYear, error, help }: Props) {
  const year = value ? Number(value.slice(0, 4)) : null
  const month = value ? Number(value.slice(5, 7)) : null
  const yearOptions = year !== null && !years.includes(year) ? [...years, year].sort((a, b) => a - b) : years
  const describedBy = [help ? `${id}-help` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined
  const write = (nextYear: number, nextMonth: number) => onChange(`${String(nextYear).padStart(4, '0')}-${String(nextMonth).padStart(2, '0')}`)
  return (
    <fieldset className="form-field month-year-field">
      <legend>{label}</legend>
      <div className="month-year-inputs">
        <select id={id} aria-label={`${label}: month`} value={month ?? ''} aria-invalid={!!error} aria-describedby={describedBy}
          onChange={event => (event.target.value === '' ? onChange('') : write(year ?? defaultYear, Number(event.target.value)))}>
          {noneLabel !== undefined && <option value="">{noneLabel}</option>}
          {MONTH_NAMES_LONG.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
        </select>
        {value !== '' && (
          <select id={`${id}-year`} aria-label={`${label}: year`} value={year ?? ''} aria-invalid={!!error} aria-describedby={describedBy}
            onChange={event => write(Number(event.target.value), month ?? 1)}>
            {yearOptions.map(option => <option key={option} value={option}>{option}</option>)}
          </select>
        )}
      </div>
      {help && <p id={`${id}-help`} className="field-help">{help}</p>}
      {error && <p id={`${id}-error`} className="field-error">{error}</p>}
    </fieldset>
  )
}

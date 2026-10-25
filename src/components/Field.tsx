import type { HTMLAttributes, ReactNode } from 'react'

type Props = {
  id: string
  label: ReactNode
  value: string
  onChange: (value: string) => void
  error?: string
  help?: string
  type?: 'text' | 'date' | 'month' | 'number'
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode']
  min?: string
  max?: string
  maxLength?: number
}

/** A labelled input with its help and error text tied to it for screen readers. */
export function Field({ id, label, value, onChange, error, help, type = 'text', inputMode, min, max, maxLength }: Props) {
  const describedBy = [help ? `${id}-help` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type={type} inputMode={inputMode} value={value} min={min} max={max} maxLength={maxLength}
        aria-invalid={!!error} aria-describedby={describedBy} onChange={event => onChange(event.target.value)} />
      {help && <p id={`${id}-help`} className="field-help">{help}</p>}
      {error && <p id={`${id}-error`} className="field-error">{error}</p>}
    </div>
  )
}

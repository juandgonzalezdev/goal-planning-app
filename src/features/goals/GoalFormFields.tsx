import { GOAL_NAME_MAX_LENGTH } from '../../domain/goal'
import type { CurrencyCode } from '../../domain/money'
import type { GoalDraft, GoalDraftErrors } from './goalDraft'

type Props = {
  idPrefix: string
  draft: GoalDraft
  errors: GoalDraftErrors
  currency: CurrencyCode
  onChange: (draft: GoalDraft) => void
}

/** The short v5.9 goal form: name, target, and Flexible or With Date. Used to create and to edit. */
export function GoalFormFields({ idPrefix, draft, errors, currency, onChange }: Props) {
  const set = (patch: Partial<GoalDraft>) => onChange({ ...draft, ...patch })
  const error = (field: keyof GoalDraftErrors) => errors[field] && <p id={`${idPrefix}-${field}-error`} className="field-error">{errors[field]}</p>
  const described = (field: keyof GoalDraftErrors) => (errors[field] ? `${idPrefix}-${field}-error` : undefined)

  const id = (field: string) => `${idPrefix}-${field}`
  return (
    <div className="form-stack">
      <div className="form-field">
        <label htmlFor={id('name')}>What are you saving for?</label>
        <input id={id('name')} value={draft.name} maxLength={GOAL_NAME_MAX_LENGTH + 20} aria-invalid={!!errors.name} aria-describedby={described('name')}
          onChange={e => set({ name: e.target.value })} />
        {error('name')}
      </div>
      <div className="form-field">
        <label htmlFor={id('target')}>Target Amount ({currency})</label>
        <input id={id('target')} inputMode="decimal" value={draft.target} aria-invalid={!!errors.target} aria-describedby={described('target')}
          onChange={e => set({ target: e.target.value })} />
        {error('target')}
      </div>
      <div className="form-field">
        <label htmlFor={id('dated')}>Deadline</label>
        <select id={id('dated')} value={draft.dated ? 'dated' : 'flexible'} onChange={e => set({ dated: e.target.value === 'dated' })}>
          <option value="flexible">No Deadline</option>
          <option value="dated">With Date</option>
        </select>
      </div>
      {draft.dated && (
        <div className="form-field">
          <label htmlFor={id('deadline')}>Target Date</label>
          <input id={id('deadline')} type="date" value={draft.deadline} aria-invalid={!!errors.deadline} aria-describedby={described('deadline')}
            onChange={e => set({ deadline: e.target.value })} />
          {error('deadline')}
        </div>
      )}
    </div>
  )
}

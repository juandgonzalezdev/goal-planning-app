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

/** The short v5.9 goal form: name, an optional target, and Flexible or With Date. Used to create and to edit. */
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
        <label htmlFor={id('target')}>Target Amount ({currency}, optional)</label>
        <input id={id('target')} inputMode="decimal" value={draft.target} aria-invalid={!!errors.target} aria-describedby={[id('target-help'), described('target')].filter(Boolean).join(' ')}
          onChange={e => set({ target: e.target.value })} />
        <p id={id('target-help')} className="field-help">Leave it empty to save with no fixed amount. A target date needs a target.</p>
        {error('target')}
      </div>
      <div className="form-field">
        <label htmlFor={id('dated')}>Deadline</label>
        <select id={id('dated')} aria-describedby={id('dated-help')} value={draft.dated ? 'dated' : 'flexible'} onChange={e => set({ dated: e.target.value === 'dated' })}>
          <option value="flexible">Flexible (no deadline)</option>
          <option value="dated">With Date</option>
        </select>
        <p id={id('dated-help')} className="field-help">
          {draft.dated ? 'With Date: a target date, and a suggested weekly or monthly amount to reach it. Only a suggestion: nothing is committed.' : 'Flexible: no target date and no pace. Save at your own rhythm.'}
        </p>
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

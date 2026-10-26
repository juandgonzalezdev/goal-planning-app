import { useState } from 'react'
import { Icon, type IconName } from '../../components/Icon'
import { MEMBER_NAME_MAX_LENGTH, validateSetup, type SetupError } from '../../domain/finance/space'
import type { SpaceMode, Theme } from '../../domain/finance/types'
import { CURRENCIES, type CurrencyCode } from '../../domain/money'
import { setupFromDraft, type SetupDraft } from './setupDraft'

const STEPS = ['Your Profile', 'Your Plan', 'Your Preferences', 'Privacy & Terms'] as const

const MODES: { mode: SpaceMode; icon: IconName; name: string; text: string; available: boolean }[] = [
  { mode: 'individual', icon: 'person', name: 'Individual', text: 'Your own money and goals.', available: true },
  { mode: 'duo', icon: 'duo', name: 'Duo', text: 'Two people sharing one space.', available: true },
  { mode: 'group', icon: 'group', name: 'Group', text: 'For families and groups.', available: false },
]

const ERROR_TEXT: Record<SetupError, string> = {
  'name-required': 'Enter your name.',
  'name-too-long': `Use ${MEMBER_NAME_MAX_LENGTH} characters or fewer.`,
  'second-name-required': 'Enter the second person\'s name.',
  'second-name-too-long': `Use ${MEMBER_NAME_MAX_LENGTH} characters or fewer.`,
  'mode-not-available': 'This option is not available yet.',
}

type Props = { draft: SetupDraft; onChange: (draft: SetupDraft) => void; onBack: () => void; onFinish: () => void }

/** Welcome Setup: four steps that create the user's own, empty space on this device. */
export function WelcomeSetup({ draft, onChange, onBack, onFinish }: Props) {
  const [showErrors, setShowErrors] = useState(false)
  const set = (change: Partial<SetupDraft>) => onChange({ ...draft, ...change })
  const errors = validateSetup(setupFromDraft(draft))
  const stepErrors = errors.filter(error => (draft.step === 0 ? error.startsWith('name') : draft.step === 1 && !error.startsWith('name')))
  const errorFor = (prefix: 'name' | 'second-name') => (showErrors ? stepErrors.find(error => error.startsWith(`${prefix}-`)) : undefined)

  const next = () => {
    if (stepErrors.length > 0) { setShowErrors(true); return }
    setShowErrors(false)
    if (draft.step < STEPS.length - 1) set({ step: draft.step + 1 })
    else onFinish()
  }
  const previous = () => {
    setShowErrors(false)
    if (draft.step === 0) onBack()
    else set({ step: draft.step - 1 })
  }

  const nameError = errorFor('name')
  const partnerError = errorFor('second-name')

  return (
    <div className="screen-column">
      <button type="button" className="back-link" onClick={previous}><Icon name="arrowLeft" size={18} /> Back</button>
      <p className="step-count">Welcome Setup · Step {draft.step + 1} of {STEPS.length}</p>
      <h1 className="screen-title">{STEPS[draft.step]}</h1>

      {draft.step === 0 && <>
        <p className="screen-lead">This is how you appear in your space.</p>
        <label className="form-field">Display Name
          <input value={draft.name} maxLength={80} autoComplete="given-name" aria-invalid={!!nameError} aria-describedby={nameError ? 'setup-name-error' : undefined} onChange={event => set({ name: event.target.value })} />
        </label>
        {nameError && <p id="setup-name-error" className="field-error">{ERROR_TEXT[nameError]}</p>}
      </>}

      {draft.step === 1 && <>
        <p className="screen-lead">Who will use this space? You can only choose this when you create it.</p>
        <fieldset className="choice-list">
          <legend className="visually-hidden">Space type</legend>
          {MODES.map(option => (
            <label key={option.mode} className={`choice-card${option.available ? '' : ' is-unavailable'}`}>
              <input type="radio" name="space-mode" value={option.mode} checked={draft.mode === option.mode} disabled={!option.available} onChange={() => set({ mode: option.mode })} aria-describedby={`mode-${option.mode}-text`} />
              <Icon name={option.icon} size={22} />
              <span className="choice-body">
                <span className="choice-name">{option.name}{!option.available && <span className="badge">Coming soon</span>}</span>
                <span id={`mode-${option.mode}-text`} className="choice-text">{option.text}</span>
              </span>
              <span className="choice-check" aria-hidden="true">{draft.mode === option.mode && <Icon name="check" size={16} />}</span>
            </label>
          ))}
        </fieldset>
        {draft.mode === 'duo' && <>
          <label className="form-field form-field-spaced">Second Person's Name
            <input value={draft.partner} maxLength={80} aria-invalid={!!partnerError} aria-describedby={partnerError ? 'setup-partner-error' : undefined} onChange={event => set({ partner: event.target.value })} />
          </label>
          {partnerError && <p id="setup-partner-error" className="field-error">{ERROR_TEXT[partnerError]}</p>}
          <div className="callout callout-warning">
            <p><strong>No private information between members yet.</strong> For now, Duo works on this device only. Everyone who uses it can see everything in the space.</p>
          </div>
        </>}
      </>}

      {draft.step === 2 && <>
        <p className="screen-lead">You can change language and appearance later in Settings.</p>
        <div className="form-stack">
          <label className="form-field">Currency
            <select value={draft.currency} onChange={event => set({ currency: event.target.value as CurrencyCode })}>
              {CURRENCIES.map(currency => <option key={currency} value={currency}>{currency}</option>)}
            </select>
          </label>
          <p className="field-help">Every amount in your space uses this currency. Amounts are never converted.</p>
          <LanguageSelect />
          <ThemeSelect value={draft.theme} onChange={theme => set({ theme })} />
        </div>
      </>}

      {draft.step === 3 && <>
        <p className="screen-lead">Before you start, here is what this version does with your information.</p>
        <PrivacyFacts />
        <p className="screen-note">This is not a legal agreement. Terms of Service and a Privacy Policy will be available before real accounts exist.</p>
      </>}

      <div className="screen-actions">
        <button type="button" className="button-primary" onClick={next}>
          {draft.step < STEPS.length - 1 ? <>Continue <Icon name="arrowRight" size={18} /></> : 'Create My Space'}
        </button>
      </div>
    </div>
  )
}

/** Only English works today; the other languages are listed so people can see they are planned. */
export function LanguageSelect() {
  return (
    <label className="form-field">Language
      <select value="en" onChange={() => undefined}>
        <option value="en">English</option>
        <option value="es" disabled>Español (coming soon)</option>
        <option value="pl" disabled>Polski (coming soon)</option>
      </select>
    </label>
  )
}

export function ThemeSelect({ value, onChange }: { value: Theme; onChange: (theme: Theme) => void }) {
  return <>
    <label className="form-field">Appearance
      <select value={value === 'day-night' ? 'system' : value} onChange={event => onChange(event.target.value as Theme)}>
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="day-night" disabled>Day/Night (coming soon)</option>
      </select>
    </label>
    <p className="field-help">System follows your device's setting.</p>
  </>
}

/** What this version really does with information. Shown in setup and in Settings. */
export function PrivacyFacts() {
  return (
    <ul className="fact-list">
      <li>Your space is saved only in this browser, on this device. There is no account and no server.</li>
      <li>This is not secure storage: anyone who can use this browser can see it. Avoid shared devices.</li>
      <li>Nothing is sent anywhere, and there is no bank connection.</li>
      <li>You can erase everything at any time in Settings.</li>
    </ul>
  )
}

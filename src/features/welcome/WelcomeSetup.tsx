import { useState } from 'react'
import { Icon, type IconName } from '../../components/Icon'
import { MEMBER_NAME_MAX_LENGTH, validateSetup, type SetupError } from '../../domain/finance/space'
import type { Language, SpaceMode, Theme } from '../../domain/finance/types'
import { useT, type MessageKey } from '../../i18n'
import { canChoose, LANGUAGE_NAMES, LANGUAGES } from '../../i18n/languages'
import { CURRENCIES, type CurrencyCode } from '../../domain/money'
import { outcomeText, type SaveOutcome } from '../../ui/saveOutcome'
import { setupFromDraft, type SetupDraft } from './setupDraft'

const STEPS = ['setup.profile', 'setup.plan', 'setup.preferences', 'setup.privacy'] as const satisfies readonly MessageKey[]

const MODES: { mode: SpaceMode; icon: IconName; name: MessageKey; text: MessageKey; available: boolean }[] = [
  { mode: 'individual', icon: 'person', name: 'mode.individual', text: 'setup.individualText', available: true },
  { mode: 'duo', icon: 'duo', name: 'mode.duo', text: 'setup.duoText', available: true },
  { mode: 'group', icon: 'group', name: 'mode.group', text: 'setup.groupText', available: false },
]

const ERROR_TEXT: Record<SetupError, MessageKey> = {
  'name-required': 'setup.errorName',
  'name-too-long': 'setup.errorTooLong',
  'second-name-required': 'setup.errorSecondName',
  'second-name-too-long': 'setup.errorTooLong',
  'mode-not-available': 'setup.errorMode',
}

type Props = {
  draft: SetupDraft
  onChange: (draft: SetupDraft) => void
  onBack: () => void
  onFinish: () => void
  /** The space is being created: Create My Space says so and is not sent twice. */
  saving?: boolean
  /** Why the space was not created, if it was not. The steps keep what was entered. */
  outcome?: SaveOutcome | null
}

/**
 * Welcome Setup: four steps that create the user's own, empty space on this device.
 * The app keeps the draft (and counts it as typed) while the user looks elsewhere.
 */

export function WelcomeSetup({ draft, onChange, onBack, onFinish, saving = false, outcome = null }: Props) {
  const { t } = useT()
  const [showErrors, setShowErrors] = useState(false)
  const set = (change: Partial<SetupDraft>) => onChange({ ...draft, ...change })
  const errors = validateSetup(setupFromDraft(draft))
  const stepErrors = errors.filter(error => (draft.step === 0 ? error.startsWith('name') : draft.step === 1 && !error.startsWith('name')))
  const errorFor = (prefix: 'name' | 'second-name') => (showErrors ? stepErrors.find(error => error.startsWith(`${prefix}-`)) : undefined)

  const next = () => {
    if (saving) return
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
      <button type="button" className="back-link" onClick={previous}><Icon name="arrowLeft" size={18} /> {t('nav.back')}</button>
      <p className="step-count">{t('setup.step', { step: draft.step + 1, total: STEPS.length })}</p>
      <h1 className="screen-title">{t(STEPS[draft.step])}</h1>

      {draft.step === 0 && <>
        <p className="screen-lead">{t('setup.profileLead')}</p>
        <label className="form-field">{t('setup.displayName')}
          <input value={draft.name} maxLength={80} autoComplete="given-name" aria-invalid={!!nameError} aria-describedby={nameError ? 'setup-name-error' : undefined} onChange={event => set({ name: event.target.value })} />
        </label>
        {nameError && <p id="setup-name-error" className="field-error">{t(ERROR_TEXT[nameError], { max: MEMBER_NAME_MAX_LENGTH })}</p>}
      </>}

      {draft.step === 1 && <>
        <p className="screen-lead">{t('setup.planLead')}</p>
        <fieldset className="choice-list">
          <legend className="visually-hidden">{t('setup.spaceType')}</legend>
          {MODES.map(option => (
            <label key={option.mode} className={`choice-card${option.available ? '' : ' is-unavailable'}`}>
              <input type="radio" name="space-mode" value={option.mode} checked={draft.mode === option.mode} disabled={!option.available} onChange={() => set({ mode: option.mode })} aria-describedby={`mode-${option.mode}-text`} />
              <Icon name={option.icon} size={22} />
              <span className="choice-body">
                <span className="choice-name">{t(option.name)}{!option.available && <span className="badge">{t('common.comingSoon')}</span>}</span>
                <span id={`mode-${option.mode}-text`} className="choice-text">{t(option.text)}</span>
              </span>
              <span className="choice-check" aria-hidden="true">{draft.mode === option.mode && <Icon name="check" size={16} />}</span>
            </label>
          ))}
        </fieldset>
        {draft.mode === 'duo' && <>
          <label className="form-field form-field-spaced">{t('setup.partner')}
            <input value={draft.partner} maxLength={80} aria-invalid={!!partnerError} aria-describedby={partnerError ? 'setup-partner-error' : undefined} onChange={event => set({ partner: event.target.value })} />
          </label>
          {partnerError && <p id="setup-partner-error" className="field-error">{t(ERROR_TEXT[partnerError], { max: MEMBER_NAME_MAX_LENGTH })}</p>}
          <div className="callout callout-warning">
            <p><strong>{t('setup.duoWarningTitle')}</strong> {t('setup.duoWarning')}</p>
          </div>
        </>}
      </>}

      {draft.step === 2 && <>
        <p className="screen-lead">{t('setup.preferencesLead')}</p>
        <div className="form-stack">
          <label className="form-field">{t('setup.currency')}
            <select value={draft.currency} onChange={event => set({ currency: event.target.value as CurrencyCode })}>
              {CURRENCIES.map(currency => <option key={currency} value={currency}>{currency}</option>)}
            </select>
          </label>
          <p className="field-help">{t('setup.currencyHelp')}</p>
          <ThemeSelect value={draft.theme} onChange={theme => set({ theme })} />
        </div>
      </>}

      {draft.step === 3 && <>
        <p className="screen-lead">{t('setup.privacyLead')}</p>
        <PrivacyFacts />
        <p className="screen-note">{t('setup.notLegal')}</p>
      </>}

      {draft.step === STEPS.length - 1 && outcome && <p className="field-error" role="alert">{outcome === 'conflict'
        ? t('setup.conflict')
        : outcomeText('', outcome)}</p>}
      <div className="screen-actions">
        <button type="button" className="button-primary" onClick={next} aria-disabled={saving || undefined}>
          {draft.step < STEPS.length - 1 ? <>{t('common.continue')} <Icon name="arrowRight" size={18} /></> : saving ? t('common.saving') : t('setup.create')}
        </button>
      </div>
    </div>
  )
}

/**
 * The language list (Phase B1). Each language is written in its own name. Spanish and Polish are "coming soon"
 * until every screen is translated (Phase B6), unless the preview is on for this device. The choice applies at once.
 */
export function LanguageSelect({ value, onChange, preview = false, compact = false }: { value: Language; onChange?: (language: Language) => void; preview?: boolean; compact?: boolean }) {
  const { t } = useT()
  return <>
    <label className={compact ? 'welcome-language-control' : 'form-field'}>
      {compact ? <>
        <span className="visually-hidden">{t('language.label')}</span>
        <Icon name="globe" size={18} />
        <span aria-hidden="true">{value.toUpperCase()}</span>
        <Icon name="chevronDown" size={14} />
      </> : t('language.label')}
      <select value={value} aria-label={t('language.label')} aria-describedby={compact ? undefined : 'language-help'} onChange={event => onChange?.(event.target.value as Language)}>
        {LANGUAGES.map(option => (canChoose(option, preview, value)
          ? <option key={option} value={option} lang={option}>{LANGUAGE_NAMES[option]}</option>
          : <option key={option} value={option} disabled>{t('language.comingSoon', { language: LANGUAGE_NAMES[option] })}</option>))}
      </select>
    </label>
    {!compact && <p id="language-help" className="field-help">{t('language.help')}</p>}
  </>
}

export function ThemeSelect({ value, onChange }: { value: Theme; onChange: (theme: Theme) => void }) {
  const { t } = useT()
  return <>
    <label className="form-field">{t('appearance.label')}
      <select value={value === 'day-night' ? 'system' : value} onChange={event => onChange(event.target.value as Theme)}>
        <option value="system">{t('appearance.system')}</option>
        <option value="light">{t('appearance.light')}</option>
        <option value="dark">{t('appearance.dark')}</option>
        <option value="day-night" disabled>{t('appearance.dayNight')}</option>
      </select>
    </label>
    <p className="field-help">{t('appearance.help')}</p>
  </>
}

/** What this version really does with information. Shown in setup and in Settings. */
export function PrivacyFacts() {
  const { t } = useT()
  return (
    <ul className="fact-list">
      <li>{t('privacy.local')}</li>
      <li>{t('privacy.notSecure')}</li>
      <li>{t('privacy.nothingSent')}</li>
      <li>{t('privacy.erase')}</li>
    </ul>
  )
}

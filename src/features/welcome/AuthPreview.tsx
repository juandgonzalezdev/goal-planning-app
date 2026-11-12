import { Icon } from '../../components/Icon'
import { useT } from '../../i18n'

type Props = { mode: 'sign-up' | 'log-in'; onBack: () => void; onContinue: () => void }

/**
 * The approved Create Account and Log In screens, as a Preview. Accounts do
 * not exist yet, so the fields are switched off: nothing can be typed,
 * sent or saved, and no password is ever stored.
 */
export function AuthPreview({ mode, onBack, onContinue }: Props) {
  const { t } = useT()
  const title = mode === 'sign-up' ? t('welcome.createAccount') : t('welcome.logIn')
  return (
    <div className="screen-column">
      <button type="button" className="back-link" onClick={onBack}><Icon name="arrowLeft" size={18} /> {t('nav.back')}</button>
      <h1 className="screen-title">{title} <span className="badge">{t('auth.preview')}</span></h1>
      <p className="screen-lead">
        {mode === 'sign-up'
          ? t('auth.signUpLead')
          : t('auth.logInLead')}
      </p>
      <form className="form-stack" aria-describedby="auth-preview-note" onSubmit={event => event.preventDefault()}>
        <label className="form-field">{t('auth.email')}<input type="email" autoComplete="off" disabled /></label>
        <label className="form-field">{t('auth.password')}<input type="password" autoComplete="off" disabled /></label>
        <button type="submit" className="button-secondary" disabled>{title}</button>
      </form>
      <p id="auth-preview-note" className="screen-note">{t('auth.note')}</p>
      <div className="screen-actions">
        <button type="button" className="button-primary" onClick={onContinue}>{t('auth.continue')} <Icon name="arrowRight" size={18} /></button>
      </div>
    </div>
  )
}

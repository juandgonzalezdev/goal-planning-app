import { Icon } from '../components/Icon'

type Props = { mode: 'sign-up' | 'log-in'; onBack: () => void; onContinue: () => void }

/**
 * The approved Create Account and Log In screens, as a Preview. Accounts do
 * not exist yet, so the fields are switched off: nothing can be typed,
 * sent or saved, and no password is ever stored.
 */
export function AuthPreview({ mode, onBack, onContinue }: Props) {
  const title = mode === 'sign-up' ? 'Create Account' : 'Log In'
  return (
    <div className="screen-column">
      <button type="button" className="back-link" onClick={onBack}><Icon name="arrowLeft" size={18} /> Back</button>
      <h1 className="screen-title">{title} <span className="badge">Preview</span></h1>
      <p className="screen-lead">
        {mode === 'sign-up'
          ? 'Accounts are coming later. For now, your space is saved on this device only.'
          : 'There are no accounts yet, so there is nothing to log in to. Your space is saved on this device only.'}
      </p>
      <form className="form-stack" aria-describedby="auth-preview-note" onSubmit={event => event.preventDefault()}>
        <label className="form-field">Email<input type="email" autoComplete="off" disabled /></label>
        <label className="form-field">Password<input type="password" autoComplete="off" disabled /></label>
        <button type="submit" className="button-secondary" disabled>{title}</button>
      </form>
      <p id="auth-preview-note" className="screen-note">Preview only: nothing you see here is sent or saved. Google, Apple and passkeys are planned.</p>
      <div className="screen-actions">
        <button type="button" className="button-primary" onClick={onContinue}>Continue Without an Account <Icon name="arrowRight" size={18} /></button>
      </div>
    </div>
  )
}

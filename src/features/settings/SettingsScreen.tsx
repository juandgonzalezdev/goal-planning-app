import { useState } from 'react'
import type { EraseOutcome } from '../../app/useSpace'
import { useWriteBlocked } from '../../app/writeStatus'
import { Icon } from '../../components/Icon'
import { ResetDemoConfirm } from '../../components/ResetDemoConfirm'
import { ownerColor } from '../../domain/finance/space'
import type { FinanceData, Theme } from '../../domain/finance/types'
import { isKept, outcomeText, type SaveOutcome } from '../../ui/saveOutcome'
import { LanguageSelect, PrivacyFacts, ThemeSelect } from '../welcome/WelcomeSetup'

const MODE_NAMES = { individual: 'Individual', duo: 'Duo', group: 'Group' } as const

type Props = {
  data: FinanceData
  isDemo: boolean
  onBack: () => void
  onThemeChange: (theme: Theme) => Promise<SaveOutcome>
  onErase: () => Promise<EraseOutcome>
  /** False while the own space can only be shown: Erase waits until it can be opened as usual. */
  canErase?: boolean
  onExitDemo: () => void
  onResetDemo: () => void
}

const ERASE_TEXT: Partial<Record<EraseOutcome, string>> = {
  'failed': 'This browser did not allow erasing. Nothing was changed.',
  'read-only': 'This browser cannot erase it right now. Nothing was changed.',
  'busy': 'Still saving the last change. Try again in a moment.',
}

export function SettingsScreen({ data, isDemo, onBack, onThemeChange, onErase, onExitDemo, onResetDemo, canErase = true }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [eraseText, setEraseText] = useState('')
  const [themeText, setThemeText] = useState('')
  const blocked = useWriteBlocked()
  const changeTheme = async (theme: Theme) => {
    setThemeText('')
    const outcome = await onThemeChange(theme)
    // A kept theme shows by itself; only a refusal needs words.
    if (!isKept(outcome)) setThemeText(outcomeText('', outcome))
  }
  const erase = async () => {
    setEraseText('')
    const outcome = await onErase()
    setConfirming(false)
    setEraseText(ERASE_TEXT[outcome] ?? '')
  }
  return (
    <div className="tab-screen">
      <button type="button" className="back-link" onClick={onBack}><Icon name="arrowLeft" size={18} /> Back</button>
      <h1 className="tab-title">Settings</h1>

      <section className="block">
        <h2 className="section-title">Account &amp; Workspace</h2>
        <dl className="fact-rows">
          <div><dt>Account</dt><dd>{isDemo ? 'Demo (invented information)' : 'No account yet (Preview)'}</dd></div>
          <div><dt>Space</dt><dd>{MODE_NAMES[data.space.mode]}</dd></div>
          <div><dt>{data.space.members.length === 1 ? 'Member' : 'Members'}</dt>
            <dd>{data.space.members.map(member => (
              <span key={member.id} className="member-chip"><i className="owner-dot" style={{ background: ownerColor(data.space, member.id) }} aria-hidden="true" />{member.name}</span>
            ))}</dd>
          </div>
        </dl>
        {data.space.mode === 'duo' && <p className="field-help">There is no private information between members yet. Everyone who uses this device can see everything in the space.</p>}
      </section>

      <section className="block">
        <h2 className="section-title">Preferences</h2>
        <dl className="fact-rows">
          <div><dt>Currency</dt><dd>{data.space.currency}</dd></div>
        </dl>
        <p className="field-help">Chosen when the space was created. Amounts are never converted.</p>
        <div className="form-stack">
          <LanguageSelect />
          <ThemeSelect value={data.preferences.theme} onChange={theme => void changeTheme(theme)} />
        </div>
        {themeText && <p className="field-error" role="alert">{themeText}</p>}
      </section>

      <section className="block">
        <h2 className="section-title">Privacy &amp; Security</h2>
        {isDemo ? <>
          <p className="field-help">The demo uses invented information only. Changes are not saved and disappear when you exit. Reset Demo puts the original example back; your own space is never touched.</p>
          <div className="inline-actions">
            <ResetDemoConfirm onReset={onResetDemo} showDone />
            <button type="button" className="button-secondary" onClick={onExitDemo}>Exit Demo</button>
          </div>
        </> : <>
          <PrivacyFacts />
          {!confirming && <button type="button" className="button-danger" disabled={!canErase} onClick={() => setConfirming(true)}>Erase All Data on This Device</button>}
          {confirming && (
            <div className="callout callout-warning" role="alert">
              <p>Erase your whole space from this device? This cannot be undone. Export it first in Data if you want a copy.</p>
              <div className="inline-actions">
                <button type="button" className="button-small button-small-danger" aria-disabled={blocked || undefined} onClick={() => void erase()}>Erase Everything</button>
                <button type="button" className="button-small" onClick={() => setConfirming(false)}>Cancel</button>
              </div>
            </div>
          )}
          {eraseText && <p className="field-error" role="alert">{eraseText}</p>}
        </>}
      </section>
    </div>
  )
}

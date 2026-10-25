import { useState } from 'react'
import { Icon } from '../components/Icon'
import { ownerColor } from '../domain/finance/space'
import type { FinanceData, Theme } from '../domain/finance/types'
import { LanguageSelect, PrivacyFacts, ThemeSelect } from '../screens/WelcomeSetup'

const MODE_NAMES = { individual: 'Individual', duo: 'Duo', group: 'Group' } as const

type Props = {
  data: FinanceData
  isDemo: boolean
  onBack: () => void
  onThemeChange: (theme: Theme) => void
  onErase: () => boolean
  onExitDemo: () => void
  onResetDemo: () => void
}

export function SettingsScreen({ data, isDemo, onBack, onThemeChange, onErase, onExitDemo, onResetDemo }: Props) {
  const [resetDone, setResetDone] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [eraseFailed, setEraseFailed] = useState(false)
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
          <ThemeSelect value={data.preferences.theme} onChange={onThemeChange} />
        </div>
      </section>

      <section className="block">
        <h2 className="section-title">Privacy &amp; Security</h2>
        {isDemo ? <>
          <p className="field-help">The demo uses invented information only. Changes are not saved and disappear when you exit. Reset Demo puts the original example back; your own space is never touched.</p>
          <div className="inline-actions">
            <button type="button" className="button-secondary" onClick={() => { onResetDemo(); setResetDone(true) }}>Reset Demo</button>
            <button type="button" className="button-secondary" onClick={onExitDemo}>Exit Demo</button>
          </div>
          {resetDone && <p className="muted-note" role="status">The demo is back to the original example.</p>}
        </> : <>
          <PrivacyFacts />
          {!confirming && <button type="button" className="button-danger" onClick={() => setConfirming(true)}>Erase All Data on This Device</button>}
          {confirming && (
            <div className="callout callout-warning" role="alert">
              <p>Erase your whole space from this device? This cannot be undone. Export it first in Data if you want a copy.</p>
              <div className="inline-actions">
                <button type="button" className="button-small button-small-danger" onClick={() => { setEraseFailed(!onErase()); setConfirming(false) }}>Erase Everything</button>
                <button type="button" className="button-small" onClick={() => setConfirming(false)}>Cancel</button>
              </div>
            </div>
          )}
          {eraseFailed && <p className="field-error" role="alert">This browser did not allow erasing. Nothing was changed.</p>}
        </>}
      </section>
    </div>
  )
}

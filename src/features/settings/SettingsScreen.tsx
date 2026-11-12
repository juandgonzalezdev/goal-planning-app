import { useState, type ReactNode } from 'react'
import type { EraseOutcome } from '../../app/useSpace'
import { useWriteBlocked, useWriteStatus } from '../../app/writeStatus'
import { Icon } from '../../components/Icon'
import { ResetDemoConfirm } from '../../components/ResetDemoConfirm'
import { ownerColor } from '../../domain/finance/space'
import type { FinanceData, Language, Theme } from '../../domain/finance/types'
import { useT, type MessageKey } from '../../i18n'
import { LANGUAGE_NAMES } from '../../i18n/languages'
import { isKept, outcomeText, type SaveOutcome } from '../../ui/saveOutcome'
import { LanguageSelect, PrivacyFacts, ThemeSelect } from '../welcome/WelcomeSetup'
import { HelpTip } from '../../components/HelpTip'
import type { YearMonth } from '../../domain/calendar'
import type { CalendarDate } from '../../domain/goalTime'
import type { Backup } from '../../data/exchange'
import { ExchangeSection } from './ExchangeSection'
import { ReportSection } from './ReportSection'

const MODE_NAMES = { individual: 'mode.individual', duo: 'mode.duo', group: 'mode.group' } as const satisfies Record<string, MessageKey>

type Props = {
  showRings?: boolean
  onShowRingsChange?: (shown: boolean) => void
  data: FinanceData
  isDemo: boolean
  /** For Reports & Backup: the months the report can cover, the month chosen, and today. */
  months: YearMonth[]
  month: YearMonth
  today: CalendarDate
  /** Restore Backup: replaces the whole space (asks first). */
  onReplace: (backup: Backup, base?: number) => Promise<SaveOutcome>
  /** The backup file with Getting Started progress as saved (GS-6A.1). */
  onBackup?: () => Promise<{ text: string; guideLeftOut: boolean }>
  /** While the space can only be shown: "Download Both Copies". */
  onDownloadCopies?: () => Promise<boolean>
  onBack: () => void
  /** Help & Guide: the guide, Getting Started and the Monthly Check-in. */
  onOpenHelp: () => void
  onThemeChange: (theme: Theme) => Promise<SaveOutcome>
  /** The language shown and its change (the own space saves it; the demo keeps it in memory). */
  language?: Language
  onLanguageChange?: (language: Language) => Promise<SaveOutcome>
  /** Spanish and Polish can be chosen before Phase B6 (preview on this device). */
  languagePreview?: boolean
  onErase: () => Promise<EraseOutcome>
  /** False while the own space can only be shown: Erase waits until it can be opened as usual. */
  canErase?: boolean
  onExitDemo: () => void
  onResetDemo: () => void
  /** The own space: Explore the Demo. The app asks first when something typed would be dropped. */
  onExploreDemo?: () => void
  /** That question (or the one before Exit Demo), shown here where it was asked. */
  demoQuestion?: ReactNode
}

const ERASE_TEXT: Partial<Record<EraseOutcome, MessageKey>> = {
  'failed': 'erase.failed',
  'read-only': 'erase.readOnly',
  'busy': 'erase.busyLast',
}

export function SettingsScreen({ showRings = false, onShowRingsChange, data, isDemo, months, month, today, onReplace, onBackup, onDownloadCopies, onBack, onOpenHelp, onThemeChange, onErase, onExitDemo, onResetDemo, canErase = true, onExploreDemo, demoQuestion = null, language = 'en', onLanguageChange, languagePreview = false }: Props) {
  const { t } = useT()
  const [languageText, setLanguageText] = useState('')
  const changeLanguage = async (next: Language) => {
    setLanguageText('')
    const outcome = await onLanguageChange?.(next)
    // A kept language shows by itself (every word changes); screen readers hear it once. A refusal says why.
    if (outcome) setLanguageText(isKept(outcome) ? '' : outcomeText('', outcome))
    if (outcome && isKept(outcome)) setLanguageNotice(LANGUAGE_NAMES[next])
  }
  const [languageNotice, setLanguageNotice] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [eraseText, setEraseText] = useState('')
  const [themeText, setThemeText] = useState('')
  const blocked = useWriteBlocked()
  const { saving } = useWriteStatus()
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
    setEraseText(ERASE_TEXT[outcome] ? t(ERASE_TEXT[outcome]!) : '')
  }
  return (
    <div className="tab-screen">
      <button type="button" className="back-link" onClick={onBack}><Icon name="arrowLeft" size={18} /> {t('nav.back')}</button>
      <h1 className="tab-title">{t('settings.title')}</h1>

      <section className="block" aria-labelledby="settings-help">
        <h2 id="settings-help" className="section-title">{t('settings.help')}</h2>
        <p className="field-help">{t('settings.helpText')}</p>
        <button type="button" className="button-secondary align-start" onClick={onOpenHelp}>{t('settings.openHelp')}</button>
      </section>

      <section className="block">
        <h2 className="section-title">{t('settings.account')}</h2>
        <dl className="fact-rows">
          <div><dt>{t('settings.accountLabel')}</dt><dd>{isDemo ? t('settings.accountDemo') : t('settings.accountNone')}</dd></div>
          <div><dt>{t('settings.space')}</dt><dd>{t(MODE_NAMES[data.space.mode])}</dd></div>
          <div><dt>{t('settings.members', { count: data.space.members.length })}</dt>
            <dd>{data.space.members.map(member => (
              <span key={member.id} className="member-chip"><i className="owner-dot" style={{ background: ownerColor(data.space, member.id) }} aria-hidden="true" />{member.name}</span>
            ))}</dd>
          </div>
        </dl>
        {data.space.mode === 'duo' && <p className="field-help">{t('settings.duoNote')}</p>}
      </section>

      <section className="block">
        <h2 className="section-title">{t('settings.preferences')}</h2>
        <dl className="fact-rows">
          <div><dt>{t('settings.currency')}</dt><dd>{data.space.currency}</dd></div>
        </dl>
        <p className="field-help">{t('settings.currencyHelp')}</p>
        <div className="form-stack">
          {onShowRingsChange && <label className="effect-option"><input type="checkbox" checked={showRings} onChange={event => onShowRingsChange(event.target.checked)} /><span><b>{t('settings.rings')}</b><small>{t('settings.ringsHelp')}</small></span></label>}
          <LanguageSelect value={language} onChange={next => void changeLanguage(next)} preview={languagePreview} />
          <p className="visually-hidden" role="status">{languageNotice && t('language.notice', { language: languageNotice })}</p>
          <ThemeSelect value={data.preferences.theme} onChange={theme => void changeTheme(theme)} />
        </div>
        {themeText && <p className="field-error" role="alert">{themeText}</p>}
        {languageText && <p className="field-error" role="alert">{languageText}</p>}
      </section>

      <section className="block">
        <h2 className="section-title">{t('settings.privacy')}</h2>
        {isDemo ? <>
          <p className="field-help">{t('settings.demoPrivacy')}</p>
          <div className="inline-actions">
            <ResetDemoConfirm onReset={onResetDemo} showDone />
            <button type="button" className="button-secondary" onClick={onExitDemo}>{t('demo.exit')}</button>
          </div>
          {demoQuestion && <div className="callout callout-warning" role="alert">{demoQuestion}</div>}
        </> : <>
          <PrivacyFacts />
          <div className="help-tips"><HelpTip topic="hide-amounts" label /></div>
          {!confirming && <button type="button" className="button-danger" disabled={!canErase} onClick={() => setConfirming(true)}>{t('settings.erase')}</button>}
          {confirming && (
            <div className="callout callout-warning" role="alert">
              <p>{t('settings.eraseQuestion')}</p>
              <div className="inline-actions">
                <button type="button" className="button-small button-small-danger" aria-disabled={blocked || undefined} onClick={() => void erase()}>{t('settings.eraseConfirm')}</button>
                <button type="button" className="button-small" onClick={() => setConfirming(false)}>{t('common.cancel')}</button>
              </div>
            </div>
          )}
          {eraseText && <p className="field-error" role="alert">{eraseText}</p>}
        </>}
      </section>

      <section className="block" id="settings-reports" aria-labelledby="settings-reports-title" tabIndex={-1}>
        <h2 id="settings-reports-title" className="section-title">{t('settings.reports')}</h2>
        <ReportSection data={data} isDemo={isDemo} months={months} month={month} today={today} />
        <ExchangeSection data={data} isDemo={isDemo} onReplace={onReplace} onBackup={onBackup} onDownloadCopies={onDownloadCopies} />
        <div className="help-tips"><HelpTip topic="backup" label /></div>
      </section>

      {!isDemo && onExploreDemo && (
        <section className="block" aria-labelledby="settings-demo">
          <h2 id="settings-demo" className="section-title">{t('settings.exploreDemo')}</h2>
          <p className="field-help">{t('settings.exploreText')}</p>
          <button type="button" className="button-secondary align-start" aria-disabled={saving || undefined} aria-describedby={saving ? 'settings-demo-wait' : undefined}
            onClick={() => { if (!saving) onExploreDemo() }}>{t('settings.exploreDemo')}</button>
          {saving && <p id="settings-demo-wait" className="field-help">{t('settings.exploreWait')}</p>}
          {demoQuestion && <div className="callout callout-warning" role="alert">{demoQuestion}</div>}
        </section>
      )}
    </div>
  )
}

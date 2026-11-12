import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../components/Icon'
import { IconTip } from '../components/IconTip'
import { useT } from '../i18n'
import { allAreasHidden, AREA_NAMES, useAmountVisibility, VisibilityContext, type AmountVisibility, type BlockAmounts, type HomeArea } from './amountVisibility'

/** The hidden areas for everything inside (Home). The state itself is kept by the app, on this device. */
export function AmountVisibilityProvider({ value, children }: { value: AmountVisibility; children: ReactNode }) {
  return <VisibilityContext.Provider value={value}>{children}</VisibilityContext.Provider>
}
/** The eye button in an area's header: light while amounts show, marked while they are hidden. It covers everything in the area. */
export function EyeToggle({ area, name = AREA_NAMES[area] }: { area: HomeArea; name?: string }) {
  const { t } = useT()
  const { hidden, toggle } = useAmountVisibility()
  const isHidden = hidden.has(area)
  const label = t(isHidden ? 'amounts.showIn' : 'amounts.hideIn', { area: name })
  return (
    <button type="button" className={`eye-toggle has-tip${isHidden ? ' is-hidden' : ''}`} aria-label={label} onClick={() => toggle(area)}>
      <Icon name={isHidden ? 'eyeOff' : 'eye'} size={18} />
      <IconTip label={label} />
    </button>
  )
}

/** How long "Amounts hidden" / "Amounts visible" stays under the Home eye. */
export const AMOUNTS_NOTICE_MS = 2000

/**
 * The eye above the Home areas: one tap hides every amount, the next
 * shows them all again. Like the eye of each area, it shows the state:
 * open while amounts show, crossed out while all are hidden. Its name
 * includes the visible state and next action. After a tap, a short
 * "Amounts hidden" or "Amounts visible" appears under it, over the page
 * (nothing moves), and screen readers hear it once.
 */
export function HomeAmountsEye({ compact = false, noticeHost }: { compact?: boolean; noticeHost?: HTMLElement | null }) {
  const { t } = useT()
  const { hidden, setAll } = useAmountVisibility()
  const allHidden = allAreasHidden(hidden)
  const label = allHidden ? t('amounts.hiddenShow') : t('amounts.hide')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), AMOUNTS_NOTICE_MS)
    return () => clearTimeout(timer)
  }, [notice])

  return (
    <span className="amounts-eye">
      <button type="button" className={`${compact ? 'icon-button has-tip' : 'button-small'} tool-button contextual-privacy${allHidden ? ' is-hidden' : ''}`} aria-label={label}
        onClick={() => { setAll(!allHidden); setNotice(allHidden ? t('amounts.visible') : t('amounts.hidden')) }}>
        <Icon name={allHidden ? 'eyeOff' : 'eye'} size={20} />
        {compact ? <IconTip label={label} /> : <span aria-hidden="true">{allHidden ? t('amounts.hidden') : t('amounts.hide')}</span>}
      </button>
      {noticeHost && notice && createPortal(<span className="control-notice" aria-hidden="true">{notice}</span>, noticeHost)}
      <span className={`amounts-notice${compact ? ' visually-hidden' : ''}${notice ? ' is-shown' : ''}`} role="status">{notice}</span>
    </span>
  )
}

/** Hide All Amounts / Show All Amounts as a text button (Bills and History). */
export function AllAmountsToggle() {
  const { t } = useT()
  const { hidden, setAll } = useAmountVisibility()
  const allHidden = allAreasHidden(hidden)
  return (
    <button type="button" className="button-small align-start contextual-privacy" aria-label={allHidden ? t('amounts.hiddenShow') : t('amounts.hide')} onClick={() => setAll(!allHidden)}>
      <Icon name={allHidden ? 'eyeOff' : 'eye'} size={16} /> <span aria-hidden="true">{allHidden ? t('amounts.hidden') : t('amounts.hide')}</span>
    </button>
  )
}

/**
 * What takes a chart's place while its amounts are hidden: no shape, no
 * scale, no colours, no legend values and no marks, only this note and a
 * way to show the amounts again. The same height as the chart it replaces
 * (`kind`), so nothing jumps.
 */
export function HiddenChart({ amounts, kind = 'bars' }: { amounts: BlockAmounts; kind?: 'donut' | 'bars' }) {
  const { t } = useT()
  return (
    <div className={`chart-hidden is-${kind}`}>
      <p>{t('amounts.chartHidden')}</p>
      <button type="button" className="button-small" onClick={amounts.show}><Icon name="eye" size={16} /> {t('amounts.showButton')}</button>
    </div>
  )
}

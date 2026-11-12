/**
 * Small display choices remembered on this device, apart from the space's
 * data (they also work in the demo). Reading or writing can fail, for
 * example in a private window; then the default is used.
 */
import type { Language } from '../domain/finance/types'
import { isLanguage } from '../i18n/languages'

export type BillsChartView = 'donut' | 'bars'

const CHART_KEY = 'goal-planning-app.bills-chart'

export function readChartView(storage: Storage | null): BillsChartView {
  try {
    return storage?.getItem(CHART_KEY) === 'bars' ? 'bars' : 'donut'
  } catch {
    return 'donut'
  }
}

export function writeChartView(storage: Storage | null, view: BillsChartView): void {
  try {
    storage?.setItem(CHART_KEY, view)
  } catch {
    // Not remembered; the chart still changes.
  }
}

const HIDDEN_KEY = 'goal-planning-app.hidden-amounts'

/**
 * Which Home blocks show their amounts hidden, remembered on this device
 * only. It is a screen preference: the data never changes, and it is not
 * a lock or encryption.
 */
export function readHiddenBlocks(storage: Storage | null): string[] {
  try {
    const value: unknown = JSON.parse(storage?.getItem(HIDDEN_KEY) ?? '[]')
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

export function writeHiddenBlocks(storage: Storage | null, blocks: readonly string[]): void {
  try {
    storage?.setItem(HIDDEN_KEY, JSON.stringify(blocks))
  } catch {
    // Not remembered; the amounts are still hidden until the page closes.
  }
}

const EMERGENCY_LATER_KEY = 'goal-planning-app.emergency-later'

/** "Maybe Later" on the emergency fund suggestion, remembered on this device. */
export function readEmergencyLater(storage: Storage | null): boolean {
  try {
    return storage?.getItem(EMERGENCY_LATER_KEY) === 'yes'
  } catch {
    return false
  }
}

export function writeEmergencyLater(storage: Storage | null, later: boolean): void {
  try {
    if (later) storage?.setItem(EMERGENCY_LATER_KEY, 'yes')
    else storage?.removeItem(EMERGENCY_LATER_KEY)
  } catch {
    // Not remembered; the suggestion stays hidden until the page closes.
  }
}

const LAYOUT_KEY = 'goal-planning-app.home-layout'

/**
 * How the own space arranges Home (block order and open blocks), saved on
 * this device for that space only. The demo never uses this: its layout
 * lasts while the demo is open. The value is returned as read; the screen
 * checks it, so an old or broken value never loses or repeats a block.
 */
export function readHomeLayout(storage: Storage | null, spaceId: string): unknown {
  try {
    const value: unknown = JSON.parse(storage?.getItem(LAYOUT_KEY) ?? 'null')
    const record = typeof value === 'object' && value !== null ? value as Record<string, unknown> : null
    return record?.spaceId === spaceId ? record.layout : null
  } catch {
    return null
  }
}

export function writeHomeLayout(storage: Storage | null, spaceId: string, layout: unknown): void {
  try {
    storage?.setItem(LAYOUT_KEY, JSON.stringify({ spaceId, layout }))
  } catch {
    // Not remembered; the layout still applies until the page closes.
  }
}

/** Forgets the own space's Home layout (when the own space is erased). */
export function clearHomeLayout(storage: Storage | null): void {
  try {
    storage?.removeItem(LAYOUT_KEY)
  } catch {
    // Nothing to do: it is only a screen preference.
  }
}

const GUIDE_KEY = 'goal-planning-app.getting-started'

/**
 * Getting Started progress of the own space, on this device only (never in
 * the space's data or its backup). The demo never uses this. The value is
 * returned as read; the screen checks it.
 */
export function readGuideProgress(storage: Storage | null, spaceId: string): unknown {
  try {
    const value: unknown = JSON.parse(storage?.getItem(GUIDE_KEY) ?? 'null')
    const record = typeof value === 'object' && value !== null ? value as Record<string, unknown> : null
    return record?.spaceId === spaceId ? record.progress : null
  } catch {
    return null
  }
}

export function writeGuideProgress(storage: Storage | null, spaceId: string, progress: unknown): void {
  try {
    storage?.setItem(GUIDE_KEY, JSON.stringify({ spaceId, progress }))
  } catch {
    // Not remembered; the guide still follows it until the page closes.
  }
}

/** Forgets Getting Started progress (when the own space is erased). */
export function clearGuideProgress(storage: Storage | null): void {
  try {
    storage?.removeItem(GUIDE_KEY)
  } catch {
    // Nothing to forget.
  }
}

const RINGS_KEY = 'goal-planning-app.home-rings'
/**
 * Ring-first Home (UX-04.1), on this device. On unless this device saved "no": someone who never chose
 * gets the ring by default, and someone who turned it off in Settings keeps the classic Home. Without
 * storage (or when it can't be read) the default applies.
 */
export function readHomeRings(storage: Storage | null): boolean {
  try { return storage?.getItem(RINGS_KEY) !== 'no' } catch { return true }
}
export function writeHomeRings(storage: Storage | null, shown: boolean): void {
  try { storage?.setItem(RINGS_KEY, shown ? 'yes' : 'no') } catch { /* Session only. */ }
}

const LANGUAGE_KEY = 'goal-planning-app.language'
/**
 * The language chosen on this device (Phase B1). The open space keeps its
 * own choice in its data (`preferences.language`); this copy is only for
 * Welcome and Welcome Setup, before a space exists, and for after an erase.
 * The demo never writes it. Anything unexpected reads as "not chosen".
 */
export function readDeviceLanguage(storage: Storage | null): Language | null {
  try { const value = storage?.getItem(LANGUAGE_KEY); return isLanguage(value) ? value : null } catch { return null }
}
export function writeDeviceLanguage(storage: Storage | null, language: Language): void {
  try { storage?.setItem(LANGUAGE_KEY, language) } catch { /* Not remembered; the language still applies until the page closes. */ }
}

const LANGUAGE_PREVIEW_KEY = 'goal-planning-app.language-preview'
/**
 * Spanish and Polish preview (until Phase B6 turns them on for everyone):
 * opening the app with `?languages=preview` turns it on for this device,
 * `?languages=off` turns it off. It only changes what the language list
 * offers, never a saved choice.
 */
export function readLanguagePreview(storage: Storage | null, search: string): boolean {
  const asked = new URLSearchParams(search).get('languages')
  try {
    if (asked === 'preview') storage?.setItem(LANGUAGE_PREVIEW_KEY, 'yes')
    if (asked === 'off') storage?.removeItem(LANGUAGE_PREVIEW_KEY)
    return storage?.getItem(LANGUAGE_PREVIEW_KEY) === 'yes'
  } catch {
    return asked === 'preview'
  }
}

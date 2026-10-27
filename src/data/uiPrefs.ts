/**
 * Small display choices remembered on this device, apart from the space's
 * data (they also work in the demo). Reading or writing can fail, for
 * example in a private window; then the default is used.
 */
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

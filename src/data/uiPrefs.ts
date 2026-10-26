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

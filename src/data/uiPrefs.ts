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

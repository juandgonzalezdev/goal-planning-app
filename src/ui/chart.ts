/** Small helpers for the Home charts. Pure, so they are easy to test. */

export interface Segment {
  value: number
  color: string
}

/**
 * The conic-gradient of a donut chart, one slice per segment in order.
 * Returns null when there is nothing to show, so the screen can draw an
 * empty ring instead of a misleading one.
 */
export function donutGradient(segments: readonly Segment[]): string | null {
  const shown = segments.filter(segment => segment.value > 0)
  const total = shown.reduce((sum, segment) => sum + segment.value, 0)
  if (total <= 0) return null
  let start = 0
  const stops = shown.map((segment, index) => {
    const end = index === shown.length - 1 ? 100 : start + (segment.value / total) * 100
    const stop = `${segment.color} ${round(start)}% ${round(end)}%`
    start = end
    return stop
  })
  return `conic-gradient(${stops.join(', ')})`
}

/**
 * Each part's share of the whole, in percent, adding up to exactly 100
 * (the last part takes the rounding). All zeros give all zeros.
 */
export function sharePercents(parts: readonly number[]): number[] {
  const total = parts.reduce((sum, part) => sum + Math.max(part, 0), 0)
  if (total <= 0) return parts.map(() => 0)
  let used = 0
  return parts.map((part, index) => {
    if (index === parts.length - 1) return round(100 - used)
    const share = round((Math.max(part, 0) / total) * 100)
    used += share
    return share
  })
}

/** How long a bar is, in percent of the longest one (0 to 100). */
export const barPercent = (value: number, max: number) => (max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0)

const round = (value: number) => Math.round(value * 100) / 100

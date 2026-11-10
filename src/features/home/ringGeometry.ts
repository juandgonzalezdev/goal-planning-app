/** Approved variant B. Angles are clockwise from twelve o'clock. */
export const RING_AREAS = ['income', 'bills', 'debts', 'goals'] as const
export const SECTION_ANGLES = [0, 90, 180, 270] as const
export const SECTION_INNER = 128
export const SECTION_OUTER = 192
export const SECTION_GAP = 8
export const pointAt = (radius: number, angle: number) => ({ x: 200 + radius * Math.sin(angle * Math.PI / 180), y: 200 - radius * Math.cos(angle * Math.PI / 180) })
const delta = (r: number) => Math.asin(SECTION_GAP / 2 / r) * 180 / Math.PI
const edge = (r: number, angle: number) => pointAt(r, angle)
const xy = (p: { x: number; y: number }) => `${p.x.toFixed(6)} ${p.y.toFixed(6)}`

/** Each boundary is shortened by the same physical half-gap, independently at the two radii. */
export function sectionPath(index: number, fraction = 1, inner = SECTION_INNER, outer = SECTION_OUTER) {
  const p = Math.min(1, Math.max(0, fraction))
  if (!p) return ''
  const a = SECTION_ANGLES[index] - 45, b = a + 90
  const s = a + delta(outer), e = s + (b - delta(outer) - s) * p
  const si = a + delta(inner), ei = si + (b - delta(inner) - si) * p
  return `M ${xy(edge(outer, s))} A ${outer} ${outer} 0 0 1 ${xy(edge(outer, e))} L ${xy(edge(inner, ei))} A ${inner} ${inner} 0 0 0 ${xy(edge(inner, si))} Z`
}

/** HTML radio hit shapes share the SVG geometry; the vector itself stays decorative. */
export function sectionHitPolygon(index: number) {
  const a = SECTION_ANGLES[index] - 45, b = a + 90
  const points = []
  for (const [r, reversed] of [[SECTION_OUTER, false], [SECTION_INNER, true]] as const) {
    const start = a + delta(r), end = b - delta(r)
    for (let i = 0; i <= 32; i++) points.push(edge(r, start + (end - start) * (reversed ? 1 - i / 32 : i / 32)))
  }
  return `polygon(${points.map(p => `${(p.x + 12) / 424 * 100}% ${(p.y + 12) / 424 * 100}%`).join(',')})`
}

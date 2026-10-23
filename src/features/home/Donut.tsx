import { donutGradient, type Segment } from '../../ui/chart'

/** The v5.9 ring chart. The centre shows the chosen slice, or the total. */
export function Donut({ segments, caption, value }: { segments: Segment[]; caption: string; value: string }) {
  const gradient = donutGradient(segments)
  return (
    <div className="donut" style={{ background: gradient ?? 'var(--color-track)' }}>
      <div className="donut-core">
        <small>{caption}</small>
        <strong>{value}</strong>
      </div>
    </div>
  )
}

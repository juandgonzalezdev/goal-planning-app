/** A thin progress bar with its value for screen readers. */
export function ProgressBar({ percent, color, label }: { percent: number; color: string; label: string }) {
  return (
    <div className="bar thin" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)}>
      <div style={{ width: `${percent}%`, background: color }} />
    </div>
  )
}

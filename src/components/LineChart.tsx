import { useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'

/**
 * A small chart over time with one shared visual language (Rumbo de
 * diseño §7): a solid line for what was recorded, a dashed line for an
 * estimate (always with its label), a thin target line, and an empty
 * stretch marked "Not entered" where nothing was recorded. A line never
 * joins two records across an empty stretch, and the parent draws no line
 * from fewer than two records.
 *
 * The recorded points are the only things to choose. Each is a button
 * (one Tab stop; the arrow keys, Home and End move between them), and a
 * tap anywhere on the chart chooses the nearest one, so the target is the
 * whole chart's height. What a point means is shown by the parent below
 * the chart, in text. "Show as Table" gives the same figures as a table.
 * Nothing moves when the chart appears.
 */

/** A position on the chart: x from 0 (left) to 1 (right), and an amount. */
export interface ChartXY { x: number; value: number }

export interface ChartPoint extends ChartXY {
  key: string
  /** What a screen reader hears for the point, such as "31 Dec 2026: 2900,00 zł". */
  label: string
}

export interface ChartLine {
  points: ChartXY[]
  style: 'record' | 'estimate'
  /** A step line: flat until the next point, then straight up or down. */
  step?: boolean
}

export interface ChartTable {
  head: string[]
  rows: { key: string; cells: string[] }[]
}

type Props = {
  /** The chart's name, for the group and the table caption. */
  name: string
  lines: ChartLine[]
  points: ChartPoint[]
  /** Empty stretches between records, labelled "Not entered". */
  gaps?: { from: number; to: number }[]
  /** A thin line across the chart at an amount, with its label (a goal's target). */
  level?: { value: number; label: string } | null
  /** A thin line down the chart at a position, with its label (a goal's date). */
  mark?: { x: number; label: string } | null
  /** A few labels under the chart. */
  xLabels: { x: number; text: string }[]
  /** The amount at the top of the scale, as text. */
  money: (minor: number) => string
  legend: { style: 'record' | 'estimate' | 'level'; text: string }[]
  selected: string | null
  onSelect: (key: string) => void
  /** What the chosen point means, shown under the chart. */
  detail: ReactNode
  table: ChartTable
}

const PAD = 4
const left = (x: number) => PAD + x * (100 - PAD * 2)

export function LineChart({ name, lines, points, gaps = [], level = null, mark = null, xLabels, money, legend, selected, onSelect, detail, table }: Props) {
  const id = useId()
  const [showTable, setShowTable] = useState(false)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const values = [0, ...lines.flatMap(line => line.points.map(point => point.value)), ...points.map(point => point.value), ...(level ? [level.value] : [])]
  const low = Math.min(...values)
  const high = Math.max(...values)
  const span = high - low || 1
  // Amounts go up the chart, with a little room above the highest one.
  const top = (value: number) => 8 + (1 - (value - low) / span) * 84
  const path = (line: ChartLine) => line.points.map((point, index) => {
    const x = left(point.x), y = top(point.value)
    if (index === 0) return `M${x},${y}`
    return line.step ? `H${x}V${y}` : `L${x},${y}`
  }).join('')
  const chosen = points.findIndex(point => point.key === selected)
  const focusIndex = chosen >= 0 ? chosen : points.length - 1

  const choose = (index: number, focus: boolean) => {
    const point = points[Math.max(0, Math.min(points.length - 1, index))]
    if (!point) return
    onSelect(point.key)
    if (focus) buttons.current[points.indexOf(point)]?.focus()
  }
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = { ArrowRight: index + 1, ArrowDown: index + 1, ArrowLeft: index - 1, ArrowUp: index - 1, Home: 0, End: points.length - 1 }[event.key]
    if (next === undefined) return
    event.preventDefault()
    choose(next, true)
  }
  // A tap or click on the chart chooses the record nearest to it, left to right.
  const onPointer = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    if (!box.width) return
    // Keeps the focus on the chosen record (a press on the chart would otherwise move it to the page).
    event.preventDefault()
    const at = ((event.clientX - box.left) / box.width * 100 - PAD) / (100 - PAD * 2)
    let best = 0
    points.forEach((point, index) => { if (Math.abs(point.x - at) < Math.abs(points[best].x - at)) best = index })
    choose(best, true)
  }

  return (
    <div className="time-chart">
      <p className="chart-legend" aria-hidden="true">
        {legend.map(item => <span key={item.text}><i className={`legend-line is-${item.style}`} />{item.text}</span>)}
      </p>
      <div className="time-chart-plot" role="group" aria-label={`${name}. Use the arrow keys to move between the records.`}>
        {/* The top of the scale, unless the target line already names it; and 0 on the base line. */}
        {!(level && level.value === high) && <span className="time-chart-scale" aria-hidden="true">{money(high)}</span>}
        {low === 0 && <span className="time-chart-scale is-zero" aria-hidden="true" style={{ top: `${top(0)}%` }}>0</span>}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <line className="time-chart-base" x1="0" x2="100" y1={top(Math.max(low, 0))} y2={top(Math.max(low, 0))} />
          {level && <line className="time-chart-level" x1="0" x2="100" y1={top(level.value)} y2={top(level.value)} />}
          {mark && <line className="time-chart-level" x1={left(mark.x)} x2={left(mark.x)} y1="0" y2="100" />}
          {lines.filter(line => line.points.length > 1).map((line, index) => <path key={index} className={`time-chart-line is-${line.style}`} d={path(line)} />)}
        </svg>
        {gaps.map(gap => (
          <span key={gap.from} className="time-chart-gap" aria-hidden="true" style={{ left: `${left(gap.from)}%`, width: `${left(gap.to) - left(gap.from)}%` }}>Not entered</span>
        ))}
        {level && <span className="time-chart-note is-level" aria-hidden="true" style={{ top: `${top(level.value)}%` }}>{level.label}</span>}
        {mark && <span className="time-chart-note is-mark" aria-hidden="true" style={{ left: `${left(mark.x)}%` }}>{mark.label}</span>}
        <div className="time-chart-hit" aria-hidden="true" onPointerDown={onPointer} />
        {points.map((point, index) => (
          <button key={point.key} ref={element => { buttons.current[index] = element }} type="button"
            className={`time-chart-point${point.key === selected ? ' is-selected' : ''}`} style={{ left: `${left(point.x)}%`, top: `${top(point.value)}%` }}
            tabIndex={index === focusIndex ? 0 : -1} aria-pressed={point.key === selected} aria-label={point.label}
            onClick={() => choose(index, false)} onKeyDown={event => onKeyDown(event, index)} />
        ))}
      </div>
      <div className="time-chart-axis" aria-hidden="true">
        {xLabels.map(label => <span key={`${label.x}-${label.text}`} style={{ left: `${left(label.x)}%` }}>{label.text}</span>)}
      </div>
      <div className="time-chart-detail" aria-live="polite">{detail}</div>
      <button type="button" className="text-button" aria-expanded={showTable} aria-controls={`${id}-table`} onClick={() => setShowTable(!showTable)}>
        {showTable ? 'Hide Table' : 'Show as Table'}
      </button>
      <div id={`${id}-table`} hidden={!showTable} className="table-scroll">
        {showTable && (
          <table className="chart-table year-table">
            <caption>{name}</caption>
            <thead><tr>{table.head.map(cell => <th key={cell} scope="col">{cell}</th>)}</tr></thead>
            <tbody>{table.rows.map(row => <tr key={row.key}>{row.cells.map((cell, index) => index === 0 ? <th key={index} scope="row">{cell}</th> : <td key={index}>{cell}</td>)}</tr>)}</tbody>
          </table>
        )}
      </div>
    </div>
  )
}

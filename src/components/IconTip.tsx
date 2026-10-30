/**
 * The name of an icon button, shown next to it on hover (mouse) and on
 * keyboard focus. Screen readers already hear the button's own name, so
 * this copy is hidden from them.
 */
export function IconTip({ label, align = 'end' }: { label: string; align?: 'start' | 'end' }) {
  return <span className={`icon-tip icon-tip-${align}`} aria-hidden="true">{label}</span>
}

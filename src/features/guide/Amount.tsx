/**
 * An amount in a Getting Started list. Hidden (Hide amounts), the screen
 * shows the mask and screen readers hear "amount hidden", never the mask's
 * dots or the real figure.
 */
export function Amount({ text, spoken, hidden }: { text: string; spoken: string; hidden: boolean }) {
  if (!hidden) return <>{text}</>
  return <><span aria-hidden="true">{text}</span><span className="visually-hidden">{spoken}</span></>
}

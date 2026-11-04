import { useEffect, useRef, useState } from 'react'

/** Counter follows confirmed changes only. Reduced motion always renders the final amount. */
export function AnimatedSaved({ value, format }: { value: number; format: (value: number) => string }) {
  const [shown, setShown] = useState(value)
  const previous = useRef(value)
  const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  useEffect(() => {
    const from = previous.current
    if (reduced || from === value) { previous.current = value; return }
    let frame = 0
    let start: number | null = null
    const step = (now: number) => {
      start ??= now
      const fraction = Math.min((now - start) / 700, 1)
      const next = Math.round(from + (value - from) * (1 - Math.pow(1 - fraction, 3)))
      previous.current = next
      setShown(next)
      if (fraction < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [value, reduced])
  return <strong>{format(reduced ? value : shown)}</strong>
}

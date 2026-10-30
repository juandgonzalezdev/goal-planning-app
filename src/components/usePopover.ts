import { useEffect, useRef, useState } from 'react'

/**
 * A small panel that opens from a button (the Home options menu, the demo
 * menu). It closes when an option is chosen, on a tap or click outside, on
 * Escape, and when the keyboard leaves it with Tab. Escape and a chosen
 * option put the keyboard back on the button; a tap outside leaves the
 * focus where it went.
 */
export function usePopover<Root extends HTMLElement = HTMLDivElement>() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<Root>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const close = (returnFocus = true) => {
    setOpen(false)
    if (returnFocus) buttonRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    const outside = (target: EventTarget | null) => !(target instanceof Node && rootRef.current?.contains(target))
    const onPointerDown = (event: PointerEvent) => { if (outside(event.target)) setOpen(false) }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setOpen(false)
      buttonRef.current?.focus()
    }
    const onFocusIn = (event: FocusEvent) => { if (outside(event.target)) setOpen(false) }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('focusin', onFocusIn)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('focusin', onFocusIn)
    }
  }, [open])

  return { open, setOpen, close, rootRef, buttonRef }
}

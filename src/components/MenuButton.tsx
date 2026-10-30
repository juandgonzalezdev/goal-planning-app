import { useEffect, useId, useRef, type KeyboardEvent } from 'react'
import { Icon } from './Icon'
import { IconTip } from './IconTip'
import { usePopover } from './usePopover'

export type MenuOption = { label: string; onSelect: () => void; disabled?: boolean }

type Props = {
  /** The button's name (heard by screen readers, and shown on hover and focus). */
  label: string
  /** Choosing one closes the menu and puts the keyboard back on the button, unless the option moves it on (Customize Home). */
  options: MenuOption[]
  className?: string
}

/**
 * A three-dots button that opens a short list of actions (a menu, as
 * screen readers know it). Opening it puts the keyboard on the first
 * option; the arrow keys, Home and End move between options; Enter or
 * Space chooses one. It closes when an option is chosen, on Escape, or
 * on a tap outside.
 */
export function MenuButton({ label, options, className = '' }: Props) {
  const { open, setOpen, close, rootRef, buttonRef } = usePopover()
  const menuRef = useRef<HTMLUListElement>(null)
  const firstFocus = useRef<'first' | 'last'>('first')
  const id = useId()

  const items = () => [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])]

  useEffect(() => {
    if (!open) return
    const list = items()
    ;(firstFocus.current === 'last' ? list.at(-1) : list[0])?.focus()
  }, [open])

  const openWith = (where: 'first' | 'last') => { firstFocus.current = where; setOpen(true) }

  const onButtonKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      openWith(event.key === 'ArrowUp' ? 'last' : 'first')
    }
  }

  const onMenuKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const list = items()
    const at = list.indexOf(document.activeElement as HTMLButtonElement)
    const go = (index: number) => { event.preventDefault(); list[(index + list.length) % list.length]?.focus() }
    if (event.key === 'ArrowDown') go(at + 1)
    else if (event.key === 'ArrowUp') go(at - 1)
    else if (event.key === 'Home') go(0)
    else if (event.key === 'End') go(list.length - 1)
    else if (event.key === 'Tab') setOpen(false)
  }

  const choose = (option: MenuOption) => {
    close()
    option.onSelect()
  }

  return (
    <div className={`menu-root ${className}`} ref={rootRef}>
      <button ref={buttonRef} type="button" className="icon-button tool-button has-tip" aria-label={label} aria-haspopup="menu" aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined} onClick={() => (open ? close() : openWith('first'))} onKeyDown={onButtonKeyDown}>
        <Icon name="more" size={20} />
        {!open && <IconTip label={label} />}
      </button>
      {open && (
        <ul ref={menuRef} id={`${id}-menu`} className="popover menu-list" role="menu" aria-label={label} onKeyDown={onMenuKeyDown}>
          {options.map(option => (
            <li key={option.label} role="none">
              <button type="button" role="menuitem" tabIndex={-1} className="menu-item" disabled={option.disabled} onClick={() => choose(option)}>{option.label}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

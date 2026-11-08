// @vitest-environment jsdom
import { useState } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MonthSwitch } from './MonthSwitch'

afterEach(cleanup)
function Harness({ initial = '2026-12' }: { initial?: string }) {
  const [month, setMonth] = useState(initial)
  return <MonthSwitch months={[]} value={month} onChange={setMonth} />
}
const front = () => screen.getByRole('button', { name: /^Choose month:/ }) as HTMLButtonElement
const value = () => front().value
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }))
const open = () => fireEvent.click(front())
function pointer(target: Element, type: string, x: number, y: number, id = 1) {
  const event = new Event(type, { bubbles: true })
  Object.assign(event, { pointerId: id, button: 0, clientX: x, clientY: y })
  fireEvent(target, event)
}

describe('continuous month wheel', () => {
  it('announces only accepted changes', () => {
    const onChange = vi.fn()
    const { container } = render(<MonthSwitch months={[]} value="2026-12" onChange={onChange} />)
    click('Next month')
    expect(onChange).toHaveBeenCalledWith('2027-01')
    expect(value()).toBe('2026-12')
    expect(container.querySelector('[aria-live]')?.textContent).toBe('')
  })
  it('crosses years repeatedly in both directions', () => {
    render(<Harness />)
    for (let i = 0; i < 26; i++) click('Next month')
    expect(value()).toBe('2029-02')
    for (let i = 0; i < 50; i++) click('Previous month')
    expect(value()).toBe('2024-12')
  })
  it('supports keyboard months, years and first/last month', () => {
    render(<Harness />)
    fireEvent.keyDown(front(), { key: 'ArrowRight' }); expect(value()).toBe('2027-01')
    fireEvent.keyDown(front(), { key: 'PageUp' }); expect(value()).toBe('2026-01')
    fireEvent.keyDown(front(), { key: 'End' }); expect(value()).toBe('2026-12')
    fireEvent.keyDown(front(), { key: 'Home' }); expect(value()).toBe('2026-01')
  })
  it('has exactly three controls when closed and one disclosure tied to a modal outside the wheel', () => {
    const { container } = render(<Harness />)
    expect(screen.getAllByRole('button')).toHaveLength(3)
    expect(screen.queryByRole('combobox')).toBeNull()
    open()
    const panel = screen.getByRole('dialog', { name: 'Choose month' })
    expect(front().getAttribute('aria-controls')).toBe(panel.id)
    expect(front().getAttribute('aria-expanded')).toBe('true')
    expect(container.contains(panel)).toBe(false)
    expect(document.activeElement).toBe(within(panel).getByRole('button', { name: 'December 2026' }))
    expect(within(panel).getAllByRole('button')).toHaveLength(15)
  })
  it('allows clearing Year digit by digit and typing 1999 without restoring digits', () => {
    render(<Harness />); open()
    const year = screen.getByRole('spinbutton', { name: 'Year' }) as HTMLInputElement
    for (const text of ['202', '20', '2', '']) fireEvent.change(year, { target: { value: text } })
    expect(year.value).toBe('')
    expect((screen.getByRole('button', { name: 'January 2026' }) as HTMLButtonElement).disabled).toBe(true)
    for (const text of ['1', '19', '199', '1999']) fireEvent.change(year, { target: { value: text } })
    expect(year.value).toBe('1999')
    click('September 1999')
    expect(value()).toBe('1999-09')
    expect(document.activeElement).toBe(front())
  })
  it('rejects invalid years without selecting a fallback year', () => {
    render(<Harness />); open()
    const year = screen.getByRole('spinbutton')
    for (const text of ['0', '-1', '10000', '2.5', '']) {
      fireEvent.change(year, { target: { value: text } })
      expect(year.getAttribute('aria-invalid')).toBe('true')
      expect((screen.getByRole('button', { name: 'January 2026' }) as HTMLButtonElement).disabled).toBe(true)
    }
    click('Close'); expect(value()).toBe('2026-12')
  })
  it('selects distant years; Escape on the opener or in the modal restores focus', () => {
    render(<Harness />); open()
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '2040' } })
    click('February 2040'); expect(value()).toBe('2040-02')
    expect(document.activeElement).toBe(front())
    open(); fireEvent.keyDown(front(), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    open(); fireEvent.keyDown(screen.getByRole('spinbutton'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(front())
  })
  it('initially focuses the selected month at different calendar positions', () => {
    const { unmount } = render(<Harness initial="2040-02" />)
    open()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'February 2040' }))
    click('Close')
    expect(document.activeElement).toBe(front())
    unmount()
    render(<Harness initial="2027-01" />)
    open()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'January 2027' }))
  })
  it('preserves the existing calendar format boundaries', () => {
    const { unmount } = render(<Harness initial="0001-01" />)
    expect((screen.getByRole('button', { name: 'Previous month' }) as HTMLButtonElement).disabled).toBe(true)
    unmount(); render(<Harness initial="9999-12" />)
    click('Next month'); expect(value()).toBe('9999-12')
  })
  it('captures on the button, suppresses the compatibility click once, then accepts keyboard activation', () => {
    render(<Harness />)
    const capture = vi.fn(); front().setPointerCapture = capture
    pointer(front(), 'pointerdown', 120, 0)
    expect(capture).toHaveBeenCalledWith(1)
    pointer(front(), 'pointermove', 110, 0)
    pointer(front(), 'pointermove', 10, 5)
    pointer(front(), 'pointerup', 10, 5)
    expect(value()).toBe('2027-01')
    fireEvent.click(front(), { detail: 1 })
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(front(), { detail: 0 })
    expect(screen.getByRole('dialog')).toBeTruthy()
  })
  it('does not swallow the first keyboard click after a swipe without compatibility click', () => {
    render(<Harness />)
    pointer(front(), 'pointerdown', 120, 0); pointer(front(), 'pointerup', 40, 5)
    fireEvent.click(front(), { detail: 0 })
    expect(screen.getByRole('dialog')).toBeTruthy()
  })
  it('rejects vertical scrolling, short gestures, secondary pointers and cancellation', () => {
    render(<Harness />)
    pointer(front(), 'pointerdown', 120, 0); pointer(front(), 'pointerup', 40, 100)
    pointer(front(), 'pointerdown', 120, 0); pointer(front(), 'pointerup', 100, 0)
    pointer(front(), 'pointerdown', 120, 0); pointer(front(), 'pointerup', 40, 0, 2)
    pointer(front(), 'pointercancel', 0, 0); pointer(front(), 'pointerup', 0, 0)
    expect(value()).toBe('2026-12')
  })
})

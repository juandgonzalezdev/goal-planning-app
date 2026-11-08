// @vitest-environment jsdom
import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MonthSwitch } from './MonthSwitch'

let media: EventTarget & { matches: boolean }
beforeEach(() => {
  vi.useFakeTimers({ now: 0 })
  vi.spyOn(performance, 'now').mockImplementation(() => Date.now())
  media = Object.assign(new EventTarget(), { matches: false })
  vi.stubGlobal('matchMedia', vi.fn(() => media))
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
const front = () => screen.getByRole('button', { name: /^Choose month:/ }) as HTMLButtonElement
function Fixture({ accept }: { accept: (month: string) => void }) {
  const [month, setMonth] = useState('2026-12')
  return <MonthSwitch months={[]} value={month} onChange={next => { accept(next); setMonth(next) }} />
}
function point(type: string, x: number, time: number) {
  const event = new Event(type, { bubbles: true })
  Object.assign(event, { pointerId: 1, button: 0, isPrimary: true, clientX: x, clientY: 0 })
  Object.defineProperty(event, 'timeStamp', { value: time })
  fireEvent(front(), event)
}
function flick() { point('pointerdown', 240, 0); point('pointermove', 220, 10); point('pointermove', 80, 40); point('pointerup', 80, 40) }
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms))

describe('React v2 motion lifecycle', () => {
  it('does not update the owner or announce intermediate frames; settles once', () => {
    const accept = vi.fn(); const { container } = render(<Fixture accept={accept} />)
    flick(); advance(80)
    expect(accept).not.toHaveBeenCalled()
    expect(front().value).toBe('2026-12')
    expect(container.querySelector('[aria-live]')?.textContent).toBe('')
    expect(container.querySelectorAll('.month-face').length).toBeLessThanOrEqual(8)
    advance(6000)
    expect(accept).toHaveBeenCalledTimes(1)
    expect(front().value).not.toBe('2026-12')
    expect(container.querySelector('[aria-live]')?.textContent).not.toBe('')
  })
  it.each(['blur', 'pagehide'])('stops a glide on window %s without committing its preview', event => {
    const accept = vi.fn(); render(<Fixture accept={accept} />)
    flick(); advance(80); fireEvent(window, new Event(event)); advance(6000)
    expect(accept).not.toHaveBeenCalled(); expect(front().value).toBe('2026-12')
    expect(vi.getTimerCount()).toBe(0)
  })
  it('stops when the page is hidden or focus leaves the wheel', () => {
    const accept = vi.fn(); render(<Fixture accept={accept} />)
    flick(); advance(80)
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    fireEvent(document, new Event('visibilitychange')); advance(6000)
    expect(accept).not.toHaveBeenCalled()
    flick(); advance(80); fireEvent.blur(front(), { relatedTarget: document.body }); advance(6000)
    expect(accept).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0)
  })
  it('activating reduced motion stops inertia and keeps button selection immediate', () => {
    const accept = vi.fn(); const { container } = render(<Fixture accept={accept} />)
    flick(); advance(80)
    act(() => { media.matches = true; media.dispatchEvent(new Event('change')) })
    advance(6000); expect(accept).not.toHaveBeenCalled()
    expect(container.querySelector('.month-carousel')?.classList.contains('is-flat')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }))
    expect(front().value).toBe('2027-01')
  })
  it('opening the grid stops the glide, focuses the accepted month, and jumps directly', () => {
    const accept = vi.fn(); render(<Fixture accept={accept} />)
    flick(); advance(80); fireEvent.click(front(), { detail: 0 })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'December 2026' }))
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '2040' } })
    fireEvent.click(screen.getByRole('button', { name: 'February 2040' }))
    expect(front().value).toBe('2040-02')
    advance(6000); expect(accept).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(front())
  })
  it('unmount cancels an accelerating hold and removes every scheduled callback', () => {
    const accept = vi.fn(); const { unmount } = render(<Fixture accept={accept} />)
    const event = new Event('pointerdown', { bubbles: true })
    Object.assign(event, { pointerId: 1, button: 0, isPrimary: true, clientX: 290, clientY: 0 })
    fireEvent(screen.getByRole('button', { name: 'Next month' }), event)
    advance(1600); expect(accept).not.toHaveBeenCalled()
    unmount(); expect(vi.getTimerCount()).toBe(0)
    advance(6000); expect(accept).not.toHaveBeenCalled()
  })
})

it.each(['pointercancel','lostpointercapture'])('settles the captured visible month on %s', type=>{
  const accept=vi.fn(); const {container}=render(<Fixture accept={accept}/>)
  flick(); advance(120); point('pointerdown',150,160)
  const wheel=container.querySelector<HTMLElement>('.month-carousel')!
  const visible=Number(wheel.dataset.visualMonth)
  point(type,150,180)
  expect(Number(wheel.dataset.visualMonth)).toBe(visible)
  advance(4000)
  expect(accept).toHaveBeenCalledTimes(1)
  expect(Number(wheel.dataset.visualMonth)).toBe(Math.round(visible))
})
it('does not write a stale visual month before React commits the accepted gesture',()=>{
  const accept=vi.fn(); const {container}=render(<Fixture accept={accept}/>)
  const wheel=container.querySelector<HTMLElement>('.month-carousel')!
  const observer=new MutationObserver(()=>{})
  observer.observe(wheel,{attributes:true,attributeFilter:['data-visual-month'],attributeOldValue:true})
  flick(); advance(6000)
  const writes=observer.takeRecords().map(record=>Number(record.oldValue))
  const visual=wheel.dataset.visualMonth
  observer.disconnect()
  const final=Number(visual)
  expect(accept).toHaveBeenCalledTimes(1)
  expect(writes.every((n,i)=>i===0 || n>=writes[i-1])).toBe(true)
  expect(final).toBeGreaterThan(2026*12+11)
})

it('ignores capture transfer from a button to the wheel during drag',()=>{
  const accept=vi.fn(); const {container}=render(<Fixture accept={accept}/>)
  point('pointerdown',240,0); point('pointermove',220,10); point('pointermove',80,40)
  const wheel=container.querySelector<HTMLElement>('.month-carousel')!
  Object.defineProperty(wheel,'hasPointerCapture',{value:()=>true,configurable:true})
  point('lostpointercapture',80,40)
  point('pointermove',30,70)
  expect(accept).not.toHaveBeenCalled()
  point('pointerup',30,80); advance(6000)
  expect(accept).toHaveBeenCalledTimes(1)
})

// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ThemeToggle } from './ThemeToggle'

afterEach(() => { cleanup(); vi.useRealTimers() })
describe('theme action confirmation', () => {
  it('announces a kept change once, expires, and does not announce external System/Settings changes', async () => {
    vi.useFakeTimers()
    const onChange = vi.fn().mockResolvedValue('demo')
    const view = render(<ThemeToggle dark={false} onChange={onChange} />)
    expect(screen.getByRole('status').textContent).toBe('')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' })) })
    expect(onChange).toHaveBeenCalledWith(true)
    expect(screen.getByRole('status').textContent).toBe('')
    view.rerender(<ThemeToggle dark onChange={onChange} />)
    expect(screen.getByRole('status').textContent).toBe('Dark mode on')
    expect(document.querySelector('.theme-toggle.is-confirming')).toBeTruthy()
    act(() => vi.advanceTimersByTime(2000))
    expect(screen.getByRole('status').textContent).toBe('')
    view.rerender(<ThemeToggle dark onChange={onChange} />)
    expect(screen.getByRole('status').textContent).toBe('')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Switch to light mode' })) })
    view.rerender(<ThemeToggle dark={false} onChange={onChange} />)
    expect(screen.getByRole('status').textContent).toBe('Light mode on')
    view.rerender(<ThemeToggle dark onChange={onChange} />)
    expect(screen.getByRole('status').textContent).toBe('')
    view.unmount(); expect(vi.getTimerCount()).toBe(0)
  })
  it('does not announce a rejected appearance change or an unmounted pending response', async () => {
    const onChange = vi.fn().mockResolvedValue('not-saved')
    const view = render(<ThemeToggle dark={false} onChange={onChange} />)
    await act(async () => { fireEvent.click(screen.getByRole('button')) })
    expect(screen.getByRole('status').textContent).toBe('')
    let finish!: (outcome: 'saved') => void
    view.rerender(<ThemeToggle dark={false} onChange={() => new Promise(resolve => { finish = resolve })} />)
    fireEvent.click(screen.getByRole('button')); view.unmount()
    await act(async () => finish('saved'))
    expect(screen.queryByRole('status')).toBeNull()
  })
})

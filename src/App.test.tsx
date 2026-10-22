// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'

// Invented example values and a fixed date.
const TODAY = '2026-10-21'

afterEach(cleanup)

const button = (name: string | RegExp) => screen.getByRole('button', { name })
const heading = (name: string | RegExp) => screen.getByRole('heading', { name })
const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement
const type = (label: string, value: string) => fireEvent.change(field(label), { target: { value } })
const section = (name: 'goals' | 'money') => document.querySelector<HTMLElement>(`[data-screen="${name}"]`)!

function start() {
  return render(<App getToday={() => TODAY} />)
}

function openMySpace() {
  start()
  fireEvent.click(button('Explore the App'))
}

/** Waits for the browser to finish a history move and the app to show it. */
async function browserBack() {
  await act(async () => {
    window.history.back()
    await new Promise(resolve => setTimeout(resolve, 20))
  })
}

describe('Welcome', () => {
  it('opens with the welcome message and both choices', () => {
    start()
    expect(heading('Your goals, your way.')).toBeTruthy()
    expect(button(/Get Started/)).toBeTruthy()
    expect(button('Explore the App')).toBeTruthy()
    expect(screen.getByText(/Nothing saved after you close or refresh the page/)).toBeTruthy()
  })

  it('shows neither the goal flow nor My Money until they are opened', () => {
    start()
    expect(section('goals').hidden).toBe(true)
    expect(section('money').hidden).toBe(true)
    expect(screen.queryByRole('button', { name: 'Evaluate goal' })).toBeNull()
  })
})

describe('Choose Your Space', () => {
  it('has Personal selected, and Duo and Group marked as not available yet', () => {
    start()
    fireEvent.click(button(/Get Started/))
    expect(heading('How would you like to plan?')).toBeTruthy()

    const personal = screen.getByRole('radio', { name: /Personal/ }) as HTMLInputElement
    const duo = screen.getByRole('radio', { name: /Duo/ }) as HTMLInputElement
    const group = screen.getByRole('radio', { name: /Group/ }) as HTMLInputElement
    expect(personal.checked).toBe(true)
    expect(personal.disabled).toBe(false)
    for (const option of [duo, group]) {
      expect(option.checked).toBe(false)
      expect(option.disabled).toBe(true)
      expect(option.closest('label')!.textContent).toContain('Coming soon')
    }
    expect(screen.getByText('Only you see your plans.', { exact: false })).toBeTruthy()
  })

  it('continues to My Space in the Personal space', () => {
    start()
    fireEvent.click(button(/Get Started/))
    fireEvent.click(button(/Continue/))
    expect(heading('My Space')).toBeTruthy()
    expect(screen.getByText('Personal space')).toBeTruthy()
  })
})

describe('My Space', () => {
  it('is reached straight from Explore the App', () => {
    openMySpace()
    expect(heading('My Space')).toBeTruthy()
    expect(screen.getByText('Personal space')).toBeTruthy()
  })

  it('shows the empty state when there is no goal', () => {
    openMySpace()
    expect(heading('No goals yet')).toBeTruthy()
    expect(button(/Create a Goal/)).toBeTruthy()
  })

  it('opens the existing goal flow from Create a Goal and from My Goals', async () => {
    openMySpace()
    fireEvent.click(button(/Create a Goal/))
    expect(section('goals').hidden).toBe(false)
    expect(button('Evaluate goal')).toBeTruthy()

    fireEvent.click(button('My Space'))
    await waitFor(() => expect(heading('My Space')).toBeTruthy())
    fireEvent.click(button(/^My Goals/))
    expect(button('Evaluate goal')).toBeTruthy()
  })

  it('opens My Money with its inline calculator', () => {
    openMySpace()
    fireEvent.click(button(/^My Money/))
    expect(heading('My Money')).toBeTruthy()
    fireEvent.click(button('+ Add'))
    expect(screen.getByText('What If I Pay Extra?')).toBeTruthy()
  })

  it('shows the Assistant as coming soon, with nothing to press', () => {
    openMySpace()
    expect(screen.getByText('Assistant').parentElement!.textContent).toContain('Coming soon')
    expect(screen.queryByRole('button', { name: /Assistant/ })).toBeNull()
  })
})

describe('Keeping information between screens', () => {
  it('keeps loans and calculator results in My Money after visiting other screens', async () => {
    openMySpace()
    fireEvent.click(button(/^My Money/))
    type('Monthly Income (PLN)', '5000')
    fireEvent.click(button('+ Add'))
    type('Name (optional)', 'Test loan')
    type('Remaining Balance (PLN)', '12000')
    type('Yearly Interest (%)', '12')
    type('Monthly Payment (PLN)', '1000')
    type('Extra Each Month (PLN)', '200')
    expect(screen.getByText('Months Saved').nextElementSibling!.textContent).toBe('2')

    fireEvent.click(button('← My Space'))
    await waitFor(() => expect(heading('My Space')).toBeTruthy())
    fireEvent.click(button(/^My Goals/))
    fireEvent.click(button('My Space'))
    await waitFor(() => expect(heading('My Space')).toBeTruthy())
    fireEvent.click(button(/^My Money/))

    expect(field('Monthly Income (PLN)').value).toBe('5000')
    expect(field('Name (optional)').value).toBe('Test loan')
    expect(field('Extra Each Month (PLN)').value).toBe('200')
    expect(screen.getByText('Months Saved').nextElementSibling!.textContent).toBe('2')
  })

  it('keeps typed goal values and the evaluated result after visiting My Money', async () => {
    openMySpace()
    fireEvent.click(button(/Create a Goal/))
    type('Goal name', 'Holiday fund')
    type('Target amount (PLN)', '12000')
    fireEvent.click(button('Evaluate goal'))
    const result = screen.getByRole('heading', { level: 2, name: /^(Plan|Goal|Monthly)/ }).textContent

    fireEvent.click(button('My Space'))
    await waitFor(() => expect(heading('My Space')).toBeTruthy())
    fireEvent.click(button(/^My Money/))
    fireEvent.click(button('← My Space'))
    await waitFor(() => expect(heading('My Space')).toBeTruthy())
    fireEvent.click(button(/^My Goals/))

    expect(field('Goal name').value).toBe('Holiday fund')
    expect(field('Target amount (PLN)').value).toBe('12000')
    expect(screen.getByRole('heading', { level: 2, name: /^(Plan|Goal|Monthly)/ }).textContent).toBe(result)
  })

  it('never creates a goal by itself, and shows a goal only after Confirm', async () => {
    openMySpace()
    fireEvent.click(button(/Create a Goal/))
    type('Goal name', 'Holiday fund')
    fireEvent.click(button('Evaluate goal'))
    fireEvent.click(button('Review goal'))

    // Leaving at Review creates nothing.
    fireEvent.click(button('My Space'))
    await waitFor(() => expect(heading('My Space')).toBeTruthy())
    expect(heading('No goals yet')).toBeTruthy()

    fireEvent.click(button(/^My Goals/))
    fireEvent.click(button('Confirm goal'))
    fireEvent.click(button('My Space'))
    await waitFor(() => expect(heading('My Space')).toBeTruthy())
    expect(screen.queryByRole('heading', { name: 'No goals yet' })).toBeNull()
    const goal = screen.getByRole('region', { name: 'Holiday fund' })
    expect(within(goal).getByRole('progressbar')).toBeTruthy()
    expect(within(goal).getByRole('button', { name: /View goal/ })).toBeTruthy()
  })
})

describe('Hidden sections', () => {
  it('are hidden from the keyboard and screen readers', () => {
    openMySpace()
    fireEvent.click(button(/^My Money/))
    fireEvent.click(button('+ Add'))
    // The goal flow is on the page but hidden: none of its controls are exposed.
    expect(section('goals').hidden).toBe(true)
    expect(screen.queryByRole('button', { name: 'Evaluate goal' })).toBeNull()
    expect(screen.queryByRole('textbox', { name: 'Goal name' })).toBeNull()
  })
})

describe('Back navigation', () => {
  it('goes back one screen at a time with the browser back button', async () => {
    start()
    fireEvent.click(button(/Get Started/))
    fireEvent.click(button(/Continue/))
    fireEvent.click(button(/^My Money/))
    expect(heading('My Money')).toBeTruthy()

    await browserBack()
    expect(heading('My Space')).toBeTruthy()
    await browserBack()
    expect(heading('How would you like to plan?')).toBeTruthy()
    await browserBack()
    expect(heading('Your goals, your way.')).toBeTruthy()
  })

  it('goes back from Choose Your Space to Welcome with the Back link', async () => {
    start()
    fireEvent.click(button(/Get Started/))
    fireEvent.click(button('Back'))
    await waitFor(() => expect(heading('Your goals, your way.')).toBeTruthy())
  })

  it('slides the matching way for forward and back moves', async () => {
    const { container } = start()
    const shell = container.querySelector('.shell')!
    fireEvent.click(button('Explore the App'))
    expect(shell.getAttribute('data-direction')).toBe('forward')
    await browserBack()
    expect(shell.getAttribute('data-direction')).toBe('back')
  })
})

describe('Focus', () => {
  it('moves to the new screen title after each move', async () => {
    start()
    fireEvent.click(button(/Get Started/))
    expect(document.activeElement).toBe(heading('How would you like to plan?'))
    fireEvent.click(button(/Continue/))
    expect(document.activeElement).toBe(heading('My Space'))
    fireEvent.click(button(/^My Money/))
    expect(document.activeElement).toBe(heading('My Money'))
    await browserBack()
    expect(document.activeElement).toBe(heading('My Space'))
  })
})

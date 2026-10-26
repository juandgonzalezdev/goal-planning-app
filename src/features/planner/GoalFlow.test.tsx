// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { GoalPlanner } from './GoalPlanner'

// Invented example values, fixed date. With these inputs:
// target 12,000, saved 3,000, target date 21 Oct 2027 (12 months), 600 a month.
// Remaining 9,000 -> required 750.00 a month, shortfall 150.00.
// 12 x 600.00 = 7,200.00, leaving 1,800.00 uncovered by the target date.
const TODAY = '2026-10-21'
const PLAN = { target: '12000', saved: '3000', date: '2027-10-21', monthly: '600' }

afterEach(cleanup)

// Intl puts a non-breaking space between 'PLN' and the amount.
const NBSP = new RegExp(String.fromCharCode(160), 'g')
const text = (element: HTMLElement) => element.textContent!.replace(NBSP, ' ')

const LABELS = { name: 'Goal name', description: 'Description (optional)', target: 'Target amount (PLN)', saved: 'Already saved (PLN)', date: 'Target date', monthly: 'Comfortable monthly contribution (PLN)' }
type FieldKey = keyof typeof LABELS

const input = (key: FieldKey) => screen.getByLabelText(LABELS[key]) as HTMLInputElement
const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement
const type = (key: FieldKey, value: string) => fireEvent.change(input(key), { target: { value } })
const fill = (fields: Partial<Record<FieldKey, string>>) => { for (const [key, value] of Object.entries(fields)) type(key as FieldKey, value) }
const reviewPanel = () => screen.getByRole('region', { name: 'Check your goal before confirming' })
const confirmedSection = () => screen.getByRole('region', { name: 'What you confirmed' })
const projectionSection = () => screen.getByRole('region', { name: 'Today’s projection' })

function start(fields: Partial<Record<FieldKey, string>> = {}, getToday = () => TODAY) {
  const view = render(<GoalPlanner getToday={getToday} />)
  fill({ ...PLAN, ...fields })
  fireEvent.click(button('Evaluate goal'))
  return view
}

function confirmNew(fields: Partial<Record<FieldKey, string>> = {}) {
  start({ name: 'Holiday fund', description: 'Two weeks by the sea', ...fields })
  fireEvent.click(button('Review goal'))
  fireEvent.click(button('Confirm goal'))
}

function applyAlternative(name: 'Increase monthly contribution' | 'Extend target date') {
  fireEvent.click(button('Explore alternatives'))
  fireEvent.click(within(screen.getByRole('article', { name })).getByRole('button', { name: 'Use this alternative' }))
  fireEvent.click(button('Confirm change'))
}

describe('Goal review: eligibility', () => {
  it('is unavailable until the goal has a name', () => {
    start()
    expect(button('Review goal').disabled).toBe(true)
    expect(screen.getByText('Add a goal name.')).toBeTruthy()
    type('name', '   ')
    expect(button('Review goal').disabled).toBe(true)
    type('name', 'Holiday fund')
    expect(button('Review goal').disabled).toBe(false)
  })

  it('is unavailable before the plan is evaluated', () => {
    render(<GoalPlanner getToday={() => TODAY} />)
    fill({ ...PLAN, name: 'Holiday fund' })
    expect(button('Review goal').disabled).toBe(true)
    expect(screen.getByText('Evaluate the plan.')).toBeTruthy()
  })

  it('becomes unavailable when any financial input changes, until evaluated again', () => {
    for (const [key, value] of [['target', '13000'], ['saved', '3500'], ['date', '2027-11-21'], ['monthly', '650']] as const) {
      start({ name: 'Holiday fund' })
      type(key, value)
      expect(button('Review goal').disabled).toBe(true)
      expect(screen.getByText('Evaluate your changed inputs.')).toBeTruthy()
      fireEvent.click(button('Evaluate goal'))
      expect(button('Review goal').disabled).toBe(false)
      cleanup()
    }
  })

  it('keeps the evaluation valid when only the name or description changes', () => {
    start({ name: 'Holiday fund' })
    type('name', 'Summer holiday')
    type('description', 'Flights and hotel')
    expect(button('Review goal').disabled).toBe(false)
    expect(screen.queryByText(/Inputs changed/)).toBeNull()
  })

  it('refuses a name over 60 characters and a description over 200', () => {
    start({ name: 'a'.repeat(61) })
    expect(button('Review goal').disabled).toBe(true)
    expect(screen.getByText('Shorten the goal name to 60 characters or fewer.')).toBeTruthy()
    type('name', 'a'.repeat(60))
    type('description', 'd'.repeat(201))
    expect(screen.getByText('Shorten the description to 200 characters or fewer.')).toBeTruthy()
    type('description', 'd'.repeat(200))
    expect(button('Review goal').disabled).toBe(false)
  })

  it('blocks an invalid target date and a deadline without a monthly plan', () => {
    start({ name: 'Holiday fund', date: TODAY })
    expect(button('Review goal').disabled).toBe(true)
    expect(screen.getByText('Choose a target date after today.')).toBeTruthy()
    type('date', '2026-11-10')
    fireEvent.click(button('Evaluate goal'))
    expect(button('Review goal').disabled).toBe(true)
    expect(screen.getByText('Choose a target date at least one full month away.')).toBeTruthy()
  })
})

describe('Goal review: content', () => {
  it('shows the trimmed details and the evaluated values', () => {
    start({ name: '  Holiday fund  ', description: '  Two weeks by the sea ' })
    fireEvent.click(button('Review goal'))
    const review = text(reviewPanel())
    expect(review).toContain('Holiday fund')
    expect(review).not.toContain('  Holiday fund')
    expect(review).toContain('Two weeks by the sea')
    expect(review).toContain('Target amountPLN 12,000.00')
    expect(review).toContain('Already saved (as you entered it)PLN 3,000.00')
    expect(review).toContain('Remaining amountPLN 9,000.00')
    expect(review).toContain('Target date21 Oct 2027')
    expect(review).toContain('Your monthly contributionPLN 600.00')
    expect(review).toContain('Required monthly contributionPLN 750.00')
  })

  it('explains the shortfall and what confirming it means', () => {
    start({ name: 'Holiday fund' })
    fireEvent.click(button('Review goal'))
    const review = text(reviewPanel())
    expect(review).toContain('Planning statePlan needs adjustment')
    expect(review).toContain('PLN 150.00 a month below the calculated requirement of PLN 750.00')
    expect(review).toContain('12 months of contributions would add up to PLN 7,200.00 by 21 Oct 2027')
    expect(review).toContain('leaves PLN 1,800.00 of the remaining amount uncovered')
  })

  it('presents an already funded goal without asking for monthly contributions', () => {
    start({ name: 'Laptop', saved: '12000' })
    fireEvent.click(button('Review goal'))
    const review = text(reviewPanel())
    expect(review).toContain('No monthly contributions are needed')
    expect(review).toContain('Your monthly contributionNot needed, target already met')
    expect(review).not.toContain('Required monthly contribution')
  })

  it('says the goal is kept only while the page is open', () => {
    start({ name: 'Holiday fund' })
    fireEvent.click(button('Review goal'))
    expect(text(reviewPanel())).toContain('Refreshing or closing the page will remove it')
  })

  it('shows the latest name after going back and changing it', () => {
    start({ name: 'Holiday fund' })
    fireEvent.click(button('Review goal'))
    fireEvent.click(button('Back to edit'))
    type('name', 'Summer holiday')
    fireEvent.click(button('Review goal'))
    expect(text(reviewPanel())).toContain('Summer holiday')
    expect(text(reviewPanel())).not.toContain('Holiday fund')
  })

  it('closes a pending alternative confirmation without applying it', () => {
    start({ name: 'Holiday fund' })
    fireEvent.click(button('Explore alternatives'))
    fireEvent.click(within(screen.getByRole('article', { name: 'Increase monthly contribution' })).getByRole('button', { name: 'Use this alternative' }))
    fireEvent.click(button('Review goal'))
    expect(text(reviewPanel())).toContain('Your monthly contributionPLN 600.00')
    fireEvent.click(button('Back to edit'))
    expect(input('monthly').value).toBe('600')
    expect(screen.queryByRole('group', { name: 'Confirm change' })).toBeNull()
  })
})

describe('Goal confirmation', () => {
  it('creates nothing until "Confirm goal" is selected; going back keeps the draft', () => {
    start({ name: 'Holiday fund' })
    applyAlternative('Extend target date')
    fireEvent.click(button('Review goal'))
    fireEvent.click(button('Back to edit'))
    expect(screen.queryByRole('region', { name: 'What you confirmed' })).toBeNull()
    expect(input('name').value).toBe('Holiday fund')
    expect(input('date').value).toBe('2028-01-21')
    expect(button('Restore previous plan').disabled).toBe(false)
  })

  it('shows the confirmed goal separately from today’s projection', () => {
    confirmNew()
    expect(screen.getByRole('heading', { level: 2, name: 'Holiday fund' })).toBeTruthy()
    expect(screen.getByText('Two weeks by the sea')).toBeTruthy()
    expect(screen.getByText('Confirmed on 21 Oct 2026')).toBeTruthy()

    const confirmed = text(confirmedSection())
    expect(confirmed).toContain('Target amountPLN 12,000.00')
    expect(confirmed).toContain('Already saved (entered 21 Oct 2026)PLN 3,000.00')
    expect(confirmed).toContain('Target date21 Oct 2027')
    expect(confirmed).toContain('Your monthly contributionPLN 600.00')
    expect(confirmed).toContain('Planning state when confirmedPlan needs adjustment')

    const projection = text(projectionSection())
    expect(projection).toContain('Calculated on 21 Oct 2026 from the values you confirmed')
    expect(projection).toContain('Remaining amountPLN 9,000.00')
    expect(projection).toContain('Monthly opportunities12')
    expect(projection).toContain('Required monthly contributionPLN 750.00')
    expect(projection).toContain('Monthly shortfallPLN 150.00')
  })

  it('states that the goal is not saved and the savings are not verified', () => {
    confirmNew()
    expect(screen.getByText(/Not saved: this prototype keeps your goal only while this page stays open/)).toBeTruthy()
    expect(screen.getByText(/It has not been verified or updated automatically/)).toBeTruthy()
  })

  it('stores the values of an alternative applied before confirming', () => {
    start({ name: 'Holiday fund' })
    applyAlternative('Increase monthly contribution')
    fireEvent.click(button('Review goal'))
    fireEvent.click(button('Confirm goal'))
    expect(text(confirmedSection())).toContain('Your monthly contributionPLN 750.00')
    expect(text(confirmedSection())).toContain('Planning state when confirmedPlan is supported')
  })

  it('recalculates today’s projection on a later day without changing the confirmed goal', () => {
    let today = TODAY
    const getToday = () => today
    const { rerender } = start({ name: 'Holiday fund' }, getToday)
    fireEvent.click(button('Review goal'))
    fireEvent.click(button('Confirm goal'))

    today = '2027-04-21'
    rerender(<GoalPlanner getToday={getToday} />)
    const projection = text(projectionSection())
    expect(projection).toContain('Calculated on 21 Apr 2027')
    expect(projection).toContain('Monthly opportunities6')
    expect(projection).toContain('Required monthly contributionPLN 1,500.00')
    // Savings are not assumed to have grown: the entered amount stays as it was.
    expect(projection).toContain('Remaining amountPLN 9,000.00')
    const confirmed = text(confirmedSection())
    expect(confirmed).toContain('Already saved (entered 21 Oct 2026)PLN 3,000.00')
    expect(confirmed).toContain('Your monthly contributionPLN 600.00')
    expect(screen.getByText('Confirmed on 21 Oct 2026')).toBeTruthy()
  })
})

describe('Editing a confirmed goal', () => {
  it('opens the draft with the confirmed values and a clear notice', () => {
    confirmNew()
    fireEvent.click(button('Edit goal'))
    expect(input('name').value).toBe('Holiday fund')
    expect(input('description').value).toBe('Two weeks by the sea')
    expect(input('target').value).toBe('12000.00')
    expect(input('saved').value).toBe('3000.00')
    expect(input('date').value).toBe('2027-10-21')
    expect(input('monthly').value).toBe('600.00')
    expect(text(screen.getByRole('region', { name: 'Editing confirmed goal' }))).toContain('Changes apply only when you review and confirm again')
  })

  it('restores the exact confirmed goal on cancel, even after an alternative was applied', () => {
    confirmNew()
    fireEvent.click(button('Edit goal'))
    type('name', 'Changed name')
    type('description', 'Changed description')
    applyAlternative('Extend target date')
    type('target', '15000')
    fireEvent.click(button('Cancel editing'))

    expect(screen.getByRole('heading', { level: 2, name: 'Holiday fund' })).toBeTruthy()
    expect(screen.getByText('Two weeks by the sea')).toBeTruthy()
    const confirmed = text(confirmedSection())
    expect(confirmed).toContain('Target amountPLN 12,000.00')
    expect(confirmed).toContain('Target date21 Oct 2027')
    expect(confirmed).toContain('Your monthly contributionPLN 600.00')
    expect(screen.getByText('Confirmed on 21 Oct 2026')).toBeTruthy()

    // Editing again starts from the confirmed goal, not the discarded draft.
    fireEvent.click(button('Edit goal'))
    expect(input('name').value).toBe('Holiday fund')
    expect(input('date').value).toBe('2027-10-21')
    expect(screen.queryByRole('region', { name: 'Applied alternative' })).toBeNull()
  })

  it('leaves the confirmed goal unchanged when backing out of the review', () => {
    confirmNew()
    fireEvent.click(button('Edit goal'))
    type('monthly', '800')
    fireEvent.click(button('Evaluate goal'))
    fireEvent.click(button('Review changes'))
    fireEvent.click(button('Back to edit'))
    fireEvent.click(button('Cancel editing'))
    expect(text(confirmedSection())).toContain('Your monthly contributionPLN 600.00')
  })

  it('requires evaluation and review before an edited goal replaces the confirmed one', () => {
    confirmNew()
    fireEvent.click(button('Edit goal'))
    type('name', 'Summer holiday')
    type('monthly', '800')
    expect(button('Review changes').disabled).toBe(true)
    fireEvent.click(button('Evaluate goal'))
    fireEvent.click(button('Review changes'))

    const review = text(reviewPanel())
    expect(review).toContain('Summer holiday')
    expect(review).toContain('Your monthly contributionPLN 800.00')
    expect(review).toContain('Confirming replaces the goal you confirmed on 21 Oct 2026')

    fireEvent.click(button('Confirm goal'))
    expect(screen.getByRole('heading', { level: 2, name: 'Summer holiday' })).toBeTruthy()
    expect(text(confirmedSection())).toContain('Your monthly contributionPLN 800.00')
    expect(text(confirmedSection())).toContain('Planning state when confirmedPlan is supported')
  })
})

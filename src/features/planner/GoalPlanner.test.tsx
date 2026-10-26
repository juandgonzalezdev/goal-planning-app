// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { GoalPlanner } from './GoalPlanner'

// Fixed date, so every run is identical. The default form is then:
// target 30,000, saved 24,200, target date 21 Feb 2027 (4 months), 800 a month.
// Remaining 5,800 -> required 1,450.00 a month, shortfall 650.00.
const TODAY = '2026-10-21'

afterEach(cleanup)

// Intl puts a non-breaking space between 'PLN' and the amount.
const NBSP = new RegExp(String.fromCharCode(160), 'g')

const input = (label: string) => screen.getByLabelText(label) as HTMLInputElement
const monthlyInput = () => input('Comfortable monthly contribution (PLN)')
const dateInput = () => input('Target date')
const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement
const card = (name: string) => screen.getByRole('article', { name })
const resultTitle = () => screen.getByRole('heading', { level: 2, name: /^(Plan|Goal|Monthly|Review)/ }).textContent!.replace(NBSP, ' ')

function renderAndEvaluate(fields: Partial<Record<'target' | 'saved' | 'date' | 'monthly', string>> = {}) {
  render(<GoalPlanner getToday={() => TODAY} />)
  const labels = { target: 'Target amount (PLN)', saved: 'Already saved (PLN)', date: 'Target date', monthly: 'Comfortable monthly contribution (PLN)' }
  for (const [key, value] of Object.entries(fields)) {
    fireEvent.change(input(labels[key as keyof typeof labels]), { target: { value } })
  }
  fireEvent.click(button('Evaluate goal'))
}

function openAlternatives() {
  fireEvent.click(button('Explore alternatives'))
  return screen.getByRole('region', { name: 'Compare ways to adjust this plan' })
}

describe('Explore alternatives: opening and comparing', () => {
  it('opens and closes the comparison', () => {
    renderAndEvaluate()
    expect(resultTitle()).toBe('Plan needs adjustment')
    expect(screen.queryByRole('region', { name: 'Compare ways to adjust this plan' })).toBeNull()

    openAlternatives()
    expect(button('Hide alternatives').getAttribute('aria-expanded')).toBe('true')

    fireEvent.click(button('Close alternatives'))
    expect(screen.queryByRole('region', { name: 'Compare ways to adjust this plan' })).toBeNull()
    expect(button('Explore alternatives').getAttribute('aria-expanded')).toBe('false')

    openAlternatives()
    fireEvent.click(button('Hide alternatives'))
    expect(screen.queryByRole('region', { name: 'Compare ways to adjust this plan' })).toBeNull()
  })

  it('shows the current plan and both alternatives with distinct amounts', () => {
    renderAndEvaluate()
    openAlternatives()

    const current = card('Your current plan').textContent!.replace(NBSP, ' ')
    expect(current).toContain('Your monthly contributionPLN 800.00')
    expect(current).toContain('Required monthly contributionPLN 1,450.00')
    expect(current).toContain('Monthly shortfallPLN 650.00')
    expect(current).toContain('21 Feb 2027')

    const increase = card('Increase monthly contribution').textContent!.replace(NBSP, ' ')
    expect(increase).toContain('Your monthly contributionPLN 1,450.00Changed')
    expect(increase).toContain('Target date21 Feb 2027')
    expect(increase).toContain('Monthly surplusPLN 0.00')
    expect(increase).toContain('Final contribution (estimated)PLN 1,450.00')
    expect(increase).toContain('PLN 650.00 more per month')

    const extend = card('Extend target date').textContent!.replace(NBSP, ' ')
    expect(extend).toContain('Your monthly contributionPLN 800.00')
    expect(extend).toContain('Target date21 Jun 2027Changed')
    expect(extend).toContain('Required monthly contributionPLN 725.00')
    expect(extend).toContain('Monthly surplusPLN 75.00')
    // 7 x 800.00 = 5,600.00, so the 8th contribution is 200.00.
    expect(extend).toContain('Final contribution (estimated)PLN 200.00')
    expect(extend).toContain('7 × PLN 800.00, then a final PLN 200.00 in month 8')
    expect(extend).toContain('4 months later')
  })

  it('presents the alternatives neutrally and lists the assumptions', () => {
    renderAndEvaluate()
    const panel = openAlternatives()
    expect(panel.textContent!.replace(NBSP, ' ')).toContain('neither is recommended over the other')
    expect(panel.textContent!.replace(NBSP, ' ')).toContain('Calculated from 21 Oct 2026 using whole calendar months')
    expect(panel.textContent!.replace(NBSP, ' ')).toContain('Nothing is saved, committed or paid')
    expect(panel.textContent!.replace(NBSP, ' ')).not.toMatch(/\b(best|better|recommended option)\b/i)
  })

  it('does not offer alternatives for a supported plan', () => {
    renderAndEvaluate({ monthly: '1450' })
    expect(resultTitle()).toBe('Plan is supported')
    expect(screen.queryByRole('button', { name: 'Explore alternatives' })).toBeNull()
  })

  it('explains neutrally when the timeline is beyond the planning horizon', () => {
    // 5,800.00 at 1.00 a month would need 5,800 months.
    renderAndEvaluate({ monthly: '1' })
    openAlternatives()
    const extend = card('Extend target date').textContent!.replace(NBSP, ' ')
    expect(extend).toContain('would need 5800 months')
    expect(extend).toContain('up to 600 months (50 years)')
    expect(extend).toContain('not an assessment of your goal')
    expect(within(card('Extend target date')).queryByRole('button')).toBeNull()
    expect(within(card('Increase monthly contribution')).getByRole('button', { name: 'Use this alternative' })).toBeTruthy()
  })

  it('explains when no date can be calculated for a zero contribution', () => {
    renderAndEvaluate({ monthly: '0' })
    openAlternatives()
    expect(card('Extend target date').textContent!.replace(NBSP, ' ')).toContain('only be calculated for a monthly contribution above PLN 0.00')
  })
})

describe('Explore alternatives: confirming and cancelling', () => {
  it('asks for confirmation and changes nothing until confirmed', () => {
    renderAndEvaluate()
    openAlternatives()
    fireEvent.click(within(card('Increase monthly contribution')).getByRole('button', { name: 'Use this alternative' }))

    const confirm = screen.getByRole('group', { name: 'Confirm change' })
    expect(confirm.textContent!.replace(NBSP, ' ')).toContain('from PLN 800.00 to PLN 1,450.00')
    expect(monthlyInput().value).toBe('800')
    expect(resultTitle()).toBe('Plan needs adjustment')
  })

  it('cancels a proposed change and keeps the original plan', () => {
    renderAndEvaluate()
    openAlternatives()
    fireEvent.click(within(card('Extend target date')).getByRole('button', { name: 'Use this alternative' }))
    fireEvent.click(within(screen.getByRole('group', { name: 'Confirm change' })).getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('group', { name: 'Confirm change' })).toBeNull()
    expect(dateInput().value).toBe('2027-02-21')
    expect(monthlyInput().value).toBe('800')
    expect(resultTitle()).toBe('Plan needs adjustment')
    expect(screen.queryByRole('region', { name: 'Applied alternative' })).toBeNull()
  })

  it('applies the increased contribution after confirmation', () => {
    renderAndEvaluate()
    openAlternatives()
    fireEvent.click(within(card('Increase monthly contribution')).getByRole('button', { name: 'Use this alternative' }))
    fireEvent.click(button('Confirm change'))

    expect(monthlyInput().value).toBe('1450.00')
    expect(dateInput().value).toBe('2027-02-21')
    expect(resultTitle()).toBe('Plan is supported')
    expect(screen.queryByRole('region', { name: 'Compare ways to adjust this plan' })).toBeNull()
    expect(screen.getByRole('region', { name: 'Applied alternative' }).textContent!.replace(NBSP, ' '))
      .toContain('Monthly contribution changed from PLN 800.00 to PLN 1,450.00.')
  })

  it('applies the extended date after confirmation', () => {
    renderAndEvaluate()
    openAlternatives()
    fireEvent.click(within(card('Extend target date')).getByRole('button', { name: 'Use this alternative' }))
    fireEvent.click(button('Confirm change'))

    expect(dateInput().value).toBe('2027-06-21')
    expect(monthlyInput().value).toBe('800')
    expect(resultTitle()).toBe('Plan is supported')
    expect(screen.getByText('PLN 75.00')).toBeTruthy()
  })
})

describe('Explore alternatives: outdated evaluations', () => {
  it('blocks using an alternative after the inputs are edited', () => {
    renderAndEvaluate()
    openAlternatives()
    fireEvent.change(monthlyInput(), { target: { value: '900' } })

    expect(screen.getByText(/Your inputs changed after this analysis/)).toBeTruthy()
    for (const use of screen.getAllByRole('button', { name: 'Use this alternative' })) {
      expect((use as HTMLButtonElement).disabled).toBe(true)
    }
  })

  it('blocks a pending confirmation from overwriting edited inputs', () => {
    renderAndEvaluate()
    openAlternatives()
    fireEvent.click(within(card('Extend target date')).getByRole('button', { name: 'Use this alternative' }))
    fireEvent.change(input('Target amount (PLN)'), { target: { value: '31000' } })

    const confirm = button('Confirm change')
    expect(confirm.disabled).toBe(true)
    fireEvent.click(confirm)
    expect(input('Target amount (PLN)').value).toBe('31000')
    expect(dateInput().value).toBe('2027-02-21')
  })

  it('compares fresh alternatives after evaluating the edited inputs', () => {
    renderAndEvaluate()
    openAlternatives()
    fireEvent.change(monthlyInput(), { target: { value: '1000' } })
    fireEvent.click(button('Evaluate goal'))

    openAlternatives()
    expect(card('Your current plan').textContent!.replace(NBSP, ' ')).toContain('Your monthly contributionPLN 1,000.00')
    expect((within(card('Extend target date')).getByRole('button', { name: 'Use this alternative' }) as HTMLButtonElement).disabled).toBe(false)
  })
})

describe('Explore alternatives: restoring the previous plan', () => {
  function applyIncrease() {
    renderAndEvaluate()
    openAlternatives()
    fireEvent.click(within(card('Increase monthly contribution')).getByRole('button', { name: 'Use this alternative' }))
    fireEvent.click(button('Confirm change'))
  }

  it('restores the exact previous inputs and result after confirmation', () => {
    applyIncrease()
    fireEvent.click(button('Restore previous plan'))
    expect(monthlyInput().value).toBe('1450.00')

    fireEvent.click(button('Confirm restore'))
    expect(monthlyInput().value).toBe('800')
    expect(dateInput().value).toBe('2027-02-21')
    expect(input('Target amount (PLN)').value).toBe('30000')
    expect(input('Already saved (PLN)').value).toBe('24200')
    expect(resultTitle()).toBe('Plan needs adjustment')
    expect(screen.getByText('Previous plan restored.')).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Applied alternative' })).toBeNull()
  })

  it('keeps the applied change when restoring is cancelled', () => {
    applyIncrease()
    fireEvent.click(button('Restore previous plan'))
    fireEvent.click(within(screen.getByRole('group', { name: 'Confirm restore' })).getByRole('button', { name: 'Cancel' }))
    expect(monthlyInput().value).toBe('1450.00')
    expect(resultTitle()).toBe('Plan is supported')
    expect(button('Restore previous plan').disabled).toBe(false)
  })

  it('does not restore over inputs edited after the change', () => {
    applyIncrease()
    fireEvent.change(input('Target amount (PLN)'), { target: { value: '32000' } })

    expect(button('Restore previous plan').disabled).toBe(true)
    expect(screen.getByText(/cannot be restored automatically/)).toBeTruthy()

    // Undoing the edit makes restoring safe again.
    fireEvent.change(input('Target amount (PLN)'), { target: { value: '30000' } })
    expect(button('Restore previous plan').disabled).toBe(false)
  })

  it('drops the restore option once different inputs are evaluated', () => {
    applyIncrease()
    fireEvent.change(monthlyInput(), { target: { value: '1500' } })
    fireEvent.click(button('Evaluate goal'))
    expect(screen.queryByRole('region', { name: 'Applied alternative' })).toBeNull()
  })
})

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MyMoney } from './MyMoney'

// Synthetic loan: 12,000 at 12% a year (1% a month), paying 1,000 a month.
afterEach(cleanup)

const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement
const type = (label: string, value: string) => fireEvent.change(field(label), { target: { value } })
const metric = (name: string) => screen.getByText(name).nextElementSibling!.textContent

function openCalculator(loan: { balance: string; interest: string; payment: string }) {
  render(<MyMoney onBack={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: '+ Add' }))
  type('Remaining Balance (PLN)', loan.balance)
  type('Yearly Interest (%)', loan.interest)
  type('Monthly Payment (PLN)', loan.payment)
  // A new loan opens with its calculator already shown.
  expect(screen.getByRole('button', { name: 'Hide Calculator ↑' })).toBeTruthy()
}

describe('My Money inline calculator', () => {
  it('updates months and interest saved on the same screen as the extra payment changes', () => {
    openCalculator({ balance: '12000', interest: '12', payment: '1000' })
    expect(metric('Months Saved')).toBe('0')

    type('Extra Each Month (PLN)', '200')
    expect(metric('Without Extra')).toBe('13 months')
    expect(metric('With Extra')).toBe('11 months')
    expect(metric('Months Saved')).toBe('2')
    expect(metric('Interest Saved')).toBe('139.97 PLN')

    fireEvent.click(screen.getByRole('button', { name: 'No extra' }))
    expect(metric('Months Saved')).toBe('0')
  })

  it('says when paying off would take more than 600 months', () => {
    openCalculator({ balance: '601', interest: '0', payment: '1' })
    expect(screen.getByRole('status').textContent).toBe('With this monthly payment, paying this off would take more than 600 months (50 years).')
  })

  it('says when the regular payment does not cover the interest', () => {
    openCalculator({ balance: '12000', interest: '12', payment: '120' })
    expect(screen.getByRole('status').textContent).toBe('Your regular payment must cover the interest.')
  })

  it('asks for valid values when an amount cannot be read', () => {
    openCalculator({ balance: '12000', interest: '12', payment: '1000' })
    type('Extra Each Month (PLN)', 'abc')
    expect(screen.getByRole('status').textContent).toBe('Add a valid remaining balance, yearly interest rate, and monthly payment.')
  })

  it('rejects a one-time payment above the remaining balance', () => {
    openCalculator({ balance: '12000', interest: '12', payment: '1000' })
    type('One-Time Extra Payment (PLN)', '12000,01')
    expect(screen.getByRole('status').textContent).toBe('The one-time extra payment can\'t be more than the remaining balance.')
  })
})

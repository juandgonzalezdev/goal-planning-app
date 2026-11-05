import { createContext, useContext } from 'react'
import type { GuideChapter } from './guideContent'

/**
 * The "?" next to the figures that raise questions (Rumbo de diseño §8):
 * two or three sentences, an example from Alex's demo, and the chapter of
 * Help & Guide that says more. Simple English, as in the rest of the app.
 */
export const TIPS = {
  'money-income': {
    name: 'Income',
    text: ['Expected income is a plan, not money received. Record what arrived in each source.', 'Open a source to choose the year of its payments. Income does not use the Cards & Loans month.'],
    example: null,
    chapter: 'income',
  },
  'money-balances': {
    name: 'Balances',
    text: ['Enter balances from your bank or cash count, with their date. Previous balances stay in History.'],
    example: null,
    chapter: 'accounts',
  },
  'money-payments': {
    name: 'Balances and payments',
    text: ['Remaining Balance is the latest balance you entered, not a forecast. Payments use the month shared with Home and Bills.', 'Linked payments are counted once in Bills. Recording a payment does not update the Remaining Balance.'],
    example: null,
    chapter: 'cards',
  },
  'money-own-data': {
    name: 'Your data',
    text: ['Your data is saved on this device only. No bank is connected.'],
    example: null,
    chapter: 'storage',
  },
  'money-demo-data': {
    name: 'Your data',
    text: ['Alex’s data is invented. Demo changes are not saved and do not affect your own space.'],
    example: null,
    chapter: 'space',
  },
  result: {
    name: 'Result',
    text: ['Income received minus what you spent. It is not money saved: your balances show what you really have.'],
    example: 'In the demo, December: 7200,00 zł received − 5097,35 zł spent = 2102,65 zł.',
    chapter: 'home',
  },
  'planned-spent': {
    name: 'Planned Bills and Spent',
    text: ['Planned Bills is what this month’s bills add up to, paid or not. Spent is what you actually spent: bills paid, spending, and only the interest of loan payments.'],
    example: 'In the demo, December: Planned Bills 6401,84 zł for 10 bills.',
    chapter: 'home',
  },
  'expected-received': {
    name: 'Expected and Received',
    text: ['Expected is income you usually get that hasn’t arrived yet. Received is what you recorded with Record Received.'],
    example: 'A salary of 4500,00 zł is Expected until you record it as received.',
    chapter: 'income',
  },
  savings: {
    name: 'Savings',
    text: ['The total of your savings accounts, from the balances you entered. Goals are part of your Savings, not extra money.'],
    example: 'In the demo: Savings 2900,00 zł = Trip to Japan 1800,00 + New Bike 200,00 + Emergency Fund 900,00.',
    chapter: 'accounts',
  },
  'remaining-balance': {
    name: 'Remaining Balance',
    text: ['The last balance you entered, with its date. Paying a bill doesn’t change it by itself: enter the new balance from your statement.'],
    example: 'In the demo, Student Loan: 9622,63 zł on 31 Dec 2026.',
    chapter: 'cards',
  },
  'new-savings': {
    name: 'New savings and Savings I already have',
    text: ['New savings is money you saved now: it adds to your Savings once. Savings I already have gives a purpose to money already in your Savings, which stay the same.'],
    example: 'Moving 100,00 zł you already had into a goal doesn’t make you 100,00 zł richer.',
    chapter: 'goals',
  },
  backup: {
    name: 'Download Backup and Download Both Copies',
    text: ['Download Backup saves your space in a file you can restore. Download Both Copies is a rescue file with every copy on this device, even damaged ones: keep it, but it can’t be restored.'],
    example: null,
    chapter: 'reports',
  },
  'hide-amounts': {
    name: 'Hiding amounts',
    text: ['Hiding amounts only changes what you see. It is not a lock: anyone with this device can show them again.'],
    example: null,
    chapter: 'hiding',
  },
} as const satisfies Record<string, { name: string; text: readonly string[]; example: string | null; chapter: GuideChapter }>
export type TipTopic = keyof typeof TIPS

/** Opens Help & Guide, on a chapter when given. Outside an open space, nothing (there is no guide there). */
export const GuideContext = createContext<((chapter?: GuideChapter) => void) | null>(null)
export const useOpenGuide = () => useContext(GuideContext)

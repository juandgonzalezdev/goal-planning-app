import type { GuideStep, StepState } from '../home/gettingStarted'

/**
 * What each Getting Started stage says (GS-3), in the v1.0 order. Plain
 * English, outside the translation catalog like the rest of these screens
 * until phases B2–B5. `short` is the name in the stage list; `title` is the
 * stage screen's heading.
 */
export const STAGE_TEXT: Record<GuideStep, { short: string; title: string; question: string; text: string }> = {
  accounts: {
    short: 'Accounts', title: 'Accounts & Savings', question: 'Where is your money now?',
    text: 'Add the account you spend from, any cash and your savings. Enter today’s balance from your bank app. If you don’t know it, leave it empty. It will show as “Not entered”, not as 0.',
  },
  income: {
    short: 'Income', title: 'Income', question: 'What money comes in?',
    text: 'Add what you usually receive each month, such as a salary. Later, you’ll record what actually arrives.',
  },
  debts: {
    short: 'Debts', title: 'Debts', question: 'Do you owe anything?',
    text: 'Add each card or loan with its Remaining Balance. If you add its monthly Payment, it is added to your bills too. You won’t need to add it again.',
  },
  bills: {
    short: 'Bills', title: 'Bills & Subscriptions', question: 'What do you pay regularly?',
    text: 'Add rent, phone, insurance and subscriptions. If you don’t know this month’s amount, leave it as unknown.',
  },
  goals: {
    short: 'Goals', title: 'Goals', question: 'Want to give part of your savings a purpose?',
    text: 'A goal doesn’t add money. It sets aside part of the savings you already have, or new money you save later. A target amount and a date are optional. This stage is optional.',
  },
  finish: {
    short: 'Finish', title: 'Finish', question: 'Here is where your setup stands.',
    text: 'When you spend, pay a bill or receive income, record it with + Add at the top of Home. Once a month, update your balances.',
  },
}

/** The state of a stage in words: what the stage list says and the screen reader hears. "None" is complete. */
export const STATE_WORDS: Record<StepState, string> = {
  done: 'Completed', none: 'Completed', skipped: 'Skipped', 'to-do': 'Not started',
}

/** The "I don't have any" answer, only for Income and Debts (D-GS3). Debts keeps its existing label until GS-4. */
export const NONE_TEXT = { income: 'I don’t have regular income', debts: 'I Have None' } as const

/**
 * Help & Guide (Rumbo de diseño §8): the in-app guide, a short version of
 * docs/USER_GUIDE.md, in its order and with its titles. It explains what
 * the app really does: no bank, no sync, no real accounts. When a chapter
 * of USER_GUIDE.md changes, its text here is checked too.
 */
export const GUIDE_CHAPTERS = [
  'what', 'space', 'getting-started', 'home', 'income', 'accounts', 'bills', 'cards', 'spending', 'goals', 'history',
  'charts', 'hiding', 'reports', 'storage', 'check-in', 'glossary',
] as const
export type GuideChapter = (typeof GUIDE_CHAPTERS)[number]

export interface GuideText {
  title: string
  /** Short paragraphs. A line that starts with "• " is shown as a list item. */
  body: string[]
}

export const GUIDE: Record<GuideChapter, GuideText> = {
  what: {
    title: 'What This App Does',
    body: [
      'It helps you organise your income, bills, spending, cards and loans, savings and goals, by hand.',
      'What it doesn’t do: it doesn’t connect to your bank, it doesn’t sync between devices, and there are no real accounts yet. Nothing is paid or moved for you.',
    ],
  },
  space: {
    title: 'Your Space and the Demo',
    body: [
      'Your space is Individual (just you) or Duo (two people on this device). In a Duo space, both people see everything: there is no privacy between members.',
      'The demo shows Alex, an invented person, on the demo’s own date (31 December 2026). Nothing you change in the demo is saved.',
    ],
  },
  'getting-started': {
    title: 'Getting Started',
    body: [
      'After you create your space, Getting Started on Home suggests an order: Income, then Accounts, Cash and Savings, then Cards and Loans, then Bills, then Goals (optional), then day to day.',
      'Cards and loans come before bills: a card or loan with its monthly Payment adds that payment to your bills, so you never enter it twice.',
      'Every step can be skipped with Skip for now. Hide this guide closes it. You can bring it back here, with Show Getting Started on Home. Nothing is filled in for you.',
    ],
  },
  home: {
    title: 'Reading Home',
    body: [
      'Home has three areas: This Month, Left to Pay, and Money & Goals. Customize Home changes their order.',
      '• Expected is income you usually get that hasn’t arrived yet. Received is what you recorded as arrived.',
      '• Planned Bills is what this month’s bills add up to, paid or not. Spent is what you actually spent.',
      '• Result is income received minus what you spent. It is not money saved: your account balances show what you really have.',
    ],
  },
  income: {
    title: 'Income',
    body: [
      'Add each source you usually receive (Money › Income). When the money arrives, use Record Received. One-off income can be added too.',
      'Until you record it, a source’s usual amount shows as Expected.',
    ],
  },
  accounts: {
    title: 'Accounts, Cash and Savings',
    body: [
      'A balance is a photo with a date: what an account had on that day. A new balance keeps the old one in History.',
      'A balance you don’t know is “Not entered”, never 0. Money you don’t spend doesn’t become savings by itself: update your balances from your bank.',
      'You can delete an account with only balances after confirming that its balance history will also be removed. Linked payments, income, spending, transfers or goal movements keep the account from being deleted.',
    ],
  },
  bills: {
    title: 'Bills and Subscriptions',
    body: [
      'A bill has a usual amount, and a month can have its own amount. Mark as Paid records the amount, the date and the account it was paid from.',
      'A bill can be paused, ended, or yearly. Left to Pay on Home shows what is still to pay this month.',
    ],
  },
  cards: {
    title: 'Cards and Loans',
    body: [
      'Remaining Balance is the last balance you entered from your statement, with its date. Paying a bill doesn’t change it by itself.',
      'The monthly Payment is a bill, counted once. The Estimate is a calculation with the same interest every month: your bank may calculate differently.',
    ],
  },
  spending: {
    title: 'Spending and Transfers',
    body: [
      'Spending is money that left you: shopping, food, a bill. A transfer moves money between your own accounts, so it isn’t spending.',
      'Paying a card isn’t new spending: what you bought with it already was. Of a loan payment, only the interest you enter counts as spending; the rest pays the loan back.',
    ],
  },
  goals: {
    title: 'My Goals',
    body: [
      'Goals are part of your Savings, not extra money. A Contribution gives a purpose to money: New savings adds to your Savings once; Savings I already have only gives a purpose to money you already had.',
      'A Withdrawal takes money out of a goal. A goal can be Flexible or have a date; a date needs a target amount. Explore tries an amount or a date without saving anything. The Emergency Fund is for the unexpected.',
    ],
  },
  history: {
    title: 'History',
    body: [
      'Everything you recorded, by month and day. Search, More Filters and Year Overview help you find things. Year Overview always shows the whole year, whatever the filters.',
    ],
  },
  charts: {
    title: 'Reading the Charts',
    body: [
      'Solid is what you recorded. An outline is income still expected. A dashed line is an estimate, and its label says so. “Not entered” marks a stretch with nothing recorded: the app never fills it in.',
      'With fewer than two records there is no line, only the figure. Show as Table gives the same figures as a table.',
    ],
  },
  hiding: {
    title: 'Hiding Amounts and Customizing Home',
    body: [
      'The eye hides the amounts of an area, and Hide All Amounts hides them all. It only changes what you see: anyone with this device can show them again.',
      'Customize Home changes the order of the three areas. Nothing else changes.',
    ],
  },
  reports: {
    title: 'Reports and Backups',
    body: [
      'Settings › Reports & Backup. Export Report makes a PDF of a month or a year, to read or share; it can leave the amounts out.',
      'Download Backup saves your space in a file you can restore. Download Both Copies is a rescue file with every copy on this device, even damaged ones: it can’t be restored, only kept.',
    ],
  },
  storage: {
    title: 'Where Your Information Is Kept',
    body: [
      'Everything you enter is saved in this browser, on this device only. It is not encrypted and not sent anywhere. Another browser, another device or a private window won’t see it.',
      'If you clear this site’s data, it’s gone. Download a Backup regularly and keep it somewhere safe. Hiding amounts only changes what’s on screen.',
    ],
  },
  'check-in': {
    title: 'Your Monthly Check-in',
    body: [
      '• When income arrives: Record Received.',
      '• As you pay: mark bills as Paid. Add spending, for example once a week.',
      '• Once a month: update account balances and the Remaining Balance of each card or loan from your statements.',
      '• If you set money aside: add a Contribution to a goal.',
      '• At the end of the month: check the Result and “How is this worked out?”, then Download Backup.',
      'It is a guide, not a reminder: the app doesn’t send notifications.',
    ],
  },
  glossary: {
    title: 'Glossary',
    body: [
      '• Expected: usual income not recorded as received yet.',
      '• Received: income you recorded as arrived.',
      '• Planned Bills: this month’s bills, paid or not.',
      '• Spent: what you actually spent this month.',
      '• Result: income received minus spent. Not money saved.',
      '• Remaining Balance: what you still owe, from your last statement.',
      '• Contribution / Withdrawal: money given to or taken from a goal.',
      '• Estimate: a calculation, not a record.',
    ],
  },
}

import { monthsOfYear, yearMonthOf, type YearMonth } from '../domain/calendar'
import type { CalendarDate } from '../domain/goalTime'
import type { MoneyAmount } from '../domain/goalAmounts'
import { sumMinor } from '../domain/money'
import { summarizeDebts } from '../domain/finance/debts'
import { emergencyCover } from '../domain/finance/emergency'
import { monthFunding } from '../domain/finance/flows'
import { goalProgress } from '../domain/finance/goals'
import { summarizeMoney } from '../domain/finance/moneyAccounts'
import { savingsSummary } from '../domain/finance/savings'
import { monthEnd, monthResult, monthSpending, type CategorySpending } from '../domain/finance/spending'
import type { FinanceData } from '../domain/finance/types'
import { yearSummary } from '../domain/finance/year'
import { PAGE_HEIGHT, PAGE_WIDTH, PdfDocument, textWidth, wrapText, type Rgb } from './pdf'

/**
 * The PDF report of a month or a year: a printable summary of what was
 * recorded, worked out with the same functions as the screens. It is a
 * report, not a backup (the JSON backup in Data is the copy that can be
 * restored), and never a bank statement.
 */

export type ReportPeriod = { kind: 'month'; month: YearMonth } | { kind: 'year'; year: number }

export interface ReportOptions {
  period: ReportPeriod
  /** The open space's "today": the demo's fixed date in the demo. */
  today: CalendarDate
  /** The device date the file is made on. */
  generatedOn: CalendarDate
  includeAmounts: boolean
  isDemo: boolean
}

const MARGIN = 48
const WIDTH = PAGE_WIDTH - 2 * MARGIN
const BOTTOM = PAGE_HEIGHT - 56
const INK: Rgb = [30, 34, 40]
const MUTED: Rgb = [96, 104, 116]
const RULE: Rgb = [214, 219, 226]
const ACCENT: Rgb = [59, 130, 246]
const POSITIVE: Rgb = [77, 150, 112]
const NEGATIVE: Rgb = [196, 92, 84]
const TRACK: Rgb = [232, 236, 241]
const NOTICE: Rgb = [255, 243, 214]
const HIDDEN = '••••'
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const SHORT = MONTHS.map(name => name.slice(0, 3))

const monthLabel = (month: YearMonth) => `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`
const dateLabel = (date: CalendarDate) => `${Number(date.slice(8, 10))} ${SHORT[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`

/** "PLN 1,234.56" (the code instead of "zł", which the standard PDF fonts cannot show). */
export function pdfMoney(minor: MoneyAmount, currency: string): string {
  const sign = minor < 0 ? '-' : ''
  const value = Math.abs(minor)
  const whole = Math.floor(value / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${currency} ${sign}${whole}.${String(value % 100).padStart(2, '0')}`
}

/** The page cursor: moves down, and starts a new page when the next block would not fit. */
class Layout {
  y = MARGIN
  readonly pdf: PdfDocument
  constructor(pdf: PdfDocument) { this.pdf = pdf }

  /** Starts a new page unless `height` still fits. Keeps a heading with what follows it. */
  need(height: number) {
    if (this.y + height > BOTTOM) { this.pdf.addPage(); this.y = MARGIN }
  }

  heading(text: string, keepWith = 60) {
    this.need(28 + keepWith)
    this.y += 10
    this.pdf.text(MARGIN, this.y + 12, text, { size: 13, bold: true, color: INK })
    this.y += 20
    this.pdf.line(MARGIN, this.y, MARGIN + WIDTH, this.y, RULE, 0.8)
    this.y += 8
  }

  paragraph(text: string, { size = 9.5, color = MUTED, bold = false, indent = 0 }: { size?: number; color?: Rgb; bold?: boolean; indent?: number } = {}) {
    for (const line of wrapText(text, WIDTH - indent, size, bold)) {
      this.need(size + 4)
      this.pdf.text(MARGIN + indent, this.y + size, line, { size, color, bold })
      this.y += size + 4
    }
  }

  /** A table with a header row. Columns after the first are right-aligned. */
  table(columns: { title: string; width: number }[], rows: string[][], { boldLast = false }: { boldLast?: boolean } = {}) {
    const rowHeight = 15
    const header = () => {
      let x = MARGIN
      columns.forEach((column, index) => {
        const right = index > 0
        this.pdf.text(right ? x + column.width - 4 : x, this.y + 10, column.title, { size: 8.5, bold: true, color: MUTED, align: right ? 'right' : 'left' })
        x += column.width
      })
      this.y += rowHeight
      this.pdf.line(MARGIN, this.y - 3, MARGIN + WIDTH, this.y - 3, RULE)
    }
    this.need(rowHeight * Math.min(rows.length + 1, 4))
    header()
    rows.forEach((row, rowIndex) => {
      if (this.y + rowHeight > BOTTOM) { this.pdf.addPage(); this.y = MARGIN; header() }
      const bold = boldLast && rowIndex === rows.length - 1
      let x = MARGIN
      row.forEach((cell, index) => {
        const right = index > 0
        const width = columns[index].width
        const fitted = fit(cell, width - 8, 9, bold)
        this.pdf.text(right ? x + width - 4 : x, this.y + 10, fitted, { size: 9, bold, color: INK, align: right ? 'right' : 'left' })
        x += width
      })
      this.y += rowHeight
    })
    this.y += 4
  }

  gap(points = 8) { this.y += points }
}

function fit(text: string, width: number, size: number, bold: boolean): string {
  if (textWidth(text, size, bold) <= width) return text
  let cut = text
  while (cut.length > 1 && textWidth(`${cut}…`, size, bold) > width) cut = cut.slice(0, -1)
  return `${cut}…`
}

export function buildReport(data: FinanceData, options: ReportOptions): PdfDocument {
  const { period, today, includeAmounts, isDemo } = options
  const currency = data.space.currency
  const money = (minor: MoneyAmount) => (includeAmounts ? pdfMoney(minor, currency) : HIDDEN)
  const thisMonth = yearMonthOf(today)
  const year = period.kind === 'year' ? period.year : Number(period.month.slice(0, 4))
  const months = period.kind === 'year' ? monthsOfYear(period.year).filter(m => m <= thisMonth) : [period.month].filter(m => m <= thisMonth)
  const lastMonth = months[months.length - 1] ?? (period.kind === 'year' ? `${period.year}-01` : period.month)
  const asOf = monthEnd(lastMonth) < today ? monthEnd(lastMonth) : today
  const title = period.kind === 'month' ? monthLabel(period.month) : `Year ${period.year}`

  const pdf = new PdfDocument(`Financial report · ${title}`)
  const out = new Layout(pdf)

  // Title and the facts about this file.
  pdf.text(MARGIN, out.y + 20, 'Financial Report', { size: 20, bold: true, color: INK })
  pdf.text(MARGIN + WIDTH, out.y + 20, title, { size: 14, bold: true, color: ACCENT, align: 'right' })
  out.y += 32
  out.paragraph(`${data.space.name} · Currency: ${currency} · Records up to ${dateLabel(asOf)}${isDemo ? ' (demo date)' : ''} · Generated on ${dateLabel(options.generatedOn)}`)
  out.paragraph(includeAmounts ? 'Amounts: included.' : `Amounts: not included. Every amount is shown as ${HIDDEN}; the rest of the report is the same.`, { color: INK, bold: true })
  out.gap(4)

  const notices = [
    ...(isDemo ? ['INVENTED DATA. Alex is a fictional person and every figure in this report is invented, for the demo only.'] : []),
    'This is a personal summary made from what was entered in the app. It is not a bank statement or a certificate, and nothing in it was checked by a bank or any other institution.',
  ]
  const noticeLines = notices.flatMap(text => wrapText(text, WIDTH - 20, 9.5, true))
  const noticeHeight = noticeLines.length * 13 + 14
  pdf.rect(MARGIN, out.y, WIDTH, noticeHeight, NOTICE)
  noticeLines.forEach((line, index) => pdf.text(MARGIN + 10, out.y + 18 + index * 13, line, { size: 9.5, bold: true, color: INK }))
  out.y += noticeHeight + 6

  // Summary.
  const results = months.map(month => monthResult(data, month, today))
  const income = sumMinor(results.map(r => r.income.total))
  const extraordinary = sumMinor(results.map(r => r.income.extraordinary))
  const spent = sumMinor(results.map(r => r.spending.total))
  const planned = sumMinor(results.map(r => r.planned.knownTotal))
  const moneyIn = sumMinor(results.map(r => r.cashFlow.moneyIn))
  const moneyOut = sumMinor(results.map(r => r.cashFlow.moneyOut))
  out.heading('Summary')
  if (months.length === 0) out.paragraph('This period has not started yet: nothing has been recorded for it.')
  out.table([{ title: '', width: WIDTH * 0.6 }, { title: title, width: WIDTH * 0.4 }], [
    ['Income received', money(income)],
    ...(extraordinary > 0 ? [['  of which one-off income', money(extraordinary)]] : []),
    ['Planned bills (paid or not)', money(planned)],
    ['Spent (paid bills, purchases and loan interest)', money(spent)],
    ['Result (income received - spent)', money(income - spent)],
    ['Money in to your accounts', money(moneyIn)],
    ['Money out of your accounts', money(moneyOut)],
  ])
  out.paragraph('The result is not cash: a purchase on a card counts as spending when it is made, while money only leaves your account when the card is paid. Card payments and the principal of a loan pay debt back, so they are not spending. Transfers between your own accounts are neither income nor spending.')

  if (period.kind === 'year') {
    const summary = yearSummary(data, year, today)
    out.heading('Month by Month', 120)
    out.table([
      { title: 'Month', width: WIDTH * 0.2 }, { title: 'Income', width: WIDTH * 0.16 }, { title: 'Spent', width: WIDTH * 0.16 },
      { title: 'Result', width: WIDTH * 0.16 }, { title: 'Savings at end', width: WIDTH * 0.16 }, { title: 'Debt at end', width: WIDTH * 0.16 },
    ], [
      ...summary.months.filter(row => row.started).map(row => [monthLabel(row.month), money(row.income), money(row.spending), money(row.result),
        row.savingsAtEnd === null ? 'Not known' : money(row.savingsAtEnd), money(row.debtAtEnd)]),
      ['Year', money(summary.income), money(summary.spending), money(summary.result), '', ''],
    ], { boldLast: true })
    if (includeAmounts) resultChart(out, summary.months.filter(row => row.started).map(row => ({ label: SHORT[Number(row.month.slice(5, 7)) - 1], value: row.result })))
    const deficits = summary.deficitMonths.map(month => ({ month, funding: monthFunding(data, month, today) }))
    if (deficits.length > 0) {
      out.heading('How Deficits Were Covered', 50)
      for (const { month, funding } of deficits) {
        const parts = [
          funding.savingsChange < 0 ? `${money(-funding.savingsChange)} from Savings` : null,
          funding.everydayChange < 0 ? `${money(-funding.everydayChange)} from everyday money` : null,
          funding.investmentChange < 0 ? `${money(-funding.investmentChange)} from investments` : null,
          funding.debtChange > 0 ? `${money(funding.debtChange)} of new debt` : null,
        ].filter(Boolean)
        out.paragraph(`${monthLabel(month)}: deficit of ${money(-funding.result)}, covered by ${parts.join(', ') || 'records that do not explain it'}.${funding.notExplained !== 0 ? ` ${money(Math.abs(funding.notExplained))} is not explained by the records.` : ''}`, { color: INK })
      }
    }
  }

  // Spending by category.
  const categories = new Map<string, CategorySpending['items']>()
  for (const month of months) for (const group of monthSpending(data, month).byCategory) categories.set(group.category, [...(categories.get(group.category) ?? []), ...group.items])
  const groups = [...categories.entries()].map(([category, items]) => ({ category, total: sumMinor(items.map(item => item.amount)), count: items.length }))
    .sort((a, b) => b.total - a.total)
  out.heading('Spending by Category', 80)
  if (groups.length === 0) out.paragraph('No spending is recorded for this period.')
  else {
    out.table([{ title: 'Category', width: WIDTH * 0.42 }, { title: 'Records', width: WIDTH * 0.14 }, { title: 'Amount', width: WIDTH * 0.24 }, { title: 'Share', width: WIDTH * 0.2 }],
      [...groups.map(g => [g.category, String(g.count), money(g.total), includeAmounts && spent > 0 ? `${((g.total * 100) / spent).toFixed(1)}%` : HIDDEN]),
        ['Total', String(groups.reduce((n, g) => n + g.count, 0)), money(spent), includeAmounts && spent > 0 ? '100%' : HIDDEN]], { boldLast: true })
    if (includeAmounts) categoryBars(out, groups.slice(0, 8))
  }

  // Pending payments.
  const pending = results.flatMap(r => r.pending)
  out.heading('Pending Payments', 40)
  if (pending.length === 0) out.paragraph('Every bill of this period is marked as paid.')
  else out.table([{ title: 'Bill', width: WIDTH * 0.4 }, { title: 'Due', width: WIDTH * 0.2 }, { title: 'State', width: WIDTH * 0.18 }, { title: 'Amount', width: WIDTH * 0.22 }],
    pending.map(p => [p.occurrence.bill.name, dateLabel(p.occurrence.dueDate), p.state === 'overdue' ? 'Overdue' : 'Due', p.occurrence.amount === null ? 'Not known' : money(p.occurrence.amount)]))

  // Debts, accounts, savings and goals, by the end of the period.
  const debts = summarizeDebts(data, asOf)
  out.heading('Debts', 40)
  if (debts.items.length === 0) out.paragraph('No cards or loans.')
  else out.table([{ title: 'Card or loan', width: WIDTH * 0.5 }, { title: 'Balance date', width: WIDTH * 0.25 }, { title: 'Still owed', width: WIDTH * 0.25 }],
    [...debts.items.map(item => [item.debt.name, item.asOf ? dateLabel(item.asOf) : 'Not entered', item.balance === null ? 'Not known' : money(item.balance)]),
      ['Total', '', money(debts.total)]], { boldLast: true })

  const accounts = summarizeMoney(data, asOf)
  out.heading('Accounts', 40)
  if (accounts.items.length === 0) out.paragraph('No accounts.')
  else out.table([{ title: 'Account', width: WIDTH * 0.5 }, { title: 'Balance date', width: WIDTH * 0.25 }, { title: 'Balance', width: WIDTH * 0.25 }],
    accounts.items.map(item => [item.account.name, item.asOf ? dateLabel(item.asOf) : 'Not entered', item.balance === null ? 'Not known' : money(item.balance)]))

  const savings = savingsSummary(data, asOf)
  const pastGoals = { goals: data.goals.filter(goal => goal.createdOn <= asOf && goal.status === 'active'), goalMovements: data.goalMovements.filter(m => m.date <= asOf) }
  out.heading('Savings and Goals', 50)
  out.paragraph(`Savings: ${savings.total === null ? 'not known' : money(savings.total)}. Goals and the emergency fund are parts of it, not extra money. Unassigned: ${savings.unassigned === null ? 'not known' : money(savings.unassigned)}.`, { color: INK })
  if (pastGoals.goals.length > 0) {
    out.table([{ title: 'Goal', width: WIDTH * 0.4 }, { title: 'Saved', width: WIDTH * 0.2 }, { title: 'Target', width: WIDTH * 0.2 }, { title: 'Date', width: WIDTH * 0.2 }],
      pastGoals.goals.map(goal => {
        const progress = goalProgress(goal, pastGoals.goalMovements, asOf)
        return [goal.name, money(progress.saved), goal.target === null ? 'No target' : money(goal.target), goal.deadline ? dateLabel(goal.deadline) : '-']
      }))
  }
  const cover = emergencyCover({ ...data, ...pastGoals }, asOf)
  if (cover.fund && cover.months !== null) out.paragraph(`The emergency fund covers about ${cover.months} months of the essential costs confirmed on ${dateLabel(cover.fund.emergencyBasis!.reviewedOn)}. Only what the fund holds is counted.`)

  // What is missing and what was assumed.
  const missing = [
    ...results.filter(r => r.planned.unknownCount > 0).map(r => `${monthLabel(r.month)}: ${r.planned.unknownCount} bill ${r.planned.unknownCount === 1 ? 'amount is' : 'amounts are'} not known.`),
    ...results.filter(r => r.spending.unsplitLoanPayments.length > 0).map(r => `${monthLabel(r.month)}: a loan payment has no interest split, so its interest is not in spending.`),
    ...(accounts.missingBalanceCount > 0 ? [`${accounts.missingBalanceCount} ${accounts.missingBalanceCount === 1 ? 'account has' : 'accounts have'} no balance by ${dateLabel(asOf)}.`] : []),
    ...(debts.missingBalanceCount > 0 ? [`${debts.missingBalanceCount} ${debts.missingBalanceCount === 1 ? 'debt has' : 'debts have'} no balance entered.`] : []),
    ...months.map(month => monthFunding(data, month, today)).filter(f => f.notExplained !== 0)
      .map(f => `${monthLabel(f.month)}: ${money(Math.abs(f.notExplained))} of the result is not explained by the recorded movements.`),
  ]
  out.heading('Missing Data and Assumptions', 60)
  out.paragraph(missing.length === 0 ? 'Nothing important is missing for this period.' : missing.join('\n'), { color: INK })
  out.gap(4)
  out.paragraph([
    'How it is worked out: income counts when received. Spending is paid bills (in the bill\'s month), purchases (on the day, also on a card) and the interest part of loan payments, as the lender showed it.',
    'Balances are the ones entered by the end of each month; they are never worked back from today\'s balance. An amount that is not known is left out and listed above, never counted as zero.',
  ].join('\n'))

  pdf.eachPage((page, count) => {
    pdf.line(MARGIN, PAGE_HEIGHT - 40, MARGIN + WIDTH, PAGE_HEIGHT - 40, RULE)
    pdf.text(MARGIN, PAGE_HEIGHT - 26, `${isDemo ? 'Invented demo data · ' : ''}Not a bank statement · ${title}`, { size: 8, color: MUTED })
    pdf.text(MARGIN + WIDTH, PAGE_HEIGHT - 26, `Page ${page} of ${count}`, { size: 8, color: MUTED, align: 'right' })
  })
  return pdf
}

/** Bars to the right for months with money left over, to the left for deficits. */
function resultChart(out: Layout, rows: { label: string; value: MoneyAmount }[]) {
  if (rows.length === 0) return
  const rowHeight = 12
  out.need(rows.length * rowHeight + 24)
  out.paragraph('Result by month (right: money left over; left: deficit)')
  const largest = Math.max(1, ...rows.map(row => Math.abs(row.value)))
  const centre = MARGIN + 40 + (WIDTH - 40) / 2
  const half = (WIDTH - 40) / 2 - 4
  rows.forEach(row => {
    out.pdf.text(MARGIN, out.y + 9, row.label, { size: 8.5, color: MUTED })
    out.pdf.rect(MARGIN + 40, out.y + 2, WIDTH - 40, 8, TRACK)
    const width = (Math.abs(row.value) / largest) * half
    out.pdf.rect(row.value < 0 ? centre - width : centre, out.y + 2, width, 8, row.value < 0 ? NEGATIVE : POSITIVE)
    out.y += rowHeight
  })
  out.pdf.line(centre, out.y - rows.length * rowHeight, centre, out.y, INK, 0.6)
  out.gap(6)
}

function categoryBars(out: Layout, groups: { category: string; total: MoneyAmount }[]) {
  const rowHeight = 12
  out.need(groups.length * rowHeight + 10)
  const largest = Math.max(1, ...groups.map(g => g.total))
  groups.forEach(group => {
    out.pdf.text(MARGIN, out.y + 9, group.category, { size: 8.5, color: MUTED })
    out.pdf.rect(MARGIN + 110, out.y + 2, WIDTH - 110, 8, TRACK)
    out.pdf.rect(MARGIN + 110, out.y + 2, ((WIDTH - 110) * group.total) / largest, 8, ACCENT)
    out.y += rowHeight
  })
  out.gap(6)
}

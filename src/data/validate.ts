import { isCalendarDate, isYearMonth } from '../domain/calendar'
import { isCurrencyCode, isMinorAmount } from '../domain/money'
import {
  BILL_CATEGORIES, MONEY_ACCOUNT_KINDS, MOVEMENT_EFFECTS,
  type FinanceData, type SpaceMode,
} from '../domain/finance/types'

/**
 * Checks that something read from a file (or storage) is complete,
 * consistent FinanceData before the app uses it. It reports every problem
 * it finds, in plain words, and never repairs or guesses anything.
 *
 * Current limit: every record must use the space's currency, because the
 * app cannot convert between currencies without a real exchange rate.
 */
export type ValidationResult = { status: 'valid'; data: FinanceData } | { status: 'invalid'; errors: string[] }

type Rec = Record<string, unknown>
const isRecord = (value: unknown): value is Rec => typeof value === 'object' && value !== null && !Array.isArray(value)
const isText = (value: unknown): value is string => typeof value === 'string'
const isNonEmptyText = (value: unknown): value is string => typeof value === 'string' && value.trim() !== ''
const isDay = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 31
const isOneOf = <T extends string>(list: readonly T[]) => (value: unknown): value is T =>
  typeof value === 'string' && (list as readonly string[]).includes(value)

const MEMBER_COUNT: Record<SpaceMode, (count: number) => boolean> = {
  individual: count => count === 1,
  duo: count => count === 2,
  group: count => count >= 3,
}

export function validateFinanceData(input: unknown): ValidationResult {
  const errors: string[] = []
  const fail = (message: string) => { errors.push(message) }
  if (!isRecord(input)) return { status: 'invalid', errors: ['The data is not an object.'] }

  if (input.schemaVersion !== 2) fail('schemaVersion must be 2.')

  // Space and members
  const space = input.space
  let currency: unknown
  const memberIds = new Set<string>()
  if (!isRecord(space)) fail('space is missing.')
  else {
    currency = space.currency
    if (!isNonEmptyText(space.id)) fail('space.id is missing.')
    if (!isNonEmptyText(space.name)) fail('space.name is missing.')
    if (!isCurrencyCode(space.currency)) fail('space.currency must be PLN, EUR or USD.')
    if (!Array.isArray(space.members)) fail('space.members must be a list.')
    else {
      space.members.forEach((member, index) => {
        if (!isRecord(member) || !isNonEmptyText(member.id) || !isNonEmptyText(member.name) || !isText(member.color)) {
          fail(`space.members[${index}] needs an id, a name and a colour.`)
          return
        }
        if (member.id === 'shared') fail('"shared" cannot be a member id.')
        if (memberIds.has(member.id)) fail(`Member id "${member.id}" is used twice.`)
        memberIds.add(member.id)
      })
      if (!isOneOf(['individual', 'duo', 'group'] as const)(space.mode)) fail('space.mode must be individual, duo or group.')
      else if (!MEMBER_COUNT[space.mode](space.members.length)) fail(`A ${space.mode} space cannot have ${space.members.length} member(s).`)
    }
  }

  const prefs = input.preferences
  if (!isRecord(prefs)
    || !isOneOf(['en', 'es', 'pl'] as const)(prefs.language)
    || !isOneOf(['system', 'light', 'dark', 'day-night'] as const)(prefs.theme)
    || !isCurrencyCode(prefs.displayCurrency)) {
    fail('preferences need a language (en, es, pl), a theme (system, light, dark, day-night) and a display currency.')
  }

  const isOwner = (value: unknown) => value === 'shared' || (isText(value) && memberIds.has(value))

  /** Checks one list: shape of each item, unique ids, currency. Returns the ids. */
  function checkList(name: string, check: (item: Rec, where: string) => void, idKey: string | null = 'id'): Set<string> {
    const ids = new Set<string>()
    const list = input && (input as Rec)[name]
    if (!Array.isArray(list)) { fail(`${name} must be a list.`); return ids }
    list.forEach((item, index) => {
      const where = `${name}[${index}]`
      if (!isRecord(item)) { fail(`${where} is not an object.`); return }
      if (idKey) {
        const id = item[idKey]
        if (!isNonEmptyText(id)) fail(`${where} has no id.`)
        else if (ids.has(id)) fail(`${name}: id "${id}" is used twice.`)
        else ids.add(id)
      }
      if ('currency' in item && item.currency !== currency) fail(`${where} must use the space currency.`)
      check(item, where)
    })
    return ids
  }

  const sourceIds = checkList('incomeSources', (item, where) => {
    if (!isText(item.memberId) || !memberIds.has(item.memberId)) fail(`${where}.memberId is not a member.`)
    if (!isNonEmptyText(item.name)) fail(`${where}.name is missing.`)
    if (!isMinorAmount(item.amount) || item.amount < 0) fail(`${where}.amount must be a whole, non-negative amount.`)
    if (!isDay(item.payDay)) fail(`${where}.payDay must be 1 to 31.`)
    if (!isYearMonth(item.startMonth)) fail(`${where}.startMonth must be YYYY-MM.`)
    if (item.endMonth !== null && !isYearMonth(item.endMonth)) fail(`${where}.endMonth must be YYYY-MM or null.`)
    if (!('currency' in item)) fail(`${where}.currency is missing.`)
  })

  checkList('income', (item, where) => {
    if (!isText(item.memberId) || !memberIds.has(item.memberId)) fail(`${where}.memberId is not a member.`)
    if (item.sourceId !== undefined && !(isText(item.sourceId) && sourceIds.has(item.sourceId))) fail(`${where}.sourceId is not an income source.`)
    if (!isYearMonth(item.month)) fail(`${where}.month must be YYYY-MM.`)
    if (!isCalendarDate(item.receivedOn)) fail(`${where}.receivedOn must be a real date.`)
    if (!isMinorAmount(item.amount) || item.amount < 0) fail(`${where}.amount must be a whole, non-negative amount.`)
    if (!('currency' in item)) fail(`${where}.currency is missing.`)
  })

  const debtIds = checkList('debts', (item, where) => {
    if (!isOneOf(['card', 'loan'] as const)(item.kind)) fail(`${where}.kind must be card or loan.`)
    if (!isNonEmptyText(item.name)) fail(`${where}.name is missing.`)
    if (!isOwner(item.owner)) fail(`${where}.owner is not a member or "shared".`)
    if (!isMinorAmount(item.yearlyInterestBasisPoints) || item.yearlyInterestBasisPoints < 0) fail(`${where}.yearlyInterestBasisPoints must be a whole, non-negative number.`)
    if (!isDay(item.dueDay)) fail(`${where}.dueDay must be 1 to 31.`)
    if (item.closingDay !== undefined && !isDay(item.closingDay)) fail(`${where}.closingDay must be 1 to 31.`)
    if (item.monthlyPayment !== undefined && (!isMinorAmount(item.monthlyPayment) || item.monthlyPayment < 0)) fail(`${where}.monthlyPayment must be a whole, non-negative amount.`)
    if (item.minimumPayment !== undefined && (!isMinorAmount(item.minimumPayment) || item.minimumPayment < 0)) fail(`${where}.minimumPayment must be a whole, non-negative amount.`)
    if (item.startMonth !== undefined && !isYearMonth(item.startMonth)) fail(`${where}.startMonth must be YYYY-MM.`)
    if (item.finalPaymentMonth !== undefined && !isYearMonth(item.finalPaymentMonth)) fail(`${where}.finalPaymentMonth must be YYYY-MM.`)
    else if (isYearMonth(item.startMonth) && isYearMonth(item.finalPaymentMonth) && item.finalPaymentMonth < item.startMonth) fail(`${where} ends before it starts.`)
    if (!('currency' in item)) fail(`${where}.currency is missing.`)
  })

  const billIds = checkList('bills', (item, where) => {
    if (!isNonEmptyText(item.name)) fail(`${where}.name is missing.`)
    if (!isOneOf(BILL_CATEGORIES)(item.category)) fail(`${where}.category is not a known category.`)
    if (!isOwner(item.owner)) fail(`${where}.owner is not a member or "shared".`)
    if (item.amount !== null && (!isMinorAmount(item.amount) || item.amount < 0)) fail(`${where}.amount must be a whole, non-negative amount or null.`)
    if (!isDay(item.dueDay)) fail(`${where}.dueDay must be 1 to 31.`)
    if (!isYearMonth(item.startMonth)) fail(`${where}.startMonth must be YYYY-MM.`)
    if (item.endMonth !== null && !isYearMonth(item.endMonth)) fail(`${where}.endMonth must be YYYY-MM or null.`)
    else if (isYearMonth(item.startMonth) && isYearMonth(item.endMonth) && item.endMonth < item.startMonth) fail(`${where} ends before it starts.`)
    if (item.debtId !== undefined && !(isText(item.debtId) && debtIds.has(item.debtId))) fail(`${where}.debtId is not a debt.`)
    if (item.note !== undefined && !isText(item.note)) fail(`${where}.note must be text.`)
    if (item.amountChanges !== undefined) {
      if (!Array.isArray(item.amountChanges)) fail(`${where}.amountChanges must be a list.`)
      else {
        let previous = isYearMonth(item.startMonth) ? item.startMonth : ''
        item.amountChanges.forEach((change: unknown, index: number) => {
          const at = `${where}.amountChanges[${index}]`
          if (!isRecord(change) || !isYearMonth(change.from)) { fail(`${at}.from must be YYYY-MM.`); return }
          if (change.amount !== null && (!isMinorAmount(change.amount) || change.amount < 0)) fail(`${at}.amount must be a whole, non-negative amount or null.`)
          if (change.from <= previous) fail(`${at} must come after the start month and the change before it.`)
          previous = change.from
        })
      }
    }
    if (!('currency' in item)) fail(`${where}.currency is missing.`)
  })

  // A debt's monthly payment lives in one place only: its bill, or the debt itself.
  const bills = (input.bills as unknown[] | undefined) ?? []
  for (const debt of ((input.debts as unknown[] | undefined) ?? []).filter(isRecord)) {
    const linked = bills.filter(bill => isRecord(bill) && bill.debtId === debt.id)
    if (linked.length > 1) fail(`Debt "${String(debt.name)}" is paid by more than one bill.`)
    if (linked.length > 0 && debt.monthlyPayment !== undefined) fail(`Debt "${String(debt.name)}" has a monthly payment and a bill; keep only the bill.`)
  }

  const billMonthKeys = new Set<string>()
  checkList('billMonths', (item, where) => {
    if (!isText(item.billId) || !billIds.has(item.billId)) fail(`${where}.billId is not a bill.`)
    if (!isYearMonth(item.month)) fail(`${where}.month must be YYYY-MM.`)
    if (typeof item.paid !== 'boolean') fail(`${where}.paid must be true or false.`)
    if ('amount' in item && item.amount !== null && (!isMinorAmount(item.amount) || item.amount < 0)) fail(`${where}.amount must be a whole, non-negative amount or null.`)
    if (item.paidOn !== undefined && !isCalendarDate(item.paidOn)) fail(`${where}.paidOn must be a real date.`)
    const key = `${String(item.billId)}:${String(item.month)}`
    if (billMonthKeys.has(key)) fail(`billMonths: ${key} is recorded twice.`)
    billMonthKeys.add(key)
  }, null)

  const accountIds = checkList('moneyAccounts', (item, where) => {
    if (!isOneOf(MONEY_ACCOUNT_KINDS)(item.kind)) fail(`${where}.kind is not a known kind.`)
    if (!isNonEmptyText(item.name)) fail(`${where}.name is missing.`)
    if (!isOwner(item.owner)) fail(`${where}.owner is not a member or "shared".`)
    if (!('currency' in item)) fail(`${where}.currency is missing.`)
  })
  for (const id of accountIds) if (debtIds.has(id)) fail(`Id "${id}" is used by a debt and a money account.`)
  const savingsIds = new Set(((input.moneyAccounts as unknown[] | undefined) ?? [])
    .filter(isRecord).filter(account => account.kind === 'savings').map(account => String(account.id)))

  checkList('balances', (item, where) => {
    if (!isText(item.accountId) || !(debtIds.has(item.accountId) || accountIds.has(item.accountId))) fail(`${where}.accountId is not a debt or money account.`)
    if (!isCalendarDate(item.asOf)) fail(`${where}.asOf must be a real date.`)
    if (!isMinorAmount(item.amount)) fail(`${where}.amount must be a whole amount.`)
    if (!isOneOf(['entered', 'goal-movement'] as const)(item.source)) fail(`${where}.source must be entered or goal-movement.`)
    if (item.movementId !== undefined && !isText(item.movementId)) fail(`${where}.movementId must be text.`)
    if (!('currency' in item)) fail(`${where}.currency is missing.`)
  })

  let emergencyCount = 0
  const goalIds = checkList('goals', (item, where) => {
    if (!isOneOf(['goal', 'emergency'] as const)(item.kind)) fail(`${where}.kind must be goal or emergency.`)
    if (item.kind === 'emergency') emergencyCount++
    if (!isNonEmptyText(item.name)) fail(`${where}.name is missing.`)
    if (!isOwner(item.owner)) fail(`${where}.owner is not a member or "shared".`)
    if (item.kind === 'emergency' && item.target === null) { /* the emergency fund may have no target */ }
    else if (!isMinorAmount(item.target) || item.target <= 0) fail(`${where}.target must be a whole amount above 0.`)
    if (item.deadline !== null && !isCalendarDate(item.deadline)) fail(`${where}.deadline must be a real date or null.`)
    if (!isMinorAmount(item.openingBalance) || item.openingBalance < 0) fail(`${where}.openingBalance must be a whole, non-negative amount.`)
    if (!isCalendarDate(item.createdOn)) fail(`${where}.createdOn must be a real date.`)
    if (!isOneOf(['active', 'archived'] as const)(item.status)) fail(`${where}.status must be active or archived.`)
    if (!('currency' in item)) fail(`${where}.currency is missing.`)
  })

  if (emergencyCount > 1) fail('There can be only one emergency fund.')

  checkList('goalMovements', (item, where) => {
    if (!isText(item.goalId) || !goalIds.has(item.goalId)) fail(`${where}.goalId is not a goal.`)
    if (!isCalendarDate(item.date)) fail(`${where}.date must be a real date.`)
    if (!isMinorAmount(item.amount) || item.amount === 0) fail(`${where}.amount must be a whole amount other than 0.`)
    if (!isText(item.note)) fail(`${where}.note must be text.`)
    if (!isOneOf(MOVEMENT_EFFECTS)(item.effect)) fail(`${where}.effect is not a known effect.`)
    else {
      const adds = item.effect === 'new-savings' || item.effect === 'assigned'
      if (isMinorAmount(item.amount) && (item.amount > 0) !== adds) fail(`${where}.amount has the wrong sign for ${item.effect}.`)
      const moves = item.effect === 'new-savings' || item.effect === 'taken-out'
      if (moves && !(isText(item.accountId) && savingsIds.has(item.accountId))) fail(`${where}.accountId must be a savings account.`)
      if (!moves && item.accountId !== undefined) fail(`${where}.accountId is only for new savings or money taken out.`)
    }
  })

  // A pot can never go below zero at any point in its history.
  if (errors.length === 0) {
    const data = input as unknown as FinanceData
    for (const goal of data.goals) {
      let saved = goal.openingBalance
      const movements = data.goalMovements
        .map((movement, order) => ({ movement, order }))
        .filter(({ movement }) => movement.goalId === goal.id)
        .sort((a, b) => a.movement.date.localeCompare(b.movement.date) || a.order - b.order)
      for (const { movement } of movements) {
        saved += movement.amount
        if (saved < 0) { fail(`Goal "${goal.name}" would go below 0 on ${movement.date}.`); break }
      }
    }
  }

  return errors.length > 0 ? { status: 'invalid', errors } : { status: 'valid', data: input as unknown as FinanceData }
}

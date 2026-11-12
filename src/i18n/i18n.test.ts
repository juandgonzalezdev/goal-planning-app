import { afterEach, describe, expect, it } from 'vitest'
import { format, placeholders, type Message } from './core'
import { AREAS, setActiveLanguage, t, translate } from './index'
import { canChoose, isLanguage, LANGUAGES, READY } from './languages'
import { formatDate, formatDayRange, formatDueDay, formatLongDate, formatMonths, formatShortYearMonth, formatYearMonth, monthName, monthNamesLong, referenceDay, shortMonthName, weekHeadings, weekdayOf } from '../ui/format'
import { outcomeText } from '../ui/saveOutcome'
import { typedSetup } from '../features/welcome/setupDraft'

/*
 * Phase B1: the catalogs stay complete and consistent, English stays as it
 * was, and dates follow the language without changing any value.
 */

afterEach(() => setActiveLanguage('en'))

const isPlural = (message: Message) => typeof message !== 'string'
const texts = (message: Message) => (typeof message === 'string' ? [message] : Object.values(message).filter((text): text is string => typeof text === 'string'))

describe('catalogs', () => {
  it('declare every key once across areas', () => {
    const seen = new Map<string, string>()
    for (const [area, messages] of Object.entries(AREAS)) {
      for (const key of Object.keys(messages.en)) {
        expect(seen.get(key), `${key} in ${area} and ${seen.get(key)}`).toBeUndefined()
        seen.set(key, area)
      }
    }
  })

  it('give Spanish and Polish exactly the English keys, never empty, with the same placeholders', () => {
    for (const [area, messages] of Object.entries(AREAS)) {
      const english = Object.keys(messages.en).sort()
      for (const language of ['es', 'pl'] as const) {
        expect(Object.keys(messages[language]).sort(), `${area}.${language}`).toEqual(english)
        for (const key of english) {
          const source: Message = messages.en[key]
          const translated: Message = messages[language][key]
          expect(isPlural(translated), `${language} ${key}: plural or not, as in English`).toBe(isPlural(source))
          for (const text of texts(translated)) expect(text.trim(), `${language} ${key} is empty`).not.toBe('')
          expect(placeholders(translated), `${language} ${key} placeholders`).toEqual(placeholders(source))
        }
      }
    }
  })

  it('give every plural the forms its language needs', () => {
    const needed = { en: ['one', 'other'], es: ['one', 'other'], pl: ['one', 'few', 'many', 'other'] } as const
    for (const messages of Object.values(AREAS)) {
      for (const language of LANGUAGES) {
        for (const [key, message] of Object.entries(messages[language]) as [string, Message][]) {
          if (typeof message === 'string') continue
          for (const form of needed[language]) expect(message[form], `${language} ${key}.${form}`).toBeTruthy()
        }
      }
    }
  })

  it('keep the words that must not be translated in the user’s data out of the catalogs', () => {
    // A catalog never holds names typed by people: placeholders carry them.
    expect(t('header.spaceLine', { space: 'Robin', mode: 'Individual' })).toBe('Robin · Individual')
  })
})

describe('translate', () => {
  it('fills placeholders and picks the plural form of each language', () => {
    expect(translate('en', 'date.months', { count: 1 })).toBe('1 month')
    expect(translate('en', 'date.months', { count: 6 })).toBe('6 months')
    expect(translate('es', 'date.months', { count: 1 })).toBe('1 mes')
    expect(translate('es', 'date.months', { count: 3 })).toBe('3 meses')
    expect(translate('pl', 'date.months', { count: 1 })).toBe('1 miesiąc')
    expect(translate('pl', 'date.months', { count: 3 })).toBe('3 miesiące')
    expect(translate('pl', 'date.months', { count: 5 })).toBe('5 miesięcy')
    expect(translate('pl', 'date.months', { count: 22 })).toBe('22 miesiące')
  })

  it('leaves an unknown placeholder visible instead of hiding the mistake', () => {
    expect(format('Hello {name}', 'en', {})).toBe('Hello {name}')
  })
})

describe('languages', () => {
  it('only English is ready until Phase B6; the preview or the language in use can still be chosen', () => {
    expect(READY).toEqual({ en: true, es: false, pl: false })
    expect(canChoose('es', false, 'en')).toBe(false)
    expect(canChoose('es', true, 'en')).toBe(true)
    expect(canChoose('pl', false, 'pl')).toBe(true)
  })

  it('rejects unsupported language preferences', () => {
    expect(isLanguage('pt')).toBe(false)
    expect(isLanguage(undefined)).toBe(false)
  })
})

describe('dates and messages by language', () => {
  it('English writes exactly what it wrote before', () => {
    expect(formatDate('2032-01-21')).toBe('21 Jan 2032')
    expect(formatYearMonth('2026-10')).toBe('October 2026')
    expect(formatShortYearMonth('2026-10')).toBe('Oct 2026')
    expect(formatLongDate('2026-12-22')).toBe('Tuesday 22 December 2026')
    expect(weekdayOf('2026-12-26')).toBe('Saturday')
    expect(formatDayRange('2026-01-01', '2026-01-07')).toBe('1–7 Jan')
    expect(formatDayRange('2026-12-30', '2027-01-05')).toBe('30 Dec – 5 Jan')
    expect(monthName('2026-10')).toBe('October')
    expect(shortMonthName('2026-10')).toBe('Oct')
    expect(monthNamesLong()[0]).toBe('January')
    expect(weekHeadings()[0]).toEqual({ short: 'Mon', full: 'Monday' })
    expect(formatMonths(1)).toBe('1 month')
    expect(formatDueDay(22)).toBe('Day 22')
    expect(referenceDay('2026-12-31', true)).toBe('31 Dec 2026 (the demo’s date)')
    expect(referenceDay('2026-10-21', false)).toBe('today (21 Oct 2026)')
    expect(outcomeText('Bill added.', 'saved')).toBe('Bill added. Saved on this device.')
    expect(outcomeText('', 'demo')).toBe(' Demo only: not saved.')
  })

  it('Spanish and Polish write the same day, month and weekday in their own words', () => {
    setActiveLanguage('es')
    expect(formatYearMonth('2026-10')).toBe('octubre de 2026')
    expect(formatLongDate('2026-12-22')).toMatch(/^martes, 22 de diciembre de 2026$/)
    expect(monthNamesLong()[0]).toBe('Enero')
    expect(weekHeadings()[0].full).toBe('lunes')
    expect(formatMonths(3)).toBe('3 meses')
    expect(outcomeText('', 'saved')).toBe(' Guardado en este dispositivo.')

    setActiveLanguage('pl')
    expect(formatYearMonth('2026-10')).toBe('październik 2026')
    expect(formatLongDate('2026-12-22')).toBe('wtorek, 22 grudnia 2026')
    expect(monthName('2026-02')).toBe('luty')
    expect(monthNamesLong()[11]).toBe('Grudzień')
    expect(weekHeadings()[6].full).toBe('niedziela')
    expect(formatDueDay(5)).toBe('Dzień 5')
  })

  it('label what was typed in Welcome Setup without calling the second person a middle name', () => {
    const draft = { step: 1, name: 'Robin', partner: 'Sam', mode: 'duo' as const, currency: 'PLN' as const, theme: 'system' as const }
    setActiveLanguage('en')
    expect(typedSetup(draft)["Second person's name"]).toBe('Sam')
    expect(typedSetup(draft)).not.toHaveProperty('Second name')
    setActiveLanguage('es')
    expect(typedSetup(draft)['Nombre de la segunda persona']).toBe('Sam')
    setActiveLanguage('pl')
    expect(typedSetup(draft)['Imię drugiej osoby']).toBe('Sam')
  })

  it('never moves a day with the time zone (dates are read from their text)', () => {
    setActiveLanguage('pl')
    for (const date of ['2026-01-01', '2026-03-29', '2026-10-25', '2026-12-31']) {
      expect(formatDate(date)).toMatch(new RegExp(`^${Number(date.slice(8, 10))} `))
    }
  })
})

import type { Language } from '../domain/finance/types'

/**
 * The app's own translation layer (Phase B1). No library: a message is a
 * plain string with `{name}` placeholders, or a plural with the forms the
 * language needs (English and Spanish: one/other; Polish: one/few/many/other).
 * The English catalog is the source of truth; Spanish and Polish are typed
 * against it, so a missing or extra key is a TypeScript error, and a test
 * also checks placeholders and plural forms.
 */

export type { Language }

/** A message that changes with a number. `other` is always required. */
export interface Plural {
  zero?: string
  one?: string
  two?: string
  few?: string
  many?: string
  other: string
}

export type Message = string | Plural

/** The shape a translation must have: the same keys as English, a string where English has a string and a plural where it has a plural. */
export type TranslationOf<E extends Record<string, Message>> = { [K in keyof E]: E[K] extends string ? string : Plural }

/** One area of the app (shell, settings…): its English messages and their two translations, side by side. */
export interface MessageArea<E extends Record<string, Message>> {
  en: E
  es: TranslationOf<E>
  pl: TranslationOf<E>
}

/** Declares an area. The type check is what makes a missing Spanish or Polish key fail the build. */
export const defineMessages = <const E extends Record<string, Message>>(area: { en: E; es: TranslationOf<E>; pl: TranslationOf<E> }): MessageArea<E> => area

export type Params = Record<string, string | number>

const pluralRules = new Map<Language, Intl.PluralRules>()
function pluralCategory(language: Language, count: number): Intl.LDMLPluralRule {
  let rules = pluralRules.get(language)
  if (!rules) {
    rules = new Intl.PluralRules(language)
    pluralRules.set(language, rules)
  }
  return rules.select(count)
}

/** Fills `{name}` placeholders. An unknown placeholder stays as written, so a mistake is visible instead of silent. */
export function interpolate(text: string, params?: Params): string {
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole))
}

/** Picks the plural form for `count` (falling back to `other`) and fills its placeholders. */
export function format(message: Message, language: Language, params?: Params): string {
  if (typeof message === 'string') return interpolate(message, params)
  const count = Number(params?.count ?? 0)
  const form = message[pluralCategory(language, count)] ?? message.other
  return interpolate(form, params)
}

/** The placeholder names a message uses, in every plural form. */
export function placeholders(message: Message): string[] {
  const texts = typeof message === 'string' ? [message] : Object.values(message).filter((text): text is string => typeof text === 'string')
  return [...new Set(texts.flatMap(text => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1])))].sort()
}

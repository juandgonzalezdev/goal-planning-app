import { createContext, createElement, useContext, type ReactNode } from 'react'
import type { Language } from '../domain/finance/types'
import { format, type Message, type MessageArea, type Params } from './core'
import { DEFAULT_LANGUAGE } from './languages'
import { settings } from './catalog/settings'
import { shell } from './catalog/shell'
import { welcome } from './catalog/welcome'

/**
 * Every area of the app with its messages. A new area is added here; a test
 * checks that no key is declared twice and that every language has the same
 * keys, placeholders and plural forms.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const AREAS: Record<string, MessageArea<any>> = { shell, welcome, settings }

type Keys<A> = A extends MessageArea<infer E> ? keyof E & string : never
/** Every message the app can show. Typing a key that does not exist is a TypeScript error. */
export type MessageKey = Keys<typeof shell> | Keys<typeof welcome> | Keys<typeof settings>

const catalogs: Record<Language, Record<string, Message>> = { en: {}, es: {}, pl: {} }
for (const area of Object.values(AREAS)) {
  for (const language of Object.keys(catalogs) as Language[]) Object.assign(catalogs[language], area[language])
}

/** A message in one language. A key missing from a translation falls back to English (the tests make sure none is). */
export function translate(language: Language, key: MessageKey, params?: Params): string {
  const message = catalogs[language][key] ?? catalogs.en[key]
  return message === undefined ? key : format(message, language, params)
}

/**
 * The language the app shows now. The shell (App) sets it from the open
 * space's preference before anything renders, so plain functions that
 * write text (formatting dates, save messages) follow it too.
 */
let active: Language = DEFAULT_LANGUAGE
export const activeLanguage = (): Language => active
export function setActiveLanguage(language: Language): void {
  active = language
  if (typeof document !== 'undefined') document.documentElement.lang = language
}

/** A message in the language shown now (for code outside React components). */
export const t = (key: MessageKey, params?: Params): string => translate(active, key, params)

const LanguageContext = createContext<Language>(DEFAULT_LANGUAGE)

/** Gives the screens below it the language to show. Changing it re-renders them; nothing is remounted, so forms keep what was typed. */
export function LanguageProvider({ language, children }: { language: Language; children: ReactNode }) {
  setActiveLanguage(language)
  return createElement(LanguageContext.Provider, { value: language }, children)
}

/** For components: the language shown and `t` for it. */
export function useT() {
  const language = useContext(LanguageContext)
  return { language, t: (key: MessageKey, params?: Params) => translate(language, key, params) }
}

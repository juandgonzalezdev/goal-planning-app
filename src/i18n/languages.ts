import type { Language } from '../domain/finance/types'

export const LANGUAGES: readonly Language[] = ['en', 'es', 'pl']

/** Each language in its own name, so people find theirs whatever language the app is in. */
export const LANGUAGE_NAMES: Record<Language, string> = { en: 'English', es: 'Español', pl: 'Polski' }

export const DEFAULT_LANGUAGE: Language = 'en'

/**
 * Languages people can choose. Spanish and Polish are switched on (Phase B6)
 * only when every screen is translated, so nobody sees half-translated
 * screens. Until then the selectors list them as "coming soon", unless
 * the preview is on for this device (for testing on a phone).
 */
export const READY: Record<Language, boolean> = { en: true, es: false, pl: false }

export const isLanguage = (value: unknown): value is Language => typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value)

/** Whether a language can be chosen here: ready, or shown by the preview. A language already in use always stays choosable. */
export const canChoose = (language: Language, preview: boolean, current: Language) => READY[language] || preview || language === current

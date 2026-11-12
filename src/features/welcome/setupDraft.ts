import type { SpaceSetup } from '../../domain/finance/space'
import type { SpaceMode, Theme } from '../../domain/finance/types'
import type { CurrencyCode } from '../../domain/money'
import { t } from '../../i18n'

/** What has been chosen so far in Welcome Setup. Kept by the app, so nothing is lost when moving away and back. */
export type SetupDraft = { step: number; name: string; partner: string; mode: SpaceMode; currency: CurrencyCode; theme: Theme }

export const EMPTY_SETUP: SetupDraft = { step: 0, name: '', partner: '', mode: 'individual', currency: 'PLN', theme: 'system' }

export const setupFromDraft = (draft: SetupDraft): SpaceSetup =>
  ({ mode: draft.mode, names: [draft.name, draft.partner], currency: draft.currency, theme: draft.theme })

/** The Welcome Setup draft as the user sees it, for Copy What I Typed. */
export const typedSetup = (draft: SetupDraft) => ({
  [t('setup.typedName')]: draft.name, [t('setup.typedSecond')]: draft.partner, [t('setup.typedSpace')]: draft.mode,
  [t('setup.currency')]: draft.currency, [t('setup.typedAppearance')]: draft.theme,
})

import { useEffect, useState, useSyncExternalStore } from 'react'

/**
 * Every screen the app can show. The first four come before a space is
 * open; the five tabs, a goal, the New Goal and emergency fund drafts, one
 * card or loan, one bill and Settings belong to an open space. `cards` and
 * `data` are the tabs of earlier versions: a step of the browser history
 * saved before the update may still name them, so they are read (as Money)
 * but never created again.
 */
export const SCREENS = ['welcome', 'sign-up', 'log-in', 'setup', 'home', 'bills', 'goals', 'money', 'history', 'goal', 'new-goal', 'emergency', 'debt', 'bill', 'settings', 'cards', 'data'] as const
export type Screen = (typeof SCREENS)[number]

/** The five main tabs, in the approved order. */
export const TABS = ['home', 'bills', 'goals', 'money', 'history'] as const satisfies readonly Screen[]
export type Tab = (typeof TABS)[number]

/** Screens of earlier versions, and the screen that shows them now. */
export const OLD_SCREENS = { cards: 'money', data: 'money' } as const satisfies Partial<Record<Screen, Screen>>
type OldScreen = keyof typeof OLD_SCREENS
export const isOldScreen = (screen: Screen): screen is OldScreen => screen in OLD_SCREENS
/** The screen to show for a screen name: an old tab shows the screen that took its place. */
export const shownScreen = (screen: Screen): Exclude<Screen, OldScreen> => (isOldScreen(screen) ? OLD_SCREENS[screen] : screen)

/** Screens that only make sense inside an open space (own or demo). */
const SPACE_ONLY: readonly Screen[] = ['goal', 'new-goal', 'emergency', 'debt', 'bill', 'settings', 'cards', 'data']
export const isSpaceScreen = (screen: Screen) => (TABS as readonly Screen[]).includes(screen) || SPACE_ONLY.includes(screen)
export const isTab = (screen: Screen): screen is Tab => (TABS as readonly Screen[]).includes(screen)

/** Which way the user moved, so a transition can slide the matching way. */
export type Direction = 'forward' | 'back'

export const isScreen = (value: unknown): value is Screen =>
  typeof value === 'string' && (SCREENS as readonly string[]).includes(value)

/** Reads the screen stored in a browser history entry; anything unknown means `fallback`. */
export function screenFromHistoryState(state: unknown, fallback: Screen = 'welcome'): Screen {
  const screen = (state as { screen?: unknown } | null)?.screen
  return isScreen(screen) ? screen : fallback
}

/**
 * One step of the app in the browser history. `chain` names a run of steps
 * the app added one after another in this tab, and `idx` is the step's
 * place in that run, so the distance between two steps of the same chain
 * is known. Steps of different chains (or with no chain: an older version
 * of the app) are never compared. Only the screen name goes into the
 * history: never anything the user typed.
 */
export interface HistoryStep { screen: Screen; chain: string; idx: number }

/** What a history entry says, as far as it can be read. */
export function readStep(state: unknown): { screen: Screen | null; chain: string | null; idx: number | null } {
  const raw = (state ?? {}) as { screen?: unknown; chain?: unknown; idx?: unknown }
  const chain = typeof raw.chain === 'string' && raw.chain !== '' ? raw.chain : null
  const idx = typeof raw.idx === 'number' && Number.isInteger(raw.idx) && raw.idx >= 0 ? raw.idx : null
  return { screen: isScreen(raw.screen) ? raw.screen : null, chain: chain !== null && idx !== null ? chain : null, idx: chain !== null ? idx : null }
}

/** The browser history, as the app uses it. Tests pass their own. */
export interface HistoryPort {
  state(): unknown
  push(step: HistoryStep): void
  replace(step: HistoryStep): void
  go(delta: number): void
  listen(onPop: (state: unknown) => void): () => void
}

export const browserHistory = (): HistoryPort => ({
  state: () => window.history.state,
  push: step => window.history.pushState(step, ''),
  replace: step => window.history.replaceState(step, ''),
  go: delta => window.history.go(delta),
  listen: onPop => {
    const handler = (event: PopStateEvent) => onPop(event.state)
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  },
})

/** A new chain name. Random, so two chains of one tab never share it; no storage is read or written. */
export function newChain(): string {
  const crypto = globalThis.crypto
  if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID()
  if (typeof crypto?.getRandomValues === 'function') return [...crypto.getRandomValues(new Uint32Array(4))].map(n => n.toString(36)).join('-')
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

/**
 * Where Back or Forward wanted to go while forms would be dropped: the
 * first such move, kept until Keep Editing or Discard and Leave.
 * `step`: a step of the chain the forms are on, so the app moved the
 * browser back to the forms and knows how far the destination is.
 * `here`: a step the app cannot place (another chain, or none); the browser
 * stays on it, the forms stay on screen, and the step now carries the
 * screen with the forms. `original` is what it said before, to put back.
 */
export type HistoryLeave =
  | { kind: 'step'; screen: Screen | null; chain: string; idx: number }
  | { kind: 'here'; screen: Screen | null; original: unknown }

export interface NavigationState {
  screen: Screen
  direction: Direction
  /** A move by Back or Forward that would drop forms (the first one, see `HistoryLeave`). */
  request: HistoryLeave | null
  /**
   * Discard and Leave can move now: no move the app asked the browser for is
   * still under way, and the browser is on the step the app shows.
   */
  ready: boolean
  /**
   * A move arrived that the app cannot tell apart from one it asked for, so
   * one of its own may still arrive late. Until the forms are gone, the app
   * no longer moves the history to answer a question.
   */
  unsure: boolean
  /** Discard and Leave was chosen; the browser is on its way. */
  leaving: boolean
}

/** `onGuard`: a move by Back or Forward is being undone (the first of a question). `onRestored`: the browser is back on the forms' step. */
export interface NavigationHooks { onGuard?: () => void; onRestored?: () => void }

/** Screen to show for a step with no screen the app knows (decision: Home, or Welcome when no space is open). */
const FALLBACK: Screen = 'home'

/**
 * The screens and the browser history, and the guard on Back and Forward.
 *
 * The browser moves first and says so after (`popstate`); it cannot be
 * stopped. When forms would be dropped, the app never changes the screen:
 * on a step of the same chain it asks the browser once to go back to the
 * forms' step; on any other step it stays, and that step now carries the
 * screen with the forms (`here`). Nothing is decided by time: a move that
 * arrives late is judged only by the step it arrives on, and only Discard
 * and Leave (one move, to one step) or "nothing to lose" changes the screen.
 */
export class Navigation {
  private anchor: HistoryStep
  private state: NavigationState
  /** The step the app's own move should arrive on, while it is under way. */
  private outstanding: { chain: string; idx: number } | null = null
  /** The one arrival Discard and Leave (or Back after a save) allows. */
  private permit: { chain: string; idx: number } | 'other-chain' | null = null
  private listeners = new Set<() => void>()

  private readonly port: HistoryPort
  /** True while moving to another screen would drop forms with changes. */
  private losing: () => boolean
  private hooks: NavigationHooks
  private readonly makeChain: () => string

  constructor(port: HistoryPort, initial: Screen, losing: () => boolean, hooks: NavigationHooks = {}, makeChain: () => string = newChain) {
    this.port = port
    this.losing = losing
    this.hooks = hooks
    this.makeChain = makeChain
    this.anchor = { screen: initial, chain: '', idx: 0 }
    this.state = { screen: initial, direction: 'forward', request: null, ready: true, unsure: false, leaving: false }
  }

  /** What the app says about its forms, given again after each render. */
  configure(losing: () => boolean, hooks: NavigationHooks = {}) {
    this.losing = losing
    this.hooks = hooks
  }

  /** Puts the first screen on the current step (keeping its chain after a reload) and listens. Returns the stop. */
  start(): () => void {
    const current = readStep(this.port.state())
    this.anchor = { screen: this.state.screen, chain: current.chain ?? this.makeChain(), idx: current.idx ?? 0 }
    this.port.replace(this.anchor)
    return this.port.listen(state => this.onPop(state))
  }

  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  /** The step the app shows (its chain and place), to know later whether Back returned to this very step. */
  current = (): { chain: string; idx: number } => ({ chain: this.anchor.chain, idx: this.anchor.idx })
  snapshot = () => this.state

  private emit(patch: Partial<NavigationState>) {
    const next = { ...this.state, ...patch }
    next.ready = this.outstanding === null && !next.unsure && !next.leaving && this.onAnchor()
    this.state = next
    for (const listener of this.listeners) listener()
  }

  /** The browser is on the step the app shows. */
  private onAnchor(): boolean {
    const here = readStep(this.port.state())
    return here.chain === this.anchor.chain && here.idx === this.anchor.idx
  }

  /** The step the browser is on now, when the app can place it. */
  private here(): { chain: string; idx: number } | null {
    const here = readStep(this.port.state())
    return here.chain !== null && here.idx !== null ? { chain: here.chain, idx: here.idx } : null
  }

  /** A new screen, as a new step after the one the browser is on (steps ahead of it are dropped, as the browser does). */
  go(next: Screen) {
    const here = this.here()
    const step = here ? { screen: next, chain: here.chain, idx: here.idx + 1 } : { screen: next, chain: this.makeChain(), idx: 0 }
    this.port.push(step)
    this.anchor = step
    this.permit = null
    this.emit({ screen: next, direction: 'forward', request: null, leaving: false, unsure: this.state.unsure && this.losing() })
  }

  /** Moves without adding a step, e.g. after finishing setup, so Back does not return into it. */
  replace(next: Screen) {
    const here = this.here()
    const step = { screen: next, chain: here?.chain ?? this.makeChain(), idx: here?.idx ?? 0 }
    this.port.replace(step)
    this.anchor = step
    this.permit = null
    this.emit({ screen: next, direction: 'forward', request: null, leaving: false })
  }

  /** The same as the browser back button (the app's Back buttons, once nothing would be dropped). */
  back() { this.port.go(-1) }

  /**
   * Back that is allowed to drop the forms: after Discard and Leave, or after
   * a save (the saved form is still on screen). Only the step before is allowed.
   */
  backAllowed() {
    const target = this.anchor.idx > 0 ? { chain: this.anchor.chain, idx: this.anchor.idx - 1 } : 'other-chain' as const
    this.permit = target
    this.outstanding = target === 'other-chain' ? null : target
    this.port.go(-1)
    this.emit({ leaving: true })
  }

  /** Keep Editing: the question ends; a later move is a new question. */
  keepEditing() {
    this.permit = null
    this.emit({ request: null, leaving: false })
  }

  /** Discard and Leave for Back or Forward: one move, to the first destination asked. */
  leave(): boolean {
    const request = this.state.request
    if (!request || !this.state.ready) return false
    if (request.kind === 'step') {
      if (request.chain !== this.anchor.chain) { this.emit({ unsure: true }); return false }
      this.permit = { chain: request.chain, idx: request.idx }
      this.outstanding = this.permit
      this.port.go(request.idx - this.anchor.idx)
      this.emit({ leaving: true })
      return true
    }
    // The browser is already on that step: it gets back what it said, and its screen is shown. No move.
    const original = readStep(request.original)
    const step = { screen: original.screen ?? FALLBACK, chain: original.chain ?? this.makeChain(), idx: original.idx ?? 0 }
    this.port.replace(step)
    this.anchor = step
    this.emit({ screen: step.screen, direction: 'back', request: null, leaving: false })
    return true
  }

  private onPop(state: unknown) {
    const step = readStep(state)
    const placed = step.chain !== null && step.idx !== null
    const atAnchor = placed && step.chain === this.anchor.chain && step.idx === this.anchor.idx
    // The app's own move: it arrived where expected, or something else arrived first (then it may still arrive, late).
    let expected = false
    let unsure = this.state.unsure
    if (this.outstanding) {
      if (placed && step.chain === this.outstanding.chain && step.idx === this.outstanding.idx) { this.outstanding = null; expected = true }
      else unsure = true
    }
    // The one arrival Discard and Leave allows; any other arrival ends the permission.
    const permit = this.permit
    this.permit = null
    const allowed = permit !== null && (permit === 'other-chain' ? !placed || step.chain !== this.anchor.chain : placed && step.chain === permit.chain && step.idx === permit.idx)
    if (allowed || !this.losing()) {
      if (!this.losing()) { this.outstanding = null; unsure = false }
      this.arrive(step, unsure)
      return
    }
    // Forms would be dropped: the screen stays as it is.
    if (atAnchor) {
      if (expected) this.hooks.onRestored?.()
      this.emit({ unsure, leaving: false })
      return
    }
    if (!this.state.request) this.hooks.onGuard?.()
    if (placed && step.chain === this.anchor.chain && !this.outstanding && !unsure) {
      const request = this.state.request ?? { kind: 'step' as const, screen: step.screen, chain: step.chain!, idx: step.idx! }
      this.outstanding = { chain: this.anchor.chain, idx: this.anchor.idx }
      this.emit({ request, unsure, leaving: false })
      this.port.go(this.anchor.idx - step.idx!)
      return
    }
    // A step the app cannot place, or its own move may still arrive: no move at all. This step now carries the forms' screen.
    const stamped = { screen: this.anchor.screen, chain: this.makeChain(), idx: 0 }
    this.port.replace(stamped)
    this.anchor = stamped
    const first = this.state.request
    this.emit({ request: first ?? { kind: 'here', screen: step.screen, original: state }, unsure: unsure || first !== null, leaving: false })
  }

  /** Shows the step the browser arrived on. */
  private arrive(step: ReturnType<typeof readStep>, unsure: boolean) {
    const sameChain = step.chain !== null && step.chain === this.anchor.chain
    const direction: Direction = sameChain && step.idx! > this.anchor.idx ? 'forward' : 'back'
    const screen = step.screen ?? FALLBACK
    if (step.chain !== null && step.idx !== null) this.anchor = { screen, chain: step.chain, idx: step.idx }
    else {
      // A step with no chain (an older version of the app): it starts a chain of its own.
      this.anchor = { screen, chain: this.makeChain(), idx: 0 }
      this.port.replace(this.anchor)
    }
    this.emit({ screen, direction, request: null, unsure, leaving: false })
  }
}

/**
 * The current screen, linked to the browser history so the browser back
 * button and the phone back gesture move between screens, with the guard
 * on Back and Forward (see `Navigation`). `losing` says whether moving to
 * another screen would drop forms with changes.
 */
export function useNavigation(initial: Screen, losing: () => boolean, hooks: NavigationHooks = {}, port?: HistoryPort) {
  const [navigation] = useState(() => new Navigation(port ?? browserHistory(), initial, () => false))
  useEffect(() => { navigation.configure(losing, hooks) })
  useEffect(() => navigation.start(), [navigation])
  const state = useSyncExternalStore(navigation.subscribe, navigation.snapshot)
  return { ...state, navigation }
}

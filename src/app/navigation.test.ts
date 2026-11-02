import { describe, expect, it } from 'vitest'
import { Navigation, readStep, shownScreen, TABS, type HistoryPort, type HistoryStep } from './navigation'

/**
 * A browser history the test drives by hand. A move the app asks for
 * (`go`) waits in a queue until the test lets it arrive (`deliver`), late or
 * never (`drop`); a move by the user (`user`) happens at once, as Back,
 * Forward or a long press on Back does, ahead of anything still queued.
 * Arriving fires `popstate` with the step's state, like the browser.
 */
class TestHistory implements HistoryPort {
  entries: unknown[]
  index: number
  queue: number[] = []
  calls = { go: 0, push: 0, replace: 0 }
  private onPop: ((state: unknown) => void) | null = null

  constructor(entries: unknown[] = [null]) {
    this.entries = [...entries]
    this.index = this.entries.length - 1
  }
  state() { return this.entries[this.index] }
  push(step: HistoryStep) { this.calls.push++; this.entries = [...this.entries.slice(0, this.index + 1), step]; this.index++ }
  replace(step: HistoryStep) { this.calls.replace++; this.entries[this.index] = step }
  go(delta: number) { this.calls.go++; this.queue.push(delta) }
  listen(onPop: (state: unknown) => void) { this.onPop = onPop; return () => { this.onPop = null } }
  private traverse(delta: number) {
    const target = this.index + delta
    if (delta === 0 || target < 0 || target >= this.entries.length) return
    this.index = target
    this.onPop?.(this.entries[target])
  }
  /** The user's own Back (-1), Forward (+1) or jump. */
  user(delta: number) { this.traverse(delta) }
  /** The oldest move the app asked for arrives now. */
  deliver() { const delta = this.queue.shift(); if (delta !== undefined) this.traverse(delta) }
  deliverAll() { while (this.queue.length > 0) this.deliver() }
  /** The browser ignores the oldest move the app asked for. */
  drop() { this.queue.shift() }
  screens() { return this.entries.map(entry => readStep(entry).screen) }
}

function setUp(entries?: unknown[]) {
  const history = new TestHistory(entries)
  let typed = false
  let chains = 0
  const restored: number[] = []
  const navigation = new Navigation(history, 'home', () => typed, { onRestored: () => restored.push(1) }, () => `chain-${++chains}`)
  navigation.start()
  return {
    history, navigation, restored,
    type: () => { typed = true },
    clear: () => { typed = false },
    screen: () => navigation.snapshot().screen,
  }
}

/** Home › Bills › a bill, with something typed on the bill. */
function onBill(entries?: unknown[]) {
  const test = setUp(entries)
  test.navigation.go('bills')
  test.navigation.go('bill')
  test.type()
  return test
}

describe('history steps', () => {
  it('puts the first screen on a new chain, and each new screen one step further on it', () => {
    const { history, navigation } = setUp()
    expect(readStep(history.state())).toEqual({ screen: 'home', chain: 'chain-1', idx: 0 })
    navigation.go('bills')
    navigation.go('bill')
    expect(readStep(history.state())).toEqual({ screen: 'bill', chain: 'chain-1', idx: 2 })
    navigation.replace('debt')
    expect(readStep(history.state())).toEqual({ screen: 'debt', chain: 'chain-1', idx: 2 })
  })

  it('after a reload, keeps the chain of the step it is on', () => {
    const { history } = setUp([{ screen: 'home', chain: 'old', idx: 0 }, { screen: 'bills', chain: 'old', idx: 1 }])
    expect(readStep(history.state())).toEqual({ screen: 'home', chain: 'old', idx: 1 })
  })

  it('reads a step of an older version of the app (screen only) as a step with no chain', () => {
    expect(readStep({ screen: 'bills' })).toEqual({ screen: 'bills', chain: null, idx: null })
    expect(readStep({ screen: 'nowhere', chain: 'a', idx: 2 })).toEqual({ screen: null, chain: 'a', idx: 2 })
    expect(readStep({ screen: 'bills', chain: 'a', idx: -1 })).toEqual({ screen: 'bills', chain: null, idx: null })
  })

  it('after going back, a new screen replaces the steps ahead, as the browser does', () => {
    const { history, navigation } = setUp()
    navigation.go('bills')
    navigation.go('bill')
    history.user(-1)
    navigation.go('cards')
    expect(history.screens()).toEqual(['home', 'bills', 'cards'])
    expect(readStep(history.state()).idx).toBe(2)
  })
})

describe('Back and Forward with nothing typed', () => {
  it('show the step the browser arrives on', () => {
    const { history, navigation, screen } = setUp()
    navigation.go('bills')
    history.user(-1)
    expect(screen()).toBe('home')
    expect(navigation.snapshot().direction).toBe('back')
    history.user(1)
    expect(screen()).toBe('bills')
    expect(navigation.snapshot().direction).toBe('forward')
    expect(history.calls.go).toBe(0)
  })
})

describe('Back and Forward with something typed', () => {
  it('Back: the screen stays, the browser goes back to the form once, and the question waits for the first destination', () => {
    const { history, navigation, screen, restored } = onBill()
    history.user(-1)
    expect(screen()).toBe('bill')
    expect(navigation.snapshot().request).toEqual({ kind: 'step', screen: 'bills', chain: 'chain-1', idx: 1 })
    expect(navigation.snapshot().ready).toBe(false)
    expect(history.queue).toEqual([1])
    history.deliver()
    expect(history.index).toBe(2)
    expect(screen()).toBe('bill')
    expect(navigation.snapshot().ready).toBe(true)
    expect(restored).toHaveLength(1)
    expect(history.entries).toHaveLength(3)
  })

  it('Keep Editing ends the question; the next Back is a new question', () => {
    const { history, navigation, screen } = onBill()
    history.user(-1)
    history.deliver()
    navigation.keepEditing()
    expect(navigation.snapshot().request).toBeNull()
    expect(screen()).toBe('bill')
    history.user(-2)
    expect(navigation.snapshot().request).toEqual({ kind: 'step', screen: 'home', chain: 'chain-1', idx: 0 })
  })

  it('Discard and Leave: one move to the first destination; no step is added', () => {
    const { history, navigation, screen } = onBill()
    history.user(-1)
    history.deliver()
    const goes = history.calls.go
    expect(navigation.leave()).toBe(true)
    expect(navigation.snapshot().leaving).toBe(true)
    expect(screen()).toBe('bill')
    history.deliver()
    expect(screen()).toBe('bills')
    expect(history.calls.go).toBe(goes + 1)
    expect(history.calls.push).toBe(2)
    expect(history.entries).toHaveLength(3)
    // The permission was for that one arrival: Forward again, with something typed again, asks.
    history.user(1)
    expect(screen()).toBe('bills')
    expect(navigation.snapshot().request?.kind).toBe('step')
  })

  it('a jump of several steps (long press on Back) comes back in one move, and Discard and Leave goes all the way', () => {
    const { history, navigation, screen } = onBill()
    navigation.go('history')
    history.user(-3)
    expect(history.queue).toEqual([3])
    history.deliver()
    expect(screen()).toBe('history')
    expect(navigation.snapshot().request).toMatchObject({ screen: 'home', idx: 0 })
    navigation.leave()
    expect(history.queue).toEqual([-3])
    history.deliver()
    expect(screen()).toBe('home')
  })

  it('Forward is undone the same way', () => {
    const { history, navigation, screen, type } = setUp()
    navigation.go('bills')
    navigation.go('bill')
    history.user(-1)
    type()
    history.user(1)
    expect(screen()).toBe('bills')
    expect(navigation.snapshot().request).toMatchObject({ screen: 'bill', idx: 2 })
    expect(history.queue).toEqual([-1])
    history.deliver()
    expect(navigation.snapshot().ready).toBe(true)
  })

  it('more Back while the question is open keeps the first destination, and never adds a move under way', () => {
    const { history, navigation, screen } = onBill()
    history.user(-1)
    history.deliver()
    history.user(-2)
    expect(navigation.snapshot().request).toMatchObject({ screen: 'bills', idx: 1 })
    expect(history.queue).toEqual([2])
    history.deliver()
    expect(screen()).toBe('bill')
    expect(navigation.snapshot().ready).toBe(true)
    navigation.leave()
    history.deliver()
    expect(screen()).toBe('bills')
  })
})

describe('moves the app cannot tell apart from its own', () => {
  it('Back again before the browser is back on the form: no second move, the first destination stays, Discard and Leave stays off', () => {
    const { history, navigation, screen } = onBill()
    history.user(-1)
    history.user(-1)
    expect(screen()).toBe('bill')
    expect(history.calls.go).toBe(1)
    expect(navigation.snapshot().unsure).toBe(true)
    expect(navigation.snapshot().request).toMatchObject({ kind: 'step', screen: 'bills', idx: 1 })
    expect(navigation.snapshot().ready).toBe(false)
    expect(navigation.leave()).toBe(false)
    // The app's own move arrives late: still no change of screen, no new move, nothing dropped.
    history.deliver()
    expect(screen()).toBe('bill')
    expect(history.calls.go).toBe(1)
    expect(navigation.leave()).toBe(false)
    expect(history.entries).toHaveLength(3)
  })

  it('two actions arriving on the same step: the user\'s Forward lands where the app\'s move would, and the app\'s move arrives after', () => {
    const { history, navigation, screen } = onBill()
    navigation.go('history')
    history.user(-1)
    // The user presses Forward before the app's own move: the browser is back on the form, by the user.
    history.user(1)
    expect(screen()).toBe('history')
    // The app's move (+1) arrives late from there: past the end, so the browser ignores it; nothing changes.
    history.deliver()
    expect(screen()).toBe('history')
    expect(history.calls.go).toBe(1)
  })

  it('the same step reached by different moves, then a late move elsewhere: never a change of screen while something is typed', () => {
    const { history, navigation, screen } = onBill()
    navigation.go('history')
    history.user(-2)
    history.user(1)
    history.deliver()
    expect(screen()).toBe('history')
    expect(history.entries).toHaveLength(4)
    expect(navigation.snapshot().request).not.toBeNull()
  })

  it('a move the browser ignored: Discard and Leave never turns on by waiting', () => {
    const { history, navigation } = onBill()
    history.user(-1)
    history.drop()
    expect(navigation.snapshot().ready).toBe(false)
    expect(navigation.leave()).toBe(false)
    // Keep Editing ends the question; the form stays.
    navigation.keepEditing()
    expect(navigation.snapshot().request).toBeNull()
  })

  it('a late move after Keep Editing: the screen stays and what was typed is not dropped', () => {
    const { history, navigation, screen } = onBill()
    history.user(-1)
    navigation.keepEditing()
    history.deliver()
    expect(screen()).toBe('bill')
    expect(navigation.snapshot().request).toBeNull()
    expect(navigation.snapshot().ready).toBe(true)
  })

  it('Discard and Leave, and the user\'s own Back reaches the same step first: that step is shown; the app\'s late move never drops what is typed there', () => {
    const { history, navigation, screen, clear } = onBill()
    history.user(-1)
    history.deliver()
    navigation.leave()
    // The user presses Back before the app's move arrives, and lands on the very step chosen.
    history.user(-1)
    expect(screen()).toBe('bills')
    // Something is typed on Bills (still typed here), then the app's own move arrives late, one more step back.
    history.deliver()
    expect(history.index).toBe(0)
    expect(screen()).toBe('bills')
    expect(navigation.snapshot().request).toMatchObject({ screen: 'home' })
    // Nothing typed any more: Back and Forward work as usual again.
    clear()
    history.user(1)
    expect(navigation.snapshot().unsure).toBe(false)
  })

  it('Discard and Leave, then another Back before the app\'s move arrives: not the step allowed, so the screen stays and nothing is dropped', () => {
    const { history, navigation, screen } = onBill()
    navigation.go('history')
    history.user(-2)
    history.deliver()
    navigation.leave()
    history.user(-1)
    expect(screen()).toBe('history')
    expect(navigation.snapshot().unsure).toBe(true)
    history.deliver()
    expect(screen()).toBe('history')
    expect(navigation.leave()).toBe(false)
  })

  it('after Discard and Leave arrived, something typed on the new screen is protected from a later move', () => {
    const { history, navigation, screen } = onBill()
    navigation.go('history')
    history.user(-1)
    history.deliver()
    navigation.leave()
    history.deliver()
    expect(screen()).toBe('bill')
    // Still typed (a form on the bill screen): a later Forward is a new question.
    history.user(1)
    expect(screen()).toBe('bill')
    expect(navigation.snapshot().request).toMatchObject({ screen: 'history' })
  })
})

describe('steps the app cannot place', () => {
  it('a step with no chain: no move at all, the step now carries the form; Discard and Leave puts it back and shows its screen', () => {
    const { history, navigation, screen } = onBill([{ screen: 'cards' }, null])
    expect(history.entries).toHaveLength(4)
    history.user(-3)
    expect(screen()).toBe('bill')
    expect(history.calls.go).toBe(0)
    expect(readStep(history.state())).toMatchObject({ screen: 'bill', chain: 'chain-2', idx: 0 })
    expect(navigation.snapshot().request).toEqual({ kind: 'here', screen: 'cards', original: { screen: 'cards' } })
    expect(navigation.snapshot().ready).toBe(true)
    navigation.leave()
    expect(screen()).toBe('cards')
    expect(readStep(history.state())).toMatchObject({ screen: 'cards' })
    expect(history.entries).toHaveLength(4)
  })

  it('a step with no screen it knows: Discard and Leave shows Home', () => {
    const { history, navigation, screen } = onBill([{ nothing: true }, null])
    history.user(-3)
    navigation.leave()
    expect(screen()).toBe('home')
  })

  it('a step of another chain is never compared: no distance is worked out from its index', () => {
    const { history, navigation, screen } = onBill([{ screen: 'cards', chain: 'other', idx: 5 }, null])
    history.user(-3)
    expect(history.calls.go).toBe(0)
    expect(screen()).toBe('bill')
    expect(navigation.snapshot().request?.kind).toBe('here')
  })

  it('Keep Editing on such a step: the form stays; the next Back is judged again, with no move', () => {
    const { history, navigation, screen } = onBill([{ screen: 'cards' }, { screen: 'data' }, null])
    history.user(-3)
    navigation.keepEditing()
    history.user(-1)
    expect(screen()).toBe('bill')
    expect(history.calls.go).toBe(0)
    expect(navigation.snapshot().request).toMatchObject({ kind: 'here', screen: 'cards' })
  })
})

describe('Back after a save', () => {
  it('allows only the step before', () => {
    const { history, navigation, screen } = onBill()
    navigation.backAllowed()
    history.deliver()
    expect(screen()).toBe('bills')
  })

  it('a different arrival ends the permission', () => {
    const { history, navigation, screen } = onBill()
    navigation.backAllowed()
    history.user(-2)
    expect(screen()).toBe('bill')
    history.deliver()
    expect(screen()).toBe('bill')
  })
})

describe('never a loop', () => {
  it('many Back and Forward presses in any order: at most one move of the app under way, no step added', () => {
    const { history, navigation, screen } = onBill()
    navigation.go('history')
    const presses = [-1, -1, 1, -2, 1, -1, 2, -3, 1, 1]
    for (const press of presses) {
      history.user(press)
      expect(history.queue.length).toBeLessThanOrEqual(1)
      expect(screen()).toBe('history')
    }
    history.deliverAll()
    expect(screen()).toBe('history')
    expect(history.calls.push).toBe(3)
    expect(history.entries).toHaveLength(4)
    expect(history.calls.go).toBeLessThanOrEqual(presses.length)
  })
})

describe('steps of earlier versions (Cards and Data tabs)', () => {
  it('reads cards and data as screens, shown as Money, and never offers them as tabs', () => {
    expect(readStep({ screen: 'cards', chain: 'old', idx: 3 })).toEqual({ screen: 'cards', chain: 'old', idx: 3 })
    expect(readStep({ screen: 'data', chain: 'old', idx: 1 })).toEqual({ screen: 'data', chain: 'old', idx: 1 })
    expect(shownScreen('cards')).toBe('money')
    expect(shownScreen('data')).toBe('money')
    expect(shownScreen('goals')).toBe('goals')
    expect([...TABS]).toEqual(['home', 'bills', 'goals', 'money', 'history'])
  })

  it('compares an old step by its chain and place only: Back to it is exact, and nothing is created or rewritten', () => {
    const { history, navigation, screen } = setUp()
    navigation.go('money')
    // The step before is one an earlier version saved as Cards.
    history.entries[0] = { screen: 'cards', chain: 'chain-1', idx: 0 }
    const length = history.entries.length
    const replaced = history.calls.replace
    navigation.back()
    history.deliverAll()
    expect(screen()).toBe('cards')
    expect(history.entries).toHaveLength(length)
    expect(history.calls.replace).toBe(replaced)
    expect(history.calls.push).toBe(1)
  })

  it('with something typed: Back to an old step is undone, asks, and Discard and Leave reaches it once', () => {
    const { history, navigation, screen, type } = setUp()
    navigation.go('money')
    history.entries[0] = { screen: 'data', chain: 'chain-1', idx: 0 }
    type()
    history.user(-1)
    expect(screen()).toBe('money')
    expect(navigation.snapshot().request).not.toBeNull()
    history.deliverAll()
    expect(screen()).toBe('money')
    expect(navigation.snapshot().ready).toBe(true)
    navigation.leave()
    history.deliverAll()
    expect(screen()).toBe('data')
    expect(readStep(history.state()).idx).toBe(0)
    expect(history.entries).toHaveLength(2)
  })
})

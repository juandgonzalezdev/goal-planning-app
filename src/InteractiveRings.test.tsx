// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import App from './App'
import { createAlexDemo } from './data/fixtures/demoAlex'
import { GoalRings } from './features/home/GoalRings'
import { VisibilityContext, HOME_AREAS } from './ui/amountVisibility'
import { normalizeLayout, layoutToSave, setAllOpen } from './features/home/homeLayout'
import { memoryStorage } from './test/memoryStorage'
import { fire, freshDatabaseForEachTest, settle } from './test/space'
import { browserSpaceStore } from './app/useSpace'
import { monthIncome } from './domain/finance/income'
import { formatAmount } from './ui/format'
import { billsForMonth } from './domain/finance/bills'
import { BillCelebrationContext, createBillCelebrationChannel } from './app/writeStatus'

freshDatabaseForEachTest()
afterEach(() => cleanup())

it('selects all four areas without navigation, updates the center and opens the chosen area explicitly', () => {
  const open = vi.fn()
  const data = createAlexDemo()
  const { rerender } = render(<GoalRings data={data} month="2026-12" today="2026-12-31" asOf="2026-12-31" newId={() => 'x'} onChange={async () => 'saved'} onOpen={open} />)
  const group = screen.getByRole('radiogroup', { name: 'Select an area' })
  expect(within(group).getByRole('radio', { name: /^Select Bills/ }).getAttribute('aria-checked')).toBe('true')
  for (const [name, area] of [['Income', 'income'], ['Goals', 'goals'], ['Cards & Loans', 'debts'], ['Bills', 'bills']]) {
    fireEvent.click(within(group).getByRole('radio', { name: new RegExp(`^Select ${name}`) }))
    expect(document.querySelector('.rings-core')?.textContent).toContain(name)
    expect(open).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: `Open ${name}` }))
    expect(open).toHaveBeenLastCalledWith(area); open.mockClear()
  }
  rerender(<GoalRings data={data} month="2027-01" today="2026-12-31" asOf="2026-12-31" newId={() => 'x'} onChange={async () => 'saved'} onOpen={open} />)
  expect(within(group).getByRole('radio', { name: /^Select Bills/ }).getAttribute('aria-checked')).toBe('true')
  expect(document.querySelector('.rings-core')?.textContent).toContain('0 of')
})

it('removes monetary arcs and accessible percentages immediately when privacy changes; count arcs remain', () => {
  function Harness() {
    const [hidden, setHidden] = useState(false)
    return <VisibilityContext.Provider value={{ hidden: new Set(hidden ? HOME_AREAS : []), toggle: () => {}, setAll: () => {} }}>
      <button onClick={() => setHidden(!hidden)}>Toggle test privacy</button>
      <GoalRings data={createAlexDemo()} month="2026-12" today="2026-12-31" asOf="2026-12-31" newId={() => 'x'} onChange={async () => 'saved'} onOpen={() => {}} />
    </VisibilityContext.Provider>
  }
  render(<Harness />)
  fireEvent.click(screen.getByRole('radio', { name: /^Select Income/ }))
  expect(document.querySelector('.rings-band-income .rings-band-sweep')).toBeTruthy()
  fireEvent.click(screen.getByText('Toggle test privacy'))
  expect(document.querySelector('.rings-band-income .rings-band-sweep,.rings-band-goals .rings-band-sweep')).toBeNull()
  expect(document.querySelector('.rings-band-bills .rings-band-sweep')).toBeTruthy()
  expect(document.querySelector('.rings-band-debts .rings-band-sweep')).toBeTruthy()
  expect(screen.getByRole('radio', { name: 'Select Income, Amounts hidden' })).toBeTruthy()
  expect(document.querySelector('.rings-core')?.textContent).not.toMatch(/\d/)
  fireEvent.click(screen.getByRole('radio', { name: /^Select Goals/ }))
  expect(screen.getByRole('radio', { name: 'Select Goals, Amounts hidden' })).toBeTruthy()
  expect(document.querySelector('.rings-core')?.textContent).not.toMatch(/\d|%/)
  // The centre says progress is hidden (no number, no spoken amount); the live region says the same.
  expect(document.querySelector('.rings-core .four-pill')?.textContent).toBe('Amounts hidden')
  expect(document.querySelector('.four-stage [role="status"]')?.textContent).toContain('Amounts hidden')
  expect(document.querySelector('.four-stage [role="status"]')?.textContent).not.toMatch(/\d/)
  expect(document.querySelector('.rings-band-goals .rings-band-sweep')).toBeNull()
  fireEvent.click(screen.getByText('Toggle test privacy'))
  expect(screen.getByRole('radio', { name: /^Select Goals, \d+% saved/ })).toBeTruthy()
  expect(document.querySelector('.rings-band-goals .rings-band-sweep')).toBeTruthy()
  fireEvent.click(screen.getByText('Toggle test privacy'))
  fireEvent.click(screen.getByRole('radio', { name: /^Select Cards & Loans/ }))
  // Counts survive privacy; the centre counts up, so the final value is read from its name and pill.
  expect(screen.getByRole('radio', { name: /^Select Cards & Loans, 3 of 3 paid/ }).getAttribute('aria-checked')).toBe('true')
  expect(document.querySelector('.rings-core .four-pill')?.textContent).toBe('All paid')
  expect(document.querySelector('.rings-context')?.textContent).not.toMatch(/12.*266/)
})

it('validates the saved selection and preserves it through folding and layout normalization', () => {
  for (const area of ['income', 'bills', 'debts', 'goals'] as const) {
    const layout = normalizeLayout({ version: 2, ringSelection: area })
    expect(normalizeLayout(layoutToSave(setAllOpen(setAllOpen(layout, false), true)))).toMatchObject({ ringSelection: area })
  }
  expect(normalizeLayout({ version: 2, ringSelection: 'goal:private-id' }).ringSelection).toBeUndefined()
})

it('keeps the own selection and saved preferences byte for byte while using Demo and folding rings', async () => {
  const storage = memoryStorage()
  // Demo is the public invented fixture; it must never write the real layout.
  storage.setItem('goal-planning-app.home-rings', 'yes')
  storage.setItem('goal-planning-app.home-layout', '{"spaceId":"own","layout":{"version":2,"ringSelection":"income","order":[],"open":[]}}')
  const before = storage.getItem('goal-planning-app.home-layout')
  render(<App storage={storage} />); await settle()
  await fire.click(screen.getByRole('button', { name: 'Explore the App' }))
  await fire.click(screen.getByRole('radio', { name: /^Select Goals,/ }))
  await fire.click(screen.getByRole('button', { name: 'All areas' }))
  const body = document.querySelector('.home-rings-fold .block-body')!
  expect(body.hasAttribute('inert')).toBe(true)
  await fire.click(screen.getByRole('button', { name: /^All areas/ }))
  expect(screen.getByRole('radio', { name: /^Select Goals,/ }).getAttribute('aria-checked')).toBe('true')
  await fire.click(within(document.querySelector('.goal-rings') as HTMLElement).getByRole('button', { name: 'Open Goals' }))
  await fire.click(within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name: 'Home' }))
  expect(screen.getByRole('radio', { name: /^Select Goals,/ }).getAttribute('aria-checked')).toBe('true')
  expect(storage.getItem('goal-planning-app.home-layout')).toBe(before)
})

it('persists an own-space selection across remounts without changing financial records', async () => {
  const storage = memoryStorage(), store = browserSpaceStore(storage), data = createAlexDemo()
  await store.create(data)
  storage.setItem('goal-planning-app.home-rings', 'yes')
  const before = JSON.stringify(await store.load())
  render(<App storage={storage} getToday={() => '2026-12-31'} />); await settle()
  await fire.click(screen.getByRole('radio', { name: /^Select Income,/ }))
  expect(JSON.parse(storage.getItem('goal-planning-app.home-layout')!).layout.ringSelection).toBe('income')
  expect(JSON.stringify(await store.load())).toBe(before)
  cleanup()
  render(<App storage={storage} getToday={() => '2026-12-31'} />); await settle()
  expect(screen.getByRole('radio', { name: /^Select Income,/ }).getAttribute('aria-checked')).toBe('true')
})

it('describes absent forecasts, partial debt coverage and real versus counted savings', () => {
 const data=createAlexDemo(); data.incomeSources=[];
 data.debts.push({...data.debts[0],id:'no-link',monthlyPayment:undefined});
 data.goals=[{...data.goals[0],id:'a',kind:'goal',status:'active',target:100000,openingBalance:120000},{...data.goals[0],id:'b',kind:'goal',status:'active',target:100000,openingBalance:20000}]; data.goalMovements=[];
 render(<GoalRings data={data} month="2026-12" today="2026-12-31" asOf="2026-12-31" newId={()=>'x'} onChange={async ()=>'saved'} onOpen={()=>{}} />)
 fireEvent.click(screen.getByRole('radio',{name:/^Select Income/}));
 // No forecast: no share and no arc; the centre shows the received amount instead (see the dedicated test below).
 expect(document.querySelector('.rings-core')?.textContent).toContain('Received this month');
 expect(document.querySelector('.rings-context')?.textContent).toContain('No expected income set');
 expect(document.querySelector('.rings-band-income .rings-band-sweep')).toBeNull();
 fireEvent.click(screen.getByRole('radio',{name:/^Select Cards & Loans,.*tracked payments paid.*1 debt without a linked bill/}));
 // Centre: tracked payments with a Partial coverage pill; the exact number of unlinked debts stays in the context.
 expect(document.querySelector('.rings-core')?.textContent).toContain('tracked payments paid');
 expect(document.querySelector('.rings-core .four-pill')?.textContent).toBe('Partial coverage');
 expect(document.querySelector('.rings-context')?.textContent).toContain('Partial coverage: 1 debt without a linked bill; excluded from tracked payments.');
 fireEvent.click(screen.getByRole('radio',{name:'Select Goals, 60% saved'}));
 expect(document.querySelector('.rings-context')?.textContent?.replaceAll('\u00a0', ' ')).toContain('1400,00 zł saved');
 expect(document.querySelector('.rings-context')?.textContent?.replaceAll('\u00a0', ' ')).toContain('1200,00 zł of 2000,00 zł counted toward targets');
})


it('without a valid forecast shows the received amount in the centre, and hides it with Income privacy', () => {
  // Reduced motion: the centre's count shows its final value at once.
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), addEventListener() {}, removeEventListener() {} }))
  try {
    const data = createAlexDemo(); data.incomeSources = []
    const received = monthIncome(data, '2026-12').received
    expect(received).toBeGreaterThan(0)
    function Harness({ hidden }: { hidden: boolean }) {
      return <VisibilityContext.Provider value={{ hidden: new Set(hidden ? ['month' as const] : []), toggle: () => {}, setAll: () => {} }}>
        <GoalRings data={data} month="2026-12" today="2026-12-31" asOf="2026-12-31" newId={() => 'x'} onChange={async () => 'saved'} onOpen={() => {}} />
      </VisibilityContext.Provider>
    }
    const { rerender } = render(<Harness hidden={false} />)
    fireEvent.click(screen.getByRole('radio', { name: /^Select Income,/ }))
    const core = () => document.querySelector('.rings-core')!
    const plain = (value: string | null | undefined) => (value ?? '').replace(/\u00a0|\u202f/g, ' ')
    expect(plain(core().querySelector('.four-value')?.textContent)).toBe(plain(formatAmount(received, 'PLN')))
    expect(core().querySelector('.four-context')?.textContent).toBe('Received this month')
    expect(core().textContent).not.toMatch(/\d%/)
    expect(document.querySelector('.rings-band-income .rings-band-sweep')).toBeNull()
    expect(screen.getByRole('radio', { name: /^Select Income, No expected income set, .+ received this month/ })).toBeTruthy()
    // Income privacy: no amount, no share, nothing spoken; the other areas are unaffected.
    rerender(<Harness hidden />)
    expect(core().textContent).not.toMatch(/\d/)
    expect(core().querySelector('.four-pill')?.textContent).toBe('Amounts hidden')
    expect(screen.getByRole('radio', { name: 'Select Income, Amounts hidden' })).toBeTruthy()
    expect(document.querySelector('.four-stage [role="status"]')?.textContent).not.toMatch(/\d/)
    expect(document.querySelector('.rings-context')?.textContent).not.toMatch(/\d/)
    expect(document.querySelector('.rings-band-bills .rings-band-sweep')).toBeTruthy()
  } finally { vi.unstubAllGlobals() }
})

it('puts each name inside its section, selects through each section without navigating, and has no dart', () => {
 const open=vi.fn(),change=vi.fn(); render(<GoalRings data={createAlexDemo()} month="2026-12" today="2026-12-31" asOf="2026-12-31" newId={()=>'x'} onChange={change} onOpen={open}/>);
 const svg=document.querySelector('.four-stage > svg')!;
 expect(svg.getAttribute('aria-hidden')).toBe('true');
 // The centre names the selected area visibly, above its value.
 expect(document.querySelector('.four-core-content > .four-name')?.classList.contains('visually-hidden')).toBe(false);
 const names=['Income','Bills','Cards & Loans','Goals'], areas=['income','bills','debts','goals'];
 expect([...svg.querySelectorAll('.four-label-name')].map(x=>x.textContent)).toEqual(names);
 names.forEach((name,i)=>{
  const area=areas[i], label=svg.querySelector('[data-ring-label="'+area+'"]')!;
  // Inside its own section, with its short value under the name.
  expect(label.closest('.rings-band-'+area)).toBeTruthy();
  expect(label.closest('.four-label')?.querySelector('.four-label-value')?.textContent).toMatch(/^(\d+%|\d+\/\d+|—)$/);
  // The hit target is the section's own radio, outside the decorative vector.
  const hit=document.querySelector<HTMLElement>('[data-ring-hit="'+area+'"]')!;
  expect(svg.contains(hit)).toBe(false); expect(hit.getAttribute('role')).toBe('radio');
  fireEvent.click(hit);
  expect(screen.getByRole('radio',{name:new RegExp('^Select '+name)}).getAttribute('aria-checked')).toBe('true');
  expect(document.querySelector('.rings-band-'+area)?.classList.contains('is-selected')).toBe(true);
  expect(document.querySelector('.four-core .four-name')?.textContent).toBe(name);
 });
 expect(open).not.toHaveBeenCalled();expect(change).not.toHaveBeenCalled();
 // The fill ends at the month's share (9 of 10 bills paid in the demo's December).
 expect(document.querySelector('.rings-band-bills .rings-band-sweep')?.getAttribute('data-final-percent')).toBe('90');
 expect(document.querySelector('[class*="dart"],[data-dart]')).toBeNull();
})

it('clears Lens Press on pointer cancellation and suppresses a selection after vertical drag intent', () => {
 render(<GoalRings data={createAlexDemo()} month="2026-12" today="2026-12-31" asOf="2026-12-31" newId={()=>'x'} onChange={async()=>'saved'} onOpen={()=>{}}/>);
 const hit=document.querySelector('[data-ring-hit="income"]')!;
 const pressed=()=>document.querySelector('.rings-band-income')?.classList.contains('is-pressed');
 const bills=()=>screen.getByRole('radio',{name:/^Select Bills,/}).getAttribute('aria-checked');
 // jsdom lacks PointerEvent; a MouseEvent (button 0, with coordinates) still exercises React's pointer handlers.
 const pointer=(type:string,y=100)=>fireEvent(hit,new MouseEvent(type,{bubbles:true,clientX:100,clientY:y}));
 pointer('pointerdown');expect(pressed()).toBe(true);
 // More than 8 px: a scroll, not a tap. Releasing and the click that follows select nothing.
 pointer('pointermove',120);expect(pressed()).toBe(false);
 pointer('pointerup',120);fireEvent.click(hit,{detail:1});expect(bills()).toBe('true');
 pointer('pointerdown');pointer('pointercancel');expect(pressed()).toBe(false);expect(bills()).toBe('true');
 // Leaving the section cancels too (React derives pointerleave from pointerout).
 pointer('pointerdown');fireEvent(hit,new MouseEvent('pointerout',{bubbles:true,relatedTarget:document.body}));
 expect(pressed()).toBe(false);pointer('pointerup');expect(bills()).toBe('true');
 // A tap selects on release, exactly once.
 pointer('pointerdown');pointer('pointerup');fireEvent.click(hit,{detail:1});
 expect(screen.getByRole('radio',{name:/^Select Income,/}).getAttribute('aria-checked')).toBe('true');
})

it('moves with the cardinal arrows, keeps one tab stop, selects with Space and opens details with Enter', () => {
 const open=vi.fn(); render(<GoalRings data={createAlexDemo()} month="2026-12" today="2026-12-31" asOf="2026-12-31" newId={()=>'x'} onChange={async()=>'saved'} onOpen={open}/>);
 const group=screen.getByRole('radiogroup',{name:'Select an area'});
 const radio=(name:string)=>within(group).getByRole('radio',{name:new RegExp('^Select '+name+',')});
 for(const [key,name] of [['ArrowUp','Income'],['ArrowRight','Bills'],['ArrowDown','Cards & Loans'],['ArrowLeft','Goals']]){
  fireEvent.keyDown(document.activeElement===document.body?radio('Bills'):document.activeElement!,{key});
  expect(radio(name).getAttribute('aria-checked')).toBe('true');
  expect(document.activeElement).toBe(radio(name));
  expect(within(group).getAllByRole('radio').filter(item=>item.tabIndex===0)).toEqual([radio(name)]);
 }
 fireEvent.keyDown(radio('Goals'),{key:' '});expect(radio('Goals').getAttribute('aria-checked')).toBe('true');
 fireEvent.keyDown(radio('Goals'),{key:'Enter'});
 expect(screen.getByRole('heading',{name:'Goals'})).toBeTruthy();
 expect(open).not.toHaveBeenCalled();
})

describe('Pulse celebration on Four Sections', () => {
  function paidMonth() {
    const data = createAlexDemo()
    const paid = new Set(billsForMonth(data, '2026-12').filter(item => item.paid).map(item => item.bill.id))
    return { ...data, bills: data.bills.filter(bill => paid.has(bill.id)) }
  }
  function mountWithChannel(data = paidMonth()) {
    const channel = createBillCelebrationChannel()
    render(<BillCelebrationContext.Provider value={channel}>
      <GoalRings data={data} month="2026-12" today="2026-12-31" asOf="2026-12-31" newId={() => 'x'} onChange={async () => 'saved'} onOpen={() => {}} />
    </BillCelebrationContext.Provider>)
    return { channel, data }
  }
  const core = () => document.querySelector('.rings-core')!
  const status = () => document.querySelector('.four-stage [role="status"]')!

  it('with Reduce Motion shows the final state and announces it, with no movement and no dart', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), addEventListener() {}, removeEventListener() {} }))
    try {
      const { channel, data } = mountWithChannel()
      fireEvent.click(screen.getByRole('radio', { name: /^Select Income,/ }))
      let result
      act(() => { result = channel.publish({ month: '2026-12', spaceId: data.space.id }) })
      expect(result).toEqual({ claimed: true, shown: true })
      // Bills is selected for the celebration.
      expect(screen.getByRole('radio', { name: /^Select Bills,/ }).getAttribute('aria-checked')).toBe('true')
      expect(core().textContent).toContain('Bullseye!')
      expect(core().textContent).toContain('All paid')
      expect(core().textContent).toContain('Everything paid for December 2026')
      expect(status().textContent).toBe('Bullseye! All paid. Everything paid for December 2026.')
      expect(document.querySelector('.four-fx')).toBeNull()
      expect(document.querySelector('.four-stage')?.hasAttribute('data-celebrating')).toBe(false)
      expect(document.querySelector('[class*="dart"],[data-dart]')).toBeNull()
    } finally { vi.unstubAllGlobals() }
  })

  it('plays a wave from the centre (rings only, no dart) and stops when another section is chosen', () => {
    const { channel, data } = mountWithChannel()
    act(() => { channel.publish({ month: '2026-12', spaceId: data.space.id }) })
    const fx = document.querySelector('.four-fx')!
    expect(fx).toBeTruthy()
    expect(fx.getAttribute('aria-hidden')).toBe('true')
    expect([...fx.children].map(child => child.tagName.toLowerCase())).toEqual(['defs', 'circle', 'circle'])
    expect(fx.querySelector('path,line,polygon,polyline')).toBeNull()
    expect(document.querySelector('.four-stage')?.getAttribute('data-celebrating')).toBe('true')
    fireEvent.click(screen.getByRole('radio', { name: /^Select Goals,/ }))
    expect(document.querySelector('.four-fx')).toBeNull()
    expect(core().textContent).not.toContain('Bullseye!')
    expect(status().textContent).not.toContain('Bullseye!')
  })

  it('ignores a completion for another month or space, and an incomplete month', () => {
    const { channel, data } = mountWithChannel()
    act(() => {
      expect(channel.publish({ month: '2027-01', spaceId: data.space.id }).shown).toBe(false)
      expect(channel.publish({ month: '2026-12', spaceId: 'another-space' }).shown).toBe(false)
    })
    expect(core().textContent).not.toContain('Bullseye!')
    cleanup()
    const partly = mountWithChannel(createAlexDemo())
    act(() => { partly.channel.publish({ month: '2026-12', spaceId: partly.data.space.id }) })
    expect(document.querySelector('.four-fx')).toBeNull()
    expect(core().textContent).not.toContain('Bullseye!')
  })
})

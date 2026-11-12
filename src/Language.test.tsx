// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { browserSpaceStore } from './app/useSpace'
import { createSpaceData } from './domain/finance/space'
import type { FinanceData, Language } from './domain/finance/types'
import { setActiveLanguage } from './i18n'
import { memoryStorage } from './test/memoryStorage'
import { fire, freshDatabase, freshDatabaseForEachTest, settle, storedSpace } from './test/space'
import { refuseWrites } from './test/space'
import { addFromHome } from './test/homeControls'

/*
 * Phase B1: choosing the language. It applies at once without losing what
 * was typed or where the user is; the own space keeps it in its data; the
 * demo keeps its own in memory and never writes; English stays the default
 * and Spanish and Polish stay "coming soon" until Phase B6 (or the preview).
 */

freshDatabaseForEachTest()
afterEach(() => {
  cleanup(); vi.restoreAllMocks(); setActiveLanguage('en')
  document.documentElement.removeAttribute('data-theme')
  window.history.replaceState(null, '', '/')
})

const TODAY = '2026-10-21'
const button = (name: string | RegExp) => screen.getByRole('button', { name })
const languageList = () => screen.getByLabelText(/^(Language|Idioma|Język)$/) as HTMLSelectElement
const option = (value: Language) => languageList().querySelector<HTMLOptionElement>(`option[value="${value}"]`)!
const choose = (value: Language) => fire.change(languageList(), { target: { value } })
const tab = (name: string) => within(screen.getByRole('navigation', { name: /navigation|Navegación|Nawigacja/ })).getByRole('button', { name })

function space(language: Language = 'en'): FinanceData {
  const made = createSpaceData({ mode: 'individual', names: ['Robin'], currency: 'PLN', theme: 'light', language })
  if (made.status !== 'created') throw new Error('invalid setup')
  return made.data
}

async function openApp(storage: Storage = memoryStorage(), url = '/') {
  window.history.replaceState(null, '', url)
  render(<App getToday={() => TODAY} storage={storage} />)
  await settle()
  return storage
}

async function snapshot(storage: Storage) {
  const copies = await browserSpaceStore(storage).exportCopies()
  const local = Object.fromEntries(Array.from({ length: storage.length }, (_, i) => storage.key(i)!).map(key => [key, storage.getItem(key)]))
  return JSON.stringify({ copies, local })
}

describe('Language on Welcome', () => {
  it('starts in English; Spanish and Polish are listed as coming soon and cannot be chosen', async () => {
    await openApp()
    expect(document.documentElement.lang).toBe('en')
    expect(languageList().value).toBe('en')
    expect(screen.getAllByRole('combobox')).toHaveLength(1)
    expect(languageList().closest('header')).toBeTruthy()
    expect(languageList().closest('label')?.textContent).toContain('EN')
    expect(option('es').disabled).toBe(true)
    expect(option('es').textContent).toBe('Español (coming soon)')
    expect(option('pl').textContent).toBe('Polski (coming soon)')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Your goals, your way.')
  })

  it('with the preview, changes Welcome at once, is remembered on this device and survives a reload', async () => {
    const storage = await openApp(memoryStorage(), '/?languages=preview')
    await choose('es')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Tus metas, a tu manera.')
    expect(button('Crear cuenta')).toBeTruthy()
    expect(document.documentElement.lang).toBe('es')
    expect(storage.getItem('goal-planning-app.language')).toBe('es')
    cleanup()
    // Without the preview in the address, it is still on for this device, and the choice stays.
    await openApp(storage)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Tus metas, a tu manera.')
    expect(languageList().value).toBe('es')
    expect(option('pl').disabled).toBe(false)
  })

  it('a language already chosen stays usable even after the preview is turned off', async () => {
    const storage = memoryStorage()
    storage.setItem('goal-planning-app.language', 'pl')
    await openApp(storage, '/?languages=off')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Twoje cele, po Twojemu.')
    expect(option('pl').disabled).toBe(false)
    expect(option('es').disabled).toBe(true)
  })

  it.each([
    { language: 'es' as const, duo: false, create: 'Crear cuenta', without: /Continuar sin cuenta/, name: 'Nombre visible', next: /Continuar/, back: 'Atrás', finish: 'Crear mi espacio', currency: 'Moneda', appearance: 'Aspecto', partner: 'Nombre de la segunda persona' },
    { language: 'pl' as const, duo: true, create: 'Załóż konto', without: /Kontynuuj bez konta/, name: 'Wyświetlana nazwa', next: /Dalej/, back: 'Wstecz', finish: 'Utwórz moją przestrzeń', currency: 'Waluta', appearance: 'Wygląd', partner: 'Imię drugiej osoby' },
  ])('starts Setup in $language without another selector and preserves the draft through Back', async labels => {
    await openApp(memoryStorage(), '/?languages=preview')
    await choose(labels.language)
    await fire.click(button(labels.create))
    await fire.click(button(labels.without))
    expect(screen.queryByLabelText(/^(Language|Idioma|Język)$/)).toBeNull()
    await fire.change(screen.getByLabelText(labels.name), { target: { value: 'Robin' } })
    await fire.click(button(labels.next))
    if (labels.duo) {
      await fire.click(screen.getByRole('radio', { name: /Duo/ }))
      await fire.change(screen.getByLabelText(labels.partner), { target: { value: 'Sam' } })
    }
    await fire.click(button(labels.next))
    expect(screen.queryByLabelText(/^(Language|Idioma|Język)$/)).toBeNull()
    await fire.change(screen.getByLabelText(labels.currency), { target: { value: 'EUR' } })
    await fire.change(screen.getByLabelText(labels.appearance), { target: { value: 'dark' } })
    await fire.click(button(labels.back))
    if (labels.duo) expect((screen.getByLabelText(labels.partner) as HTMLInputElement).value).toBe('Sam')
    await fire.click(button(labels.back))
    expect((screen.getByLabelText(labels.name) as HTMLInputElement).value).toBe('Robin')
    await fire.click(button(labels.next))
    await fire.click(button(labels.next))
    expect((screen.getByLabelText(labels.currency) as HTMLSelectElement).value).toBe('EUR')
    expect((screen.getByLabelText(labels.appearance) as HTMLSelectElement).value).toBe('dark')
    await fire.click(button(labels.next))
    await fire.click(button(labels.finish))
    const saved = (await storedSpace())!.data
    expect(saved.preferences).toEqual({ language: labels.language, theme: 'dark', displayCurrency: 'EUR' })
    expect(saved.space.currency).toBe('EUR')
    expect(saved.space.mode).toBe(labels.duo ? 'duo' : 'individual')
    expect(saved.space.members.map(member => member.name)).toEqual(labels.duo ? ['Robin', 'Sam'] : ['Robin'])
    expect(document.querySelector('[data-screen="home"]')).toBeTruthy()
  })

  it('never offers a browser-language suggestion, including in preview', async () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['es-ES', 'en'])
    const storage = await openApp(memoryStorage(), '/?languages=preview')
    expect(document.documentElement.lang).toBe('en')
    expect(storage.getItem('goal-planning-app.language')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Use Español' })).toBeNull()
    expect(screen.queryByText(/Your browser prefers/)).toBeNull()
    expect(screen.getAllByRole('combobox')).toHaveLength(1)
  })
})

describe('Language in the own space', () => {
  it('opens in the space’s language, saves a change in the space, and keeps a draft typed before it', async () => {
    await browserSpaceStore(memoryStorage()).create(space('en'))
    await openApp(memoryStorage(), '/?languages=preview')
    await addFromHome('Add Goal')
    await fire.change(screen.getByLabelText('What are you saving for?'), { target: { value: 'Sailing trip' } })
    await fire.click(button('Settings'))
    const before = (await storedSpace())!.data
    await choose('es')
    const after = (await storedSpace())!.data
    expect(after).toEqual({ ...before, preferences: { ...before.preferences, language: 'es' } })
    expect(screen.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeTruthy()
    expect(screen.getAllByRole('status').map(status => status.textContent)).toContain('Idioma cambiado a Español.')
    expect((await storedSpace())?.data.preferences.language).toBe('es')
    // Back to the draft: what was typed is still there.
    await fire.click(button('Atrás'))
    expect((screen.getByLabelText('What are you saving for?') as HTMLInputElement).value).toBe('Sailing trip')
    // A reload opens in Spanish.
    cleanup()
    await openApp()
    expect(tab('Facturas')).toBeTruthy()
    expect(button('Añadir')).toBeTruthy()
  })

  it('formats the header month in the chosen language without changing the month', async () => {
    await browserSpaceStore(memoryStorage()).create(space('pl'))
    await openApp()
    expect(screen.getByRole('button', { name: 'Wybierz miesiąc: październik 2026' })).toBeTruthy()
  })

  it('names the five tabs in each language, with Portfel for Money in Polish, and they still lead to the same places', async () => {
    const names = { en: ['Home', 'Bills', 'Goals', 'Money', 'History'], es: ['Inicio', 'Facturas', 'Metas', 'Dinero', 'Historial'], pl: ['Start', 'Rachunki', 'Cele', 'Portfel', 'Historia'] }
    for (const language of ['en', 'es', 'pl'] as const) {
      freshDatabase()
      await browserSpaceStore(memoryStorage()).create(space(language))
      await openApp()
      const nav = screen.getByRole('navigation', { name: /navigation|Navegación|Nawigacja/ })
      expect(within(nav).getAllByRole('button').map(tab => tab.textContent)).toEqual(names[language])
      const destinations = ['home', 'bills', 'goals', 'money', 'history']
      for (const index of [1, 2, 3, 4, 0]) {
        await fire.click(tab(names[language][index]))
        expect(tab(names[language][index]).getAttribute('aria-current')).toBe('page')
        expect(document.querySelector('[data-screen="' + destinations[index] + '"]')).toBeTruthy()
      }
      cleanup()
    }
  })
})

describe('Language save failures', () => {
  it('keeps the old preference and financial data when a language save fails', async () => {
    await browserSpaceStore(memoryStorage()).create(space('en'))
    const storage = await openApp(memoryStorage(), '/?languages=preview')
    await fire.click(button('Settings'))
    const before = await snapshot(storage)
    refuseWrites()
    await choose('pl')
    expect(languageList().value).toBe('en')
    expect(document.documentElement.lang).toBe('en')
    expect(await snapshot(storage)).toBe(before)
    expect(screen.getByRole('alert').textContent).toBeTruthy()
  })
})

describe('Language in the demo', () => {
  it('starts in the language shown, keeps a change in memory, writes nothing and gives the own language back on exit', async () => {
    await browserSpaceStore(memoryStorage()).create(space('es'))
    const storage = await openApp(memoryStorage(), '/?languages=preview')
    const before = await snapshot(storage)

    await fire.click(button('Ajustes'))
    await fire.click(button('Explorar la demo'))
    expect(screen.getByRole('note').textContent).toContain('Datos inventados')
    await fire.click(button('Ajustes'))
    await choose('pl')
    expect(screen.getByRole('note').textContent).toContain('Dane fikcyjne')
    expect(await snapshot(storage)).toBe(before)

    await fire.click(within(screen.getByRole('note')).getByRole('button', { name: 'Zamknij demo' }))
    expect(tab('Facturas')).toBeTruthy()
    expect(await snapshot(storage)).toBe(before)
    expect((await storedSpace())?.data.preferences.language).toBe('es')
  })
})

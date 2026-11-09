// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { memoryStorage } from './test/memoryStorage'
import { fire, settle, storedData, freshDatabaseForEachTest } from './test/space'
import { chooseHomeOption } from './test/homeControls'

freshDatabaseForEachTest()
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals()})
const button=(name:string|RegExp)=>screen.getByRole('button',{name})
const tab=(name:string)=>within(screen.getByRole('navigation',{name:'Main navigation'})).getByRole('button',{name})
const ringsToggle=()=>screen.getByRole('region',{name:'All areas'}).querySelector<HTMLButtonElement>('.block-toggle')!
async function demo(){const storage=memoryStorage();storage.setItem('goal-planning-app.home-rings','yes');render(<App storage={storage}/>);await settle();await fire.click(button('Explore the App'));return storage}
async function own(storage:Storage){render(<App storage={storage}/>);await settle();await fire.click(button('Create Account'));await fire.click(button(/Continue Without an Account/));await fire.change(screen.getByLabelText('Display Name'),{target:{value:'Robin'}});for(let i=0;i<3;i++)await fire.click(button(/Continue/));await fire.click(button('Create My Space'))}

describe('UX-02.1 global header and independent Add row',()=>{
 it('places single utilities in the header and Add between Demo and the centered month strip on every tab',async()=>{
  await demo()
  for(const name of ['Home','Bills','Goals','Money','History']){
   await fire.click(tab(name))
   const header=document.querySelector('.shell-header')!,row=document.querySelector('.shell-action-row')!
   expect(screen.getAllByRole('button',{name:'Hide amounts'})).toHaveLength(1)
   expect(header.contains(button('Hide amounts'))).toBe(true)
   expect(header.contains(button('Settings'))).toBe(true)
   expect(row.contains(button('Add'))).toBe(true);expect(header.contains(button('Add'))).toBe(false)
   expect(screen.queryAllByRole('button',{name:'Home options'})).toHaveLength(name==='Home'?1:0)
   expect(screen.getByRole('note').compareDocumentPosition(row)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
   const wheel=document.querySelector('.month-carousel');if(wheel)expect(row.compareDocumentPosition(wheel)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  }
 })
 it('switches resolved System appearance to an explicit opposite choice, follows Settings, and keeps demo isolated',async()=>{
  const media=Object.assign(new EventTarget(),{matches:true})
  vi.stubGlobal('matchMedia',vi.fn((query:string)=>query==='(prefers-color-scheme: dark)'?media:Object.assign(new EventTarget(),{matches:false})))
  await demo();await fire.click(button('Switch to light mode'))
  expect(document.documentElement.dataset.theme).toBe('light')
  await fire.click(button('Settings'));expect((screen.getByRole('combobox',{name:'Appearance'}) as HTMLSelectElement).value).toBe('light')
  await fire.change(screen.getByRole('combobox',{name:'Appearance'}),{target:{value:'dark'}})
  expect(button('Switch to light mode')).toBeTruthy()
  await fire.click(button('Switch to light mode'));await fire.click(button('Switch to dark mode'))
  expect(document.documentElement.dataset.theme).toBe('dark')
  await fire.click(within(screen.getByRole('note')).getByRole('button',{name:'Exit Demo'}))
  expect(document.documentElement.dataset.theme).toBe('system')
  expect(await storedData()).toBeNull()
 })
 it('collapses the complete rings interior, restores it individually and preserves hidden-by-Settings separately',async()=>{
  const storage=await demo()
  await chooseHomeOption('Expand All');expect(ringsToggle().getAttribute('aria-expanded')).toBe('true')
  await chooseHomeOption('Collapse All');expect(ringsToggle().getAttribute('aria-expanded')).toBe('false')
  expect(screen.queryByRole('button',{name:/^Open Goals,/})).toBeNull()
  expect(document.querySelector('.home-rings-fold .block-body')?.hasAttribute('inert')).toBe(true)
  await fire.click(ringsToggle());expect(screen.getByRole('button',{name:/^Open Goals,/})).toBeTruthy()
  await chooseHomeOption('Customize Home');expect(screen.queryByRole('region',{name:'Your money and goals'})).toBeNull()
  await fire.click(button('Done'));expect(document.activeElement).toBe(button('Home options'))
  expect(ringsToggle().getAttribute('aria-expanded')).toBe('true')
  await fire.click(button('Settings'));await fire.click(screen.getByRole('checkbox',{name:/Show rings on Home/}));await fire.click(button('Back'))
  await chooseHomeOption('Expand All');expect(screen.queryByRole('region',{name:'All areas'})).toBeNull()
  expect(storage.getItem('goal-planning-app.home-rings')).toBe('no')
 })
 it('remembers own appearance, privacy and collapsed rings across reopening without demo preferences overwriting them',async()=>{
  const storage=memoryStorage();storage.setItem('goal-planning-app.home-rings','yes');await own(storage)
  expect(screen.queryByRole('note')).toBeNull();expect(document.querySelector('.shell-action-row')!.contains(button('Add'))).toBe(true)
  await fire.click(button('Switch to dark mode'));await fire.click(button('Hide amounts'));await chooseHomeOption('Collapse All')
  const data=await storedData();expect(data?.preferences.theme).toBe('dark')
  cleanup();render(<App storage={storage}/>);await settle()
  expect(document.documentElement.dataset.theme).toBe('dark');expect(button('Amounts hidden. Show amounts')).toBeTruthy();expect(ringsToggle().getAttribute('aria-expanded')).toBe('false')
  await fire.click(button('Settings'));await fire.click(button('Explore the Demo'))
  await fire.click(button('Switch to dark mode'));await chooseHomeOption('Expand All')
  await fire.click(within(screen.getByRole('note')).getByRole('button',{name:'Exit Demo'}));await fire.click(tab('Home'))
  expect(ringsToggle().getAttribute('aria-expanded')).toBe('false');expect(button('Amounts hidden. Show amounts')).toBeTruthy()
  expect(await storedData()).toEqual(data)
 })
})

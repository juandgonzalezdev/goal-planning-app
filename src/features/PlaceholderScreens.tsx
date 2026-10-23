import type { ReactNode } from 'react'
import { MyMoney } from '../MyMoney'

/** Cards & Loans, for now: the existing payoff calculator from My Money, until saved cards and loans arrive. */
export function CardsScreen() {
  return (
    <div className="tab-screen">
      <h1 className="tab-title">Cards &amp; Loans</h1>
      <p className="muted-note">Saved cards and loans come in a later version. Meanwhile, you can use the calculator below. It is not saved.</p>
      <MyMoney />
    </div>
  )
}

export function ComingLater({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="tab-screen">
      <h1 className="tab-title">{title}</h1>
      <div className="empty-block">{children}</div>
    </div>
  )
}

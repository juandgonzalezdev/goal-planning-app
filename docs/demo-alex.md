# Alex demo (Individual)

The public demo opens with **Alex**, an invented person. Every number on every
screen is computed from the records in `src/data/fixtures/demoAlex.ts`; nothing
is typed into a screen by hand. The demo date is fixed at **23 October 2026**,
so the October payment state always makes sense.

The demo is never saved. Changes last until the page is closed, **Reset Demo**
restores the example, and **Exit Demo** drops every change. The demo never
reads or writes the user's own space.

## Given values (from the brief)

| Record | Value |
| --- | --- |
| Net income | 6,500 PLN, received on day 1 |
| Rent | 4,000 · day 2 · Housing |
| Utilities | 700 · day 5 · Utilities |
| Transport | 200 · day 6 · Transport |
| Subscriptions | 80 · day 10 · Subscriptions |
| Small Loan payment | 320 · day 15 · Loans |
| Credit Card Payment | 200 · day 22 · Cards |
| Student Loan payment | 250 · day 25 · Loans |
| Bills total / difference | 5,750 / 750 ("Income minus Bills", never "savings") |
| Credit Card | Remaining balance 1,800, closing day 20, payment day 22 |
| Student Loan | 12,000, payment day 25 |
| Trip to Japan | Flexible, 600 of 10,000 (6%, 9,400 left) |
| Christmas Gift | With Date, 100 saved, deadline 24 Dec 2026 |
| Emergency Fund | 300 |

## Invented values (not in the brief)

| Record | Value | Why |
| --- | --- | --- |
| Small Loan balance | 3,600 (as of 15 Oct 2026), 9.90%, Nov 2025 – Oct 2027 | Fits 320/month for the remaining 12 months |
| Credit Card interest | 18.50% | A usual Polish card rate |
| Credit Card minimum payment | 90 (entered, no rule modelled) | Kept apart from the planned 200 |
| Student Loan | 2.00%, Oct 2024 – Dec 2030 | Low student-loan rate |
| Christmas Gift target | 400 | 100 saved → 25%, 300 left |
| Subscriptions note | Music 25, Video 40, Cloud Storage 15 | Adds up to 80 |
| Accounts | Everyday 820 · Investments 500 · Savings Account 1,200 · Piggy Bank 150 | |
| Savings | 1,350 = Japan 600 + Christmas 100 + Emergency 300 + 350 unassigned | No double counting |
| Payment state | Every October bill is paid on its due day except the Student Loan | Left to Pay on 23 Oct: 250 |

Totals: Total Debt 17,400 (1,800 + 12,000 + 3,600). Goals 700; with the
Emergency Fund 1,000.

## Rules the numbers follow

- Money is stored in grosze (integers); dates as `YYYY-MM-DD`.
- An unknown amount is shown as "Amount needed", never as 0, and "All paid" is
  never shown while an unpaid amount is unknown.
- Marking a bill paid never lowers a debt's balance; balances change only when
  a new balance is entered (the old one stays in history).
- A loan or card that has a linked bill is paid through that bill only, so
  the payment is counted once.
- New savings for a goal raises the savings account (and Savings) once;
  assigning savings already there changes no total; nothing can be taken out
  beyond what is saved or unassigned.
- Changing one month's bill amount touches that month only; changing the usual
  amount applies from a chosen month on.

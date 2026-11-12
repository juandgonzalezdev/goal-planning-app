# Goal Planning App — Product Vision & Design Principles

**Status:** Product direction approved by the project owner on 2026-11-10\
**Purpose:** Guiding reference for product design, development, reviews, and future integrations\
**Scope:** Vision and principles, not an implementation ticket or authorization to modify existing behavior

## 1. Mission

### Financial clarity for everyone.

We believe understanding your money shouldn't require financial expertise.

**Goal Planning App helps people organize their finances, understand their financial situation, and move toward meaningful goals through simple, accessible tools.** Whether people prefer to tap, type, or speak—in their own language and their own words—managing money should feel natural, not complicated.

**Core principle:** Technology should adapt to people, not people to technology.

## 2. The problem we solve

Many people want to understand their money, stay on top of obligations, and make progress toward goals, but don't have specialist financial knowledge or the time to maintain detailed expense ledgers.

Goal Planning App should deliver meaningful value **without requiring the user to log every purchase or transaction**. It should reduce administrative effort rather than become another obligation.

The product is not intended to be a conventional accounting tool or a mandatory transaction-by-transaction expense tracker.

## 3. Three user outcomes

1. **Understand:** Know what is happening with money through clear visual summaries and plain-language explanations.
2. **Stay organized:** Know what needs paying, what is due, what has been completed, and what requires attention.
3. **Move forward:** Plan realistic goals, record contributions, and understand progress over time.

Every prominent feature should contribute to at least one outcome while minimizing user effort.

## 4. Product pillars

### 4.1 Ring-first Experience — UX-04

- The **four-section interactive ring** becomes the primary Home experience and the visual navigation hub.
- Preserve the approved ring's four sections: **Income**, **Bills**, **Cards & Loans**, **Goals**.
- Select a section to reveal one relevant contextual area with clear status, next action, and a path to details.
- Prefer **select → review → confirm** over long navigation chains and repeated forms.
- Keep full detail/editing screens available; do not hide necessary complexity behind ambiguous gestures.
- Design mobile-first, with enough simplicity to inform a future smartwatch experience. A native watch app is **not** an approved near-term build.
- Avoid clutter, excessive menus, unexplained icons, hover-only controls, and inaccessible touch targets.
- Use simple, natural wording in the application UI in English (default), Spanish and Polish; written development discussions may be in Spanish.

### 4.2 Natural Interaction

- Offer meaningful actions through touch and keyboard now; design them for future voice and conversational entry points.
- Users should be able to express intentions in everyday language, including regional expressions and different languages, without memorizing strict commands.
- Examples: “I received my salary,” “I've paid the internet bill,” “Add a bill,” and “How much is left to pay?”
- Reuse existing, verified facts and ask only for missing or ambiguous information.
- Voice is an **optional future interface**, not a dependency for basic functionality.

### 4.3 Open AI Integration — UX-05 (future)

- Envision a documented, secure action/API layer for authorized integrations with third-party assistants such as ChatGPT and Claude, as well as an in-app voice agent.
- Maintain provider independence: a user should not need one specific assistant to use Goal Planning App.
- Separate natural-language interpretation from financial operations. Agents may request a **read** or **prepare** action; the application owns permissions, validation, confirmation, and persistence.
- Investigate appropriate integration standards and native assistant capabilities when implementation begins; no API, Siri support, or multi-device sync is implied to exist today.
- Roll out progressively: **read-only queries → prepared actions with explicit confirmation → optional voice / wearable interactions**.

### 4.4 Privacy, User Control & Accessibility

- Financial information belongs under the user's control. Access to it must be explicitly authorized, limited in scope, and revocable.
- A publicly documented API must **never** mean publicly accessible financial data.
- Do not send financial records to an external AI provider without meaningful user permission and a clear explanation of what is shared.
- Respect hidden-amount/privacy controls across the ring, contextual cards, messages, and future spoken responses.
- Support keyboard and screen reader access and reduced-motion preferences; never make understanding depend on animation, color alone, or voice alone.
- Keep the core experience useful without requiring a paid AI subscription.

## 5. Design principles for every feature

1. **Clarity before complexity.** Explain what a number means; avoid jargon and unnecessary financial terminology.
2. **Progressive disclosure.** Show the current status and next useful action first; provide detail and editing on demand.
3. **Minimize data entry.** Reuse saved bill templates, recurring obligations, accounts, dates, and other verified defaults rather than asking users to type them repeatedly.
4. **User intent first.** Build around “I was paid,” “I paid a bill,” and “I want to save,” rather than internal data structures.
5. **Be accurate about uncertainty.** Without complete transaction tracking or authorized account connections, the app must not claim to know exact available cash, every expense, or an exhaustive financial picture.
6. **Show meaningful progress.** Use the ring and clear language to highlight completed obligations and movement toward goals, without misleading celebrations.
7. **Confirm consequential changes.** Users must be able to review and correct key financial fields before an irreversible or consequential record change.
8. **One source of financial truth.** Home, Bills, Money, Goals, History, and future agent tools must share the same domain rules—not duplicate calculations.
9. **Inclusive by default.** Plain language, accessible interaction, device flexibility, and language choice are foundational, not luxury extras.
10. **Preserve trust.** Never imply data was saved before storage succeeds; prevent duplicate actions and handle failures transparently.

## 6. Ring-first: approved target interaction

**Target flow:** Select a ring sector → see concise contextual information → take a relevant quick action → review/confirm if needed → see progress update in place.

Examples:

- **Bills:** See pending obligations, choose one, review actual payment amount/date/account, confirm, and update the ring without forced navigation.
- **Income:** See received income and record a received salary with minimal required fields.
- **Cards & Loans:** See debt/payment progress without conflating paying a bill with reducing principal when the data does not support that assumption.
- **Goals:** See progress and add a contribution, using the established **Contribution** terminology.

Detailed pages remain available for setup, correction, history, and complex workflows.

### Bills completion state — approved UX refinement UX-03-H2

- If bills remain: display **Left to pay** and the relevant amount.
- If all registered bills for the selected month are paid: display **All bills paid!**, **Nothing left to pay this month.**, the paid/total count, and **Paid this month**.
- **Do not** display a redundant “Left to pay: 0.00” line in the all-paid state.
- If no bills are registered for the month: display **No bills this month**; this is not the same as all bills paid.
- Hide amounts when privacy is enabled, while preserving meaningful non-sensitive status information.
- Keep the list of paid bills available for consultation.
- This refinement has been approved for future implementation; do not describe it as already shipped.

### Existing celebration rule — UX-03

Maintain the previously approved **Bullseye / minimalist Pulse** behavior for completion of the last bill in a month. It should not become a requirement to visit a different page to understand a completed payment. Avoid auto-navigating users from Bills to Home. Preserve once-per-month-per-device and reduced-motion behavior as previously specified. Existing animation timing/visibility and further manual checks remain subject to UX-03 validation.

## 7. Future AI / voice payment safety contract

**Canonical flow:** Interpret request → identify the intended bill → resolve ambiguity → prepare the operation → present essential details → explicitly confirm → validate and persist once → report success/failure → update the ring.

- Confirmation may be by a clear screen action or a spoken phrase such as **“Yes, confirm the payment.”**
- Accept a spoken “yes” only when an unambiguous, active, recent confirmation request is pending and essential fields have already been presented.
- Essential fields include the matched bill, period, actual amount, payment date, and account when applicable. Offer correction before saving.
- If multiple bills match, dates or amounts are unclear, or the bill is already paid, **do not guess**; ask, warn, or stop as appropriate.
- Defend against duplicated commands, repeated model tool calls, retries, and partial failures.
- Do not bypass the existing application's finance rules or storage safeguards.
- Do not report **“Payment recorded!”** unless the committed operation succeeds.
- Spoken responses must respect permission and context, including the risk of disclosing private amounts in public spaces.
- AI-generated explanations should distinguish observed facts, projections, and incomplete information.

## 8. Data and technical constraints

- The current app is a local-first web application with privacy controls, a demo using invented data, and established financial rules. Do **not** assume it has cloud synchronization or an exposed financial API.
- Preserve **demo isolation**: simulations must never change real user records or preferences.
- Preserve existing backup/restore formats and financial models unless a separately approved migration is designed and tested.
- Future external assistant access would require an explicit identity, permissions, secure availability/synchronization strategy, and operational safeguards. These are **architecture questions**, not permission to implement cloud infrastructure now.
- The ring is a user experience and visual representation, not a second accounting engine.

## 9. Roadmap and decision status

| Stage | Status | Intent |
|---|---|---|
| UX-03: Four-section ring + Bullseye | Implemented and merged into main. Automated checks passed. Manual acceptance remains partially incomplete. | Finish Chrome/iPhone checks, visibility/animation review, and UX-03-H2 refinement before release decisions. |
| UX-04: Ring-first Experience | **Product direction approved; design phase** | Design and evaluate contextual workflows, beginning with Bills, before issuing implementation tasks. |
| Shared financial action layer | **Architectural direction approved; implementation not approved** | Make verified operations reusable across UI and future interfaces, without changing their semantics. |
| UX-05: AI Connected Experience | **Future product direction approved** | Plan provider-independent, permissioned read and prepared-action integrations. |
| Siri / smartwatch / voice agent / synchronization | **Future exploration** | Validate feasibility and user experience separately before committing development. |

**Not authorized by this document:** immediate code changes, a new backend, publishing an API, deployment, commits, merges, migrations, or third-party data sharing.

## 10. Acceptance questions for product reviews

Before approving a significant feature, ask:

- Does it make it easier to **understand**, **stay organized**, or **move forward**?
- Can a person with no finance background understand the wording and next step?
- Can the everyday task be completed without unnecessary navigation or retyping?
- Does it work on mobile and have an accessible non-voice alternative?
- Are the numbers accurate, and are estimates/unknowns clearly identified?
- Are confirmations, privacy controls, and failure states understandable?
- Does it reuse existing domain behavior and preserve data/demo safety?
- Does it keep the application genuinely useful without AI?

If a feature fails these tests, simplify or reconsider it.

## 11. Working agreement for contributors and AI coding assistants

- Treat this document as **product direction**, not as a blanket implementation instruction.
- Preserve the approved UX-03 ring behavior while exploring UX-04; do not replace approved interactions without a reviewed proposal.
- Distinguish **approved vision**, **approved but unimplemented refinements**, **future explorations**, and **verified shipped functionality** in all reports.
- For changes, provide a scoped proposal, affected files, risk assessment, and relevant tests; respect the project's established review and git workflow.
- Do not claim browser/device testing, acceptance, or deployment without actual evidence.

---

**Project maxim:** *Technology should adapt to people, not people to technology.*

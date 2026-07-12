# S80 — Card-shell unification (design)

Re-planned Wave 3, second slice (roadmap revision 2026-07-12; audit C25 + U2-structural
+ Sentry rider + CLS target from the 2026-07-12 Lighthouse baseline). Full tier.

## Decisions

### D1 — `DetailCardShell` (C25 + U2-structural)

One shared shell owns what all 12 federal/state detail cards hand-roll today:

```tsx
DetailCardShell({
  title: string,            // renders the h2 (accessibilityRole="header" level 2 + aria-level)
  isLoading: boolean,       // any unconditional card query still loading
  isError?: boolean,        // U2: any card query errored — DISTINCT from empty
  onRetry?: () => void,     // U2: retry affordance on the error branch
  isEmpty: boolean,         // all loaded, nothing to show
  emptyText: string,
  children: ReactNode,      // data branch
  testID?: string,
})
```

- **Branch precedence: error > loading > empty > data.** Error wins over loading so a
  refetch spinner never masks a real failure.
- **U2 error branch**: muted "Couldn't load this section." + a Retry pressable calling
  `onRetry` (each card passes a refetch-all closure over its hooks). Error ≠ empty —
  today every card renders its empty state on query failure, which reads as "this
  official has no data" when the truth is "the request failed."
- **Bg scheme locked: shell = `bg.elevated`, rows = `bg.app`** (the federal scheme).
  Rationale: 7 of 12 cards already use it (6 federal + StateIssuePositions), and
  cards-as-elevated-surfaces is the established design language (slice 43's
  CATEGORY_CARD_BG chose elevation-above-page). The 5 state cards change subtly in
  dark mode — that IS the drift fix; the audit verifier confirmed the split was
  migration drift, not a Gotcha #15 intentional asymmetry.
- **S79 hydration constraint**: the shell branches on the hooks' `isLoading`, which is
  `false` on first web render when the page dehydrated the query — the shell must
  never gate on `isFetching`, and no loading-first flash may appear on hydrated pages.
- Slice-57 heading contract preserved: the shell emits the ONLY h2 per card; in-card
  sub-headings stay h3 in card bodies; CardSubsection toggles stay buttons.
- Composition (which subsections/cards exist per tier) is untouched — Gotcha #15
  governs DATA asymmetries and stays.

### D2 — `EventRowList<T>` generic (C25)

```tsx
EventRowList<T>({
  rows: T[],
  keyOf: (row: T) => string,
  urlOf: (row: T) => string | null,   // slice-57 B6 null-guard built in ONCE:
                                      // url ? smart row Pressable/anchor : plain View
  titleOf: (row: T) => string,
  metaOf: (row: T) => Array<string | null>,  // muted meta lines; nulls skipped
})
```

Adopted by the 4 near-identical pairs (town halls ×2, district offices ×2) with the
duplicated `FORMAT_LABEL` map hoisted next to it. Other sub-lists (votes, bills,
donors, holdings…) keep their bespoke row bodies — only row-shaped event/office lists
migrate in this slice; forcing the generic onto structurally different lists is scope
creep.

### D3 — Sentry rider (from S70's follow-up list)

- `apps/web/app/global-error.tsx`: 'use client', renders its own `<html><body>`
  (global-error replaces the root layout), `Sentry.captureException(error)` in a mount
  effect, minimal brand-neutral retry UI. Closes the SDK's standing build warning —
  React render errors in the root layout currently never reach Sentry.
- SDK deprecations: `sentry.client.config.ts` → `instrumentation-client.ts`;
  `disableLogger` → its non-deprecated equivalent per the installed SDK's docs.
- `BrandTextInput` `autoComplete as never` survivor (S78 leftover): typed web/native
  branch instead of the cast.

### D4 — CLS < 0.1 on `/sign-in` (Lighthouse baseline finding)

The full 0.382 shift is ONE element: the auth screen's outer centered container
(`body > div.css-175oi2r`, the cream `WEB_VIEWPORT_FILL` view). Task = local repro
against a production build (`next build && next start` + Lighthouse), identify why the
container shifts (candidates: Inter swap resizing the centered card, hydration
re-layout of the RNW container, AuthPageChrome mount), fix, re-measure live after
merge. Acceptance: local prod-build CLS < 0.1 on /sign-in.

### D5 — Deferred out of this slice (recorded)

- **C6-remainder** (RNW `<Text>` primitive threading Inter everywhere): the revision
  pre-authorized this as first-overboard; the CLS task touches the font path only if
  the font IS the culprit.
- **C27-remainder** (officials-ui subpath `exports` map): packaging churn with its own
  test-resolution risks; keep the README-documented deep-import convention. Revisit if
  a third deep-import consumer appears.
- **Federal detail-page cascade sharing** (audit C25's optional add-on): web/mobile
  federal composition duplication is real but orthogonal to the shell; candidate S86.

## Verification contract

- All 12 cards render through DetailCardShell; grep proves 0 remaining hand-rolled
  h2-title card shells outside the shell file (the 36 duplicated title sites collapse
  to card bodies only).
- Per-card tests keep passing with mocks unchanged where behavior didn't change;
  NEW cases: error branch renders + retry fires (per shell, plus one migrated card
  proving the wiring), empty-vs-error distinction, heading level preserved (h2 via
  shell), bg scheme asserted once in the shell test.
- officials-ui suite green; web + mobile detail-page tests green; full battery +
  build; local Lighthouse CLS number in the PR body.

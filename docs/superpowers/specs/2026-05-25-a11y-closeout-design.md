# Slice 25 — A11y closeout (ComingSoonCard + BioHeader + RN types augmentation) design

**Status:** approved 2026-05-25 (verbal — brainstorming flow)
**Builds on:** Slice 14 (a11y batch + Gotcha #22 + deferred BioHeader landmark), slice 24 (RNW 0.19 audit + ComingSoonCard `accessibilityLevel` follow-up #1).

## Goal

Close 3 outstanding a11y follow-ups in one compressed slice:

1. **RN types augmentation** — add `accessibilityLevel?: number` to RN's `AccessibilityProps` via TypeScript module augmentation. Unblocks the slice 24 ComingSoonCard fix + any future a11y work that needs RNW-supported-but-RN-types-missing props.
2. **ComingSoonCard `accessibilityLevel` fix** — slice 24 audit follow-up #1. ComingSoonCard uses `accessibilityRole="header"` without `accessibilityLevel`, so screen readers treat the heading as h1-level. Fix to h3 (appropriate for sub-card heading).
3. **BioHeader `<section>` landmark restoration** — slice 14 deferred this. Outer View currently uses `accessibilityLabel` (→ `aria-label` on `<div>`, no landmark role); restore real `<section aria-label="...">` via `createElement` escape hatch on web.

After this slice: 0 deferred a11y follow-ups remain in the carried-forward list.

## Non-goals

- **No further RNW audit work.** Slice 24 audit confirmed `accessibilityValue` + `accessibilityHint` have 0 callsites; slice 25 doesn't add usage. Future audit work (annual cadence) re-runs the audit.
- **No new components.** Existing ComingSoonCard + BioHeader behavior preserved; only a11y attributes change.
- **No schema work.**
- **No new workspace deps.**
- **No types augmentation for `accessibilityHint`.** Slice 24 confirmed RNW 0.19 silently drops it (no createDOMProps translation). Augmenting RN types wouldn't fix the runtime gap. Future slice could add a Platform-aware `aria-describedby` wrapper if hint UX surfaces; out of slice 25 scope.
- **No web build smoke for landmark-role screen-reader behavior.** Automated test asserts DOM attribute presence; actual screen-reader announcement testing requires manual NVDA/VoiceOver verification (operator follow-up).

## Architecture

```
Task 1: RN types augmentation ──────────────────────────────────────────
  packages/officials-ui/src/types/react-native-augment.d.ts          NEW

Task 2: ComingSoonCard accessibilityLevel ──────────────────────────────
  packages/officials-ui/src/cards/ComingSoonCard.tsx                 MODIFY
  packages/officials-ui/test/cards/ComingSoonCard.test.tsx           MODIFY (verify path)

Task 3: BioHeader <section> landmark ───────────────────────────────────
  packages/officials-ui/src/bio/BioHeader.tsx                        MODIFY
  packages/officials-ui/test/bio/BioHeader.test.tsx                  MODIFY

Task 4: Closure ────────────────────────────────────────────────────────
  CLAUDE.md                                                           slice 25 entry
  memory file + MEMORY.md                                             (outside repo)
```

### File count

- **Created (2):** `react-native-augment.d.ts` + memory file (outside repo)
- **Modified (~5):** ComingSoonCard.tsx + test + BioHeader.tsx + test + CLAUDE.md
- **Total touched: ~7 files** — Compressed-Slice tier.

## Components

### Task 1: RN types augmentation

**File:** `packages/officials-ui/src/types/react-native-augment.d.ts`

```ts
/**
 * Module augmentation for `react-native` AccessibilityProps.
 *
 * RNW 0.19's createDOMProps supports several a11y props that aren't
 * declared in RN's TypeScript definitions (`react-native/Libraries/
 * Components/View/ViewAccessibility.d.ts`). This file adds the gaps
 * so workspace code can use the runtime-correct RNW-supported props
 * without `as any` casts or createElement escape hatches.
 *
 * Slice 25 origin — slice 24 audit follow-up #1.
 *
 * Augmented props:
 * - accessibilityLevel: number — pairs with accessibilityRole="header"
 *   to produce <div role="heading" aria-level="N"> on web. RNW
 *   createDOMProps supports (line ~92-93, ~447-450) but RN types omit.
 *
 * Future augmentations land here as additional fields. If RN upstream
 * adds these to AccessibilityProps in a future version, this
 * augmentation becomes a no-op (still type-valid).
 */
declare module 'react-native' {
  interface AccessibilityProps {
    accessibilityLevel?: number
  }
}

export {}
```

**Discovery:** Verify `packages/officials-ui/tsconfig.json` `include` path picks up `src/**/*.d.ts` (it should via `src/**/*` glob — confirm at scaffold).

**Test the augmentation in Task 2** by attempting ComingSoonCard fix; if it passes typecheck, augmentation is wired correctly.

### Task 2: ComingSoonCard accessibilityLevel fix

**File:** `packages/officials-ui/src/cards/ComingSoonCard.tsx`

Current code at line 35 (per slice 24 audit):
```ts
<Text accessibilityRole="header">{title}</Text>
```

Slice 25 fix:
```ts
<Text accessibilityRole="header" accessibilityLevel={3}>{title}</Text>
```

**Level choice:** 3 is appropriate for a sub-card heading. Page hierarchy (per slice 14):
- h1: official's name (BioHeader main heading)
- h2: card-section header (e.g. "Voting & Bills")
- h3: sub-card / coming-soon heading (this fix)

**Test addition** (`packages/officials-ui/test/cards/ComingSoonCard.test.tsx`):
```ts
it('renders heading with aria-level="3" on web', () => {
  const { container } = render(<ComingSoonCard title="Test" body="body" />)
  const heading = container.querySelector('[role="heading"]')
  expect(heading?.getAttribute('aria-level')).toBe('3')
})
```

Mirror of slice 14 Gotcha #22 direct-DOM-attribute pattern.

### Task 3: BioHeader `<section>` landmark restoration

**File:** `packages/officials-ui/src/bio/BioHeader.tsx`

Slice 14 outer View pattern (current):
```tsx
<View style={...} accessibilityLabel={`${fullName} bio`}>
  {/* ... */}
</View>
```

→ Renders as `<div aria-label="X bio">` on web. Screen readers announce label but don't see a landmark.

Slice 25 escape hatch (similar to AlignmentChip slice 14):
```tsx
const content = (
  <View style={...}>
    {/* ... */}
  </View>
)

if (Platform.OS === 'web') {
  return createElement(
    'section',
    {
      'aria-label': `${fullName} bio`,
      style: { /* preserve outer-View styles applied to the section element */ },
    },
    content,
  )
}

return (
  <View style={...} accessibilityLabel={`${fullName} bio`}>
    {/* ... */}
  </View>
)
```

**Style preservation:** Native side keeps the existing `<View style={...}>`. Web side splits the View's outer styles onto the `<section>` element (avoid double-styled wrapper). Verify the resulting layout matches pre-slice-25 visual rendering via web build smoke + manual inspection at scaffold.

**Test addition** (`packages/officials-ui/test/bio/BioHeader.test.tsx`):
```ts
it('renders <section> landmark with aria-label on web', () => {
  const { container } = render(<BioHeader {...defaultProps} />)
  const section = container.querySelector('section')
  expect(section).toBeTruthy()
  expect(section?.getAttribute('aria-label')).toMatch(/Jane Doe bio/)
})

it('preserves accessibilityLabel on the rendered element', () => {
  // Existing slice 14 test that asserts aria-label on outer wrapper.
  // After slice 25, the element is <section> not <div>; assertion updates.
  const { container } = render(<BioHeader {...defaultProps} />)
  const wrapper = container.querySelector('section') ?? container.querySelector('div')
  expect(wrapper?.getAttribute('aria-label')).toMatch(/Jane Doe bio/)
})
```

Update existing slice 14 a11y-label test if it asserts on `<div>` specifically.

### Task 4: Closure

Standard slice closure (slice 14-24 precedent).

## Data flow

No runtime behavior change beyond DOM attribute additions / element-type swap on web. Native behavior unchanged.

## Error handling

N/A — no new code paths.

## Testing strategy

- 2-4 new vitest cases (1-2 per fix) asserting DOM attribute presence + element type via jsdom + testing-library.
- Existing slice 14 BioHeader a11y test updated if it specifically asserts `<div>` wrapper.
- ComingSoonCard existing 4 tests stay passing unchanged (visual rendering unaffected).
- Test count: 256 → ~258-260 in officials-ui.

## Verify gate

- `pnpm -r typecheck` → 11 packages green (validates the types augmentation in Task 1)
- `pnpm --filter @chiaro/officials-ui exec vitest run` → ~260 tests green
- `pnpm --filter @chiaro/db exec vitest run` → 784 tests (unchanged)
- `pnpm --filter @chiaro/web build` → 12 routes green (validates `<section>` element doesn't break SSR)

## Risk + tradeoffs

1. **Types augmentation might conflict if RN upstream adds `accessibilityLevel`** to `AccessibilityProps` in a future version. Augmentation becomes a no-op (still type-valid). Low risk; documented in JSDoc.

2. **BioHeader DOM swap from `<div>` to `<section>`** may affect any CSS that targets `[aria-label="X bio"]` selectors. RNW uses inline `style` props, not CSS selectors, so should be unaffected. Verify via web build smoke + visual inspection during scaffold.

3. **Slice 14 BioHeader test may need updating** if it asserts on `<div>` element specifically. Slice 25 Task 3 includes a test refactor if needed.

4. **`accessibilityLevel` value of 3 is opinionated.** Page hierarchy assumes h1 = BioHeader, h2 = card-section, h3 = sub-card. If the actual page structure differs, level may need adjustment. Spec-time choice; implementer verifies at scaffold by reading surrounding component context.

5. **No automated screen-reader testing.** vitest + jsdom asserts DOM attributes but can't simulate actual screen-reader announcement. Operator follow-up: manual NVDA / VoiceOver verification.

6. **Types augmentation file location.** `packages/officials-ui/src/types/react-native-augment.d.ts` chosen because officials-ui is the only consumer. If apps/web or apps/mobile need to use `accessibilityLevel` directly, hoist to a shared types package in a future slice.

7. **Compressed-Slice tier.** ~7 files. Each task ~2 files. Subagent-driven execution is reasonable; inline execution also works.

## Schema verification needed during planning

None. All changes are component-level or types-only.

## Cross-references

- Slice 14 (a11y batch — Gotcha #22 origin + deferred BioHeader landmark + AlignmentChip createElement('a') escape hatch precedent)
- Slice 18 M6 (`accessibilityRole="link"` smart-anchor pattern; same createElement escape hatch family)
- Slice 24 audit (`docs/superpowers/audits/2026-05-25-rnw-a11y-gap-audit.md`) — origin of ComingSoonCard follow-up #1 + RNW createDOMProps reference
- Memory: [[project-chiaro-slice14-a11y-batch]] (Gotcha #19e + #22 + createElement escape hatch family), [[project-chiaro-slice24-ballotpedia-and-rnw-a11y]] (audit follow-up #1)

# Slice 14 — A11y batch (web semantic-HTML restoration)

**Date:** 2026-05-24
**Scope tier:** Compressed slice (~9 files; 3 a11y restorations across 3 components)
**Predecessor slices:** 10 (RN-primitive port that introduced these regressions), 11 (deprecation pattern reference), 13 (CardSubsection a11y precedent).

## Goal

Restore 3 web semantic-HTML behaviors lost during slice 10's RN-primitive port: real `<a href>` semantics on `AlignmentChip`, ARIA `aria-expanded` on `TopAmountBreakdown` toggle, and section-landmark `aria-label` on `BioHeader`. All from slice 10 code-review follow-ups.

## Motivation

Slice 10 converted ~57 web + mobile components to React Native primitives (`<View>`, `<Text>`, `<Pressable>`) via React Native Web. The conversion was mechanical and preserved most semantic information, but 3 a11y/UX behaviors degraded:

1. **`AlignmentChip` lost real `<a href>` semantics.** Pre-slice-10 web wrapped the chip in `next/link` `<Link href>` (rendering `<a href>`). Post-slice-10 uses `<Pressable accessibilityRole="link" onPress>`. RNW renders this as `<div role="link">`, which:
   - Disables middle-click → "Open in new tab"
   - Disables right-click → "Open in new tab/window/background tab" menu
   - Disables link prefetch (`<a>` is the only element browsers prefetch)
   - Disables status-bar URL preview on hover
   - Disables copy-link-address right-click action
   - Breaks browser history "type to find a previously visited link"
   - Power users frequently middle-click links to triage in batch; this is broken on every alignment chip.

2. **`TopAmountBreakdown` toggle lost `aria-expanded`.** Pre-slice-10 web had `<button aria-expanded={expanded}>`. Post-slice-10 RN `<Pressable accessibilityRole="button">` without `accessibilityState`. Screen readers don't announce whether the donor list is collapsed or expanded.

3. **`BioHeader` lost section landmark `aria-label`.** Pre-slice-10 web wrapped the bio in `<section aria-label={`${fullName} bio`}>`. Post-slice-10 `<View>` has no `accessibilityLabel`. Screen-reader landmark navigation can't jump to the bio region.

All 3 were flagged as "Important" in slice 10 code review and deferred to the follow-up list. Slice 14 closes them.

## Key design decisions

1. **AlignmentChip uses smart-anchor pattern** (chosen over `next/link` shim or pure-`<a>`-with-full-reload). Real `<a href>` alone forces full-page reload, defeating SPA navigation; bare `Pressable + onPress` loses every browser link affordance. The smart-anchor pattern — render `<a href>` for semantics, intercept plain left-click with `e.preventDefault() + onPress()` for client-side nav, let modifier-key clicks fall through — is the standard web compromise. Implemented via `createElement('a', ...)` mirroring the RNW escape-hatch precedent from MetricCardShell's gradient wrapper (Gotcha #19f).

2. **Dual-API on AlignmentChip: `href` AND `onPress` together.** Consumers pass both, encoding the same destination. The redundancy is the cost of supporting both web (`<a href>` for semantics + `onPress` for client-side nav) and native (`onPress` only). Acceptable trade-off; tested.

3. **`accessibilityState={{ expanded }}` for ARIA `aria-expanded`.** Same pattern as slice 13's `CardSubsection`. Use on any `Pressable` that toggles a disclosure region.

4. **`accessibilityLabel` on outer `View` (not converting to a real `<section>` via createElement).** RNW maps to `aria-label` on the rendered `<div>`. Restoring a true `<section>` landmark would require another `createElement` escape hatch + would impact other state cards that also use bare `<View>` containers — defer unless future a11y testing surfaces a concrete need.

5. **Trivials first commit order.** Ship F (TopAmountBreakdown) + G (BioHeader) before E (AlignmentChip dual-API) — validates the baseline pass against trivial changes before the riskier `createElement` smart-anchor work lands.

## Architecture

### Item E — AlignmentChip dual-API

**File:** `packages/officials-ui/src/cards/AlignmentChip.tsx`

```tsx
import { createElement } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'
import { type AlignmentTier, ALIGNMENT_CHIP_COLORS } from '@chiaro/ui-tokens'

export interface AlignmentChipProps {
  label: string
  tier: AlignmentTier
  /** Web: rendered as `href` on a real `<a>`. Native: ignored. */
  href?: string
  /** Click handler; smart-anchor on web with `href`, direct on native. */
  onPress?: () => void
}

export function AlignmentChip({ label, tier, href, onPress }: AlignmentChipProps): React.JSX.Element {
  const { bg, fg } = ALIGNMENT_CHIP_COLORS[tier]
  const chipStyle = {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: bg,
    alignSelf: 'flex-start' as const,
  }
  const textStyle = {
    fontSize: 12,
    fontWeight: '500' as const,
    color: fg,
    lineHeight: 17,
  }

  // Inert: no nav target, no handler.
  if (!href && !onPress) {
    return (
      <View style={chipStyle}>
        <Text style={textStyle}>{label}</Text>
      </View>
    )
  }

  // Web smart-anchor: real <a href> with intercepted plain left-click.
  if (Platform.OS === 'web' && href) {
    return createElement(
      'a',
      {
        href,
        onClick: (e: MouseEvent) => {
          // Honor modifier-key + middle-click → browser default (new tab etc.).
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return
          if (onPress) {
            e.preventDefault()
            onPress()
          }
          // If onPress is absent, default browser nav (full page load) handles it.
        },
        'aria-label': `View ${label} positions`,
        style: {
          ...chipStyle,
          display: 'inline-block',
          textDecoration: 'none',
          cursor: 'pointer',
        },
      },
      createElement('span', { style: textStyle }, label),
    )
  }

  // Native fallback (and web fallback when href is absent).
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={`View ${label} positions`}
      style={chipStyle}
    >
      <Text style={textStyle}>{label}</Text>
    </Pressable>
  )
}
```

### Item F — TopAmountBreakdown aria-expanded

**File:** `packages/officials-ui/src/finance/TopAmountBreakdown.tsx` (line ~97-100)

```diff
       {showToggle ? (
         <Pressable
           onPress={() => setExpanded(v => !v)}
           accessibilityRole="button"
+          accessibilityState={{ expanded }}
+          accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} top ${noun.plural}`}
           style={{ /* ... */ }}
         >
```

### Item G — BioHeader section landmark

**File:** `packages/officials-ui/src/bio/BioHeader.tsx` (line 32)

```diff
   return (
-    <View style={{ paddingVertical: 24, paddingHorizontal: 16, alignItems: 'center', gap: 12 }}>
+    <View
+      accessibilityLabel={`${p.fullName} bio`}
+      style={{ paddingVertical: 24, paddingHorizontal: 16, alignItems: 'center', gap: 12 }}
+    >
```

### Consumer updates

**`packages/officials-ui/src/OfficialsCard.tsx`** — pass href alongside onPress for chips in OfficialRow:

```diff
                 {chips.map((c) => (
                   <AlignmentChip
                     key={c.issueArea}
                     label={c.displayLabel}
                     tier={c.tier}
+                    href={`/officials/${o.id}?issue=${c.subCascadeSlug}`}
                     onPress={() => onSelect({ officialId: o.id, subCascadeSlug: c.subCascadeSlug })}
                   />
                 ))}
```

The implementer verifies the actual web URL format (could be `#issue-positions:slug` per slice 10 BioHeaderClient pattern; check before editing).

**`packages/officials-ui/src/bio/BioAlignmentChipRow.tsx`** — verify whether consumers pass href via `onChipPress` callback or if the row constructs the URL internally. If the row constructs the URL: pass `href` to AlignmentChip directly. If consumers handle URL construction: pass through via a new optional `chipHref?: (chip) => string` prop.

The implementer reads the file before making the call. Defer to "if applicable" rather than mandate — depending on the row's current shape, the change may be 0 lines (consumer-side) or ~3 lines (row-side).

## Files

**Modify (~9 files):**
- `packages/officials-ui/src/cards/AlignmentChip.tsx`
- `packages/officials-ui/test/cards/AlignmentChip.test.tsx` (5 new test cases)
- `packages/officials-ui/src/finance/TopAmountBreakdown.tsx`
- `packages/officials-ui/test/finance/TopAmountBreakdown.test.tsx` (1 new test case)
- `packages/officials-ui/src/bio/BioHeader.tsx`
- `packages/officials-ui/test/bio/BioHeader.test.tsx` (1 new test case)
- `packages/officials-ui/src/OfficialsCard.tsx`
- `packages/officials-ui/src/bio/BioAlignmentChipRow.tsx` (conditional — implementer verifies)
- `CLAUDE.md` (slice 14 entry; no new Gotcha)

## Commit sequence

4 commits on `slice-14-a11y-batch`:

1. **`feat(officials-ui): BioHeader accessibilityLabel section landmark`** (Item G, trivial first)
2. **`feat(officials-ui): TopAmountBreakdown aria-expanded on toggle`** (Item F, second trivial)
3. **`feat(officials-ui): AlignmentChip dual-API with smart anchor (web a11y restoration)`** (Item E, riskiest last; includes consumer updates)
4. **`docs: slice 14 closure — CLAUDE.md entry + memory`**

Squash-merge to master per established slice-handoff pattern.

## Acceptance criteria

1. `pnpm --filter @chiaro/officials-ui typecheck` green
2. `pnpm --filter @chiaro/officials-ui test` green — test count up by ~7 (5 AlignmentChip + 1 TopAmountBreakdown + 1 BioHeader)
3. `pnpm --filter @chiaro/web typecheck && pnpm --filter @chiaro/web build` green
4. `pnpm --filter @chiaro/mobile typecheck` green
5. Manual web smoke at `/officials/[id]`: right-click an alignment chip → "Open in new tab" works; status bar shows URL on hover; cmd-click opens in background tab; plain left-click does client-side nav (no full-page reload visible in DevTools Network tab)
6. Manual web smoke: open finance section, toggle "Show 5 more donors" → DevTools accessibility tree shows `aria-expanded` flipping
7. Manual web smoke: navigate to `/officials/[id]` → DevTools accessibility tree shows `aria-label="<name> bio"` on the bio section
8. CLAUDE.md slice 14 entry added; no new Gotcha

## Non-goals

- Converting BioHeader's outer `<View>` to a true `<section>` via createElement (defer until a11y testing surfaces a concrete landmark-role need)
- Smart-anchor pattern on other chip-like components (DistrictBadge, ScorecardLean) — none use href today; defer
- Consumer-side analytics/logging hooks on chip onPress (out of scope; covered by existing onSelect callback semantics)
- next/link integration in the shared package (incompatible with React Native; smart-anchor pattern is the correct cross-platform compromise)
- Mobile chip nav improvements (mobile already has the correct `<Pressable>` semantics; this slice is web-only)

## Risks & mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| `createElement('a', ...)` typing issues in TS strict mode | Medium | Inline type the options object as plain Record; precedent set by MetricCardShell gradient pattern (slice 10) |
| Click handler `e.preventDefault()` interferes with non-anchor Pressable elsewhere | Low | Smart-anchor and Pressable paths are mutually exclusive via Platform.OS + href branch; no cross-interference |
| Consumer href vs onPress URL format drift | Low | Consumers compute their own URLs; chip is opaque to format. Document the expected pattern in closure memory. |
| Modifier-key detection misses an edge case (e.g., auxiliary mouse buttons) | Low | Covered: metaKey, ctrlKey, shiftKey, button=1 (middle-click). Right-click (button=2) bypasses onClick entirely so doesn't need explicit handling. |
| Existing AlignmentChip tests need to be updated to wrap-with-RNW-Platform | Low | RNW vitest already aliases `react-native` → `react-native-web`; tests already render via jsdom which sets `Platform.OS = 'web'`. No setup change needed. |
| `aria-label` on `<View>` doesn't render as expected on web | Low | RNW translation `accessibilityLabel` → `aria-label` is documented + matches slice 10 Gotcha #19e. Test asserts the attribute on the DOM. |

## Cross-references

- Slice 10 spec (`docs/superpowers/specs/2026-05-22-officials-ui-package-design.md`) — original RN-primitive port that introduced these regressions
- Slice 10 closure (CLAUDE.md Gotcha #19f) — RNW escape-hatch pattern via `createElement('div', ...)` is the precedent for the smart-anchor `createElement('a', ...)` approach
- Slice 13 cleanup (`docs/superpowers/specs/2026-05-24-stock-cleanup-design.md`) — CardSubsection a11y additions (accessibilityRole + accessibilityState + accessibilityLabel) set the pattern for items F + G

## Open questions

None. All 4 design sections approved during brainstorming. Implementer may flag if BioAlignmentChipRow's chip URL construction doesn't fit the dual-API pattern; that's a port-time decision documented as a known incomplete detail in the plan.

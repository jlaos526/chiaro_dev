# Slice 50 — Slice 48 polish carryover

**Date:** 2026-05-31
**Branch:** `slice-50-polish-carryover`
**Tier:** Patch (3 files)

## Goal

Address 3 trivial mechanical items from the slice 48 final-review minor list. No visual decisions, no behavior changes.

## Scope (3 items)

| # | File | Change |
|---|---|---|
| 1 | `packages/officials-ui/test/nav/BrandDrawerContent.test.tsx` | Add 1 test case asserting Sign out press invokes `signOut` helper + `navigation.closeDrawer()` |
| 2 | `packages/officials-ui/src/nav/BrandNavRailBody.tsx` | Add `accessibilityLabel="Sign out"` to the Sign out Pressable (line 70) |
| 3 | `apps/mobile/app/(app)/index.tsx` | Replace `: null` loading branch with `: <BrandPageScreen><BrandBodyText muted>Loading…</BrandBodyText></BrandPageScreen>` placeholder |

## Out of scope (deferred items)

- **Item 2** (BackButton platform chevron) — requires icon library / SVG asset decision; deferred
- **Item 5** (BrandDrawer scrim `rgba(0,0,0,0.4)`) — requires `semantic.scrim` token introduction; deferred (intentional scrim opacity, not a brand color — comment vs token tradeoff)
- **Item 6** (BrandTextInput `required` prop) — slice 47 final-review carryover; requires component API change; deferred
- **Item 7** (BrandAlert SEVERITY_BANDS) — slice 45 final-review minor #4; defensible as-is per slice 45 lock; deferred

## Test deltas

- officials-ui: 564 → 565 (+1 sign-out invocation test in BrandDrawerContent)
- mobile: unchanged at 11 (no test infrastructure for the home loading branch)

## Risks

None. All 3 are additive (test, a11y label, loading placeholder). No behavior regressions possible.

## Approach decisions

- **Item 1 test pattern:** `fireEvent.click(await findByText('Sign out'))` + `await waitFor(() => expect(fakeClient.auth.signOut).toHaveBeenCalled())` + sync `expect(props.navigation.closeDrawer).toHaveBeenCalled()`. The waitFor accommodates the `void signOut(router, client)` fire-and-forget pattern in BrandDrawerContent (signOut is async but called sync).
- **Item 2 a11y label:** Identical text to visible content. Adds resilience if future refactor splits the visible text across nodes. Matches slice 45/47 convention on other action buttons.
- **Item 3 loading placeholder:** Reuses the same BrandPageScreen shell so the Drawer header chrome stays consistent during the profile fetch. Mirrors the slice 47/48 `/settings/address` bootstrap pattern.

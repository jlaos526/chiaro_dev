# Slice 51 — Deferred polish (4 items)

**Date:** 2026-05-31
**Branch:** `slice-51-deferred-polish`
**Tier:** Compressed Slice (~12 files)

## Goal

Close 4 deferred polish items from earlier slices' final reviews. Visual decisions for items 1 + 4 made via visual companion (slice 51 brainstorm); items 2 + 3 mechanical.

## Items + locked decisions

| # | Item | Decision | Tier impact |
|---|---|---|---|
| 1 | BackButton glyph | **A** — react-native-svg chevron (single visual web + iOS + Android) | Patch |
| 2 | BrandDrawer scrim token | Introduce `semantic.scrim` — light `rgba(0,0,0,0.4)`, dark `rgba(0,0,0,0.55)` | Patch |
| 3 | BrandTextInput `required` prop | Add optional prop; web passes HTML `required` attribute; native passes `aria-required` (ornamental) | Patch |
| 4 | BrandAlert SEVERITY_BANDS | **A** — keep current map, add JSDoc comment explaining why band stays constant + titleLight uses darker variants | Doc-only |

## Files touched (12)

```
packages/ui-tokens/src/brand/
  palette.ts                # MODIFY — add scrim to light + dark blocks
  semantic.ts               # MODIFY — add scrim to buildSemantic
packages/officials-ui/src/
  nav/BackButton.tsx        # REWRITE — Unicode `←` → SVG Polyline chevron
  nav/BrandDrawer.tsx       # MODIFY — overlayColor consumes semantic.scrim
  inputs/BrandTextInput.tsx # MODIFY — add required? prop; threads to native + web
  primitives/BrandAlert.tsx # MODIFY — SEVERITY_BANDS JSDoc rationale comment
packages/officials-ui/test/
  stubs/react-native-svg.tsx        # MODIFY — add Polyline stub for BackButton SVG
  nav/BackButton.test.tsx           # MODIFY — Unicode `←` selector → SVG polyline assertion
  nav/BrandDrawerContent.test.tsx   # MODIFY — typecheck fix for fakeClient.auth access
apps/web/app/
  profile/edit/page.tsx     # MODIFY — pass `required` to BrandTextInput x2
  settings/address/page.tsx # MODIFY — pass `required` to BrandTextInput
apps/mobile/app/(app)/
  profile/edit.tsx          # MODIFY — pass required x2
  settings/address.tsx      # MODIFY — pass required
```

## Test deltas

- ui-tokens: 165 unchanged (scrim addition; no parity test added because scrim isn't a domain palette key like the other tokens that domain-palette-dark.test.ts checks)
- officials-ui: 565 unchanged (BackButton 3 → 3 cases; only changed the glyph selector)
- web: 61 unchanged
- mobile: 11 unchanged
- pgTAP unchanged at 428

## Visual decisions made via brainstorm companion

- Item 1 (BackButton): 3 options previewed — SVG chevron-left (A, locked), platform-branched (B), Unicode status-quo (C). User picked A — single visual on both platforms, lighter maintenance burden.
- Item 4 (SEVERITY_BANDS): 3 options previewed — keep current (A, locked), derive from semantic.alert.fg (B), hybrid (C). User picked A — confirms slice 45 lock; adds comment so future readers understand why.

## Risks confirmed during execution

- **R1 react-native-svg jest stub** — pre-existing stub from slice 46 only exported Svg + Path. Extended to add Polyline. Render path uses real `<polyline>` DOM element for selector assertions.
- **R2 BrandTextInput `required`** — web path passes `required: required ?? false` directly to `<input>` (createElement escape hatch already used). Native path passes `aria-required={required ?? false}` — ornamental since RN TextInput doesn't surface a native "please fill in" tooltip equivalent.
- **R3 scrim dark opacity** — chose `rgba(0,0,0,0.55)` for dark (heavier than light's 0.4) since dark card bg `#1e2126` is already low-luminance and needs more separation from the dimmed page.
- **R4 BrandDrawer test** — existing test asserts `overlayColor === 'rgba(0,0,0,0.4)'` literal; still passes because semantic.scrim.light resolves to that exact string. Test continues to validate intent.
- **R5 BrandDrawerContent test typecheck (carryover)** — slice 50's added sign-out test had `fakeClient.auth.signOut` which fails typecheck under `as never` cast. Fixed with inline type narrow `(fakeClient as { auth: { signOut: ReturnType<typeof vi.fn> } }).auth.signOut`.

## Manual smoke

- Web `/profile/edit` + `/settings/address` — verify browser tooltip appears on unfocused-blank submit
- Mobile EAS build (pending) — verify chevron renders in iOS + Android headers; aria-required is no-op (ornamental as documented)
- Dark mode toggle — verify drawer scrim shifts from `rgba(0,0,0,0.4)` to `rgba(0,0,0,0.55)` opacity
- Mobile drawer open with item navigation — verify scrim tap still closes drawer (no behavior change)

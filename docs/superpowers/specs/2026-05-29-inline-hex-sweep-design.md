# Slice 46 — Inline-hex sweep (audit F4)

**Status:** Approved 2026-05-29
**Tier:** Compressed-to-Mega Slice (~13 files)
**Branch:** `slice-46-inline-hex-sweep`

---

## 1. Goal

Migrate the 8 remaining inline hex literals inside `packages/officials-ui/src/` to brand tokens. Add a new `semantic.icon.location` token to support the mode-aware DistrictBadge map-pin migration (P9 from brainstorm: `#e74c3c` light / `#f08074` dark).

Closes slice 44 audit finding **F4** (9 inline hex literals; the 9th — `AuthForm.tsx` — already migrated in slice 45 task 9). After slice 46, `@chiaro/officials-ui/src/` has zero inline hex literals except `BioPortrait` (mode-aware portrait gradient, intentionally hex-string-based per slice 40).

## 2. Non-goals

- **No F1/F2 page rewrites.** Slices 47-48 use the slice 45 primitives to rewrite the un-migrated pages; slice 46 stays narrowly scoped to inline-hex cleanup.
- **No F3 BrandStack nav theming.** Tracked separately for slice 48.
- **No new primitives.** Slice 45 shipped the foundational primitives; slice 46 just retunes existing consumer files.
- **No reskin philosophy changes.** All 7 migrations preserve current visual intent (PillChevron stays neutral pill, EvidenceExpand stays warm-beige border, DistrictBadge stays red pin, Logo native fallback stays brand orange).
- **No `BioPortrait` change.** Its hex string is the portrait gradient input (`semantic.portrait.gradient.from/to`), intentionally string-typed for the `linear-gradient(...)` CSS function.
- **No new `BrandPrimaryButton` / `BrandHeading` consumer migration** in `Logo.tsx` etc. Those primitives are for new page composition (slices 47-48), not for retrofitting existing internals.

## 3. User stories

**As a user toggling dark mode**, the PillChevron pill background visibly repaints from cream-tinted slate to cool slate (currently the chevron pill is light-cream-only and looks out of place against the slice 40 dark page bg). EvidenceExpand's dashed border also repaints. DistrictBadge's map pin shifts to a brighter coral so it's visible against cool slate. Logo stays brand orange in both modes (deliberate brand-identity invariant).

**As a developer auditing the codebase for inline hex residues**, `grep -rn "#[0-9a-fA-F]{6}" packages/officials-ui/src/` returns zero matches in component sources — only BioPortrait's gradient string remains (semantically not an inline hex per CLAUDE.md code style).

## 4. Locked decisions

All decisions finalized 2026-05-29 across 1 visual companion screen (12 pin-fill options) + 1 direct migration plan walkthrough.

### 4.1 New `semantic.icon.location` token

NEW namespace + key in `BRAND_PALETTE.{light,dark}`:

```ts
// In BRAND_PALETTE.light:
icon: {
  location: '#e74c3c',  // Saturated signal red — DistrictBadge map-pin
},

// In BRAND_PALETTE.dark:
icon: {
  location: '#f08074',  // Brighter coral for cool-slate page bg legibility
},
```

Wired through `BRAND_SEMANTIC.icon.location`:

```ts
// In buildSemantic:
icon: {
  location: p.icon.location,
},
```

New namespace deliberately small (1 key). Future location-related icons (e.g., a map-pin-with-direction variant) can extend the namespace; non-location icons should NOT colonize this namespace.

### 4.2 8 hex literal migrations

| File:line | Old hex | New consumption | Mode behavior |
|---|---|---|---|
| `cards/PillChevron.tsx:16` | `#f0eee5` | `semantic.bg.subtle` | mode-aware: `#f7efe2` light / `#1c1e2270` dark (alpha) |
| `cards/PillChevron.tsx:21` | `#1a1714` | `semantic.text.primary` | mode-aware: `#1a1714` light / `#fdf8f3` dark |
| `Logo.tsx:136` | `#e8a060` | `BRAND_PALETTE.light.accent[400]` direct import | mode-invariant — Logo is brand identity, not theme |
| `cards/EvidenceExpand.tsx:25` | `#d8d4c9` | `semantic.border.default` | mode-aware: `#e8d8c2` light / `#2a2d33` dark |
| `cards/EvidenceExpand.tsx:34` | `#1a1714` | `semantic.text.primary` | mode-aware |
| `cards/EvidenceExpand.tsx:51` | `#1a1714` | `semantic.text.primary` | mode-aware |
| `cards/DistrictBadge.tsx:49` | `#d13b3b` | `semantic.icon.location` (NEW per §4.1) | mode-aware: `#e74c3c` light / `#f08074` dark |
| `cards/DistrictBadge.tsx:52` | `#3a352b` | `semantic.text.body` | mode-aware: `#3a322c` light / `#e8d8c2` dark |

**Visual deltas (intentional):**
- PillChevron bg light: `#f0eee5` → `#f7efe2` — slightly warmer cream (off by ~7 units). Imperceptible.
- PillChevron bg dark: was light-invariant `#f0eee5` → now cool slate alpha `#1c1e2270`. **Major dark-mode improvement**.
- EvidenceExpand borderTopColor light: `#d8d4c9` → `#e8d8c2` — slightly lighter beige. Imperceptible.
- EvidenceExpand borderTopColor dark: was light-invariant → cool slate `#2a2d33`. **Major dark-mode improvement**.
- DistrictBadge pin light: `#d13b3b` → `#e74c3c` — slightly brighter / more saturated red. Subtle pop.
- DistrictBadge pin dark: was light-invariant `#d13b3b` → bright coral `#f08074`. **Major dark-mode improvement**.
- DistrictBadge text light: `#3a352b` → `#3a322c` — off by 3 units green channel. Imperceptible.
- DistrictBadge text dark: was light-invariant → cream `#e8d8c2`. **Major dark-mode improvement**.

5 of the 8 sites had NO dark variant before — they rendered the same color regardless of mode. After slice 46, all 8 are mode-aware (except Logo's native-fallback which is intentionally brand-identity-invariant).

### 4.3 Logo native fallback policy

`Logo.tsx:136` currently uses `'#e8a060'` (`BRAND_PALETTE.light.accent[400]`) as the front-square native fallback when no SVG gradient available. After slice 46, it consumes the token directly via `import { BRAND_PALETTE } from '@chiaro/ui-tokens'` and reads `BRAND_PALETTE.light.accent[400]`. Mode-invariant: Logo IS the brand identity, never repaints by theme. Same pattern as the Logo's existing border color (`LOGO_FILLS.borderColor` which is also light-mode hex).

## 5. Architecture / file plan

**~13 files. Compressed-to-Mega Slice tier.**

### 5.1 New token wiring (4)

1. **`packages/ui-tokens/src/brand/palette.ts`** — add `icon: { location: '...' }` blocks to both `BRAND_PALETTE.light` and `BRAND_PALETTE.dark`.

2. **`packages/ui-tokens/src/brand/semantic.ts`** — add `icon: { location: p.icon.location }` block to `buildSemantic`.

3. **`packages/ui-tokens/test/brand-palette.test.ts`** — add 2 new it-cases (`exports icon.location (light)` + `exports icon.location (dark)`) asserting the locked hex values.

4. **`packages/ui-tokens/test/brand-semantic.test.ts`** — add 2 new it-cases asserting BRAND_SEMANTIC pipes the values through correctly (light + dark).

### 5.2 Consumer migrations (4)

5. **`packages/officials-ui/src/cards/PillChevron.tsx`** — replace 2 inline hex literals with `useBrandTokens()` consumption. Drop static StyleSheet entirely; component becomes mode-aware via `semantic.bg.subtle` + `semantic.text.primary`. Adds `'use client'` directive at top if not present (mandatory for `useBrandTokens` consumers).

6. **`packages/officials-ui/src/Logo.tsx`** — replace inline `'#e8a060'` with direct `BRAND_PALETTE.light.accent[400]` import. No `useBrandTokens` needed (Logo is mode-invariant).

7. **`packages/officials-ui/src/cards/EvidenceExpand.tsx`** — replace 3 inline hex literals with `useBrandTokens()` consumption. Adds `'use client'` if not present.

8. **`packages/officials-ui/src/cards/DistrictBadge.tsx`** — replace 2 inline hex literals with `useBrandTokens()` consumption — fill via `semantic.icon.location` (new token from §4.1) + text via `semantic.text.body`. Adds `'use client'` if not present.

### 5.3 Consumer tests (3 additive, 0 churn)

9. **`packages/officials-ui/test/cards/PillChevron.test.tsx`** — append 1 new it-case asserting `bg uses semantic.bg.subtle rgb in light mode` (mode-aware sanity check). Existing 3 tests untouched (behavior-only).

10. **`packages/officials-ui/test/cards/EvidenceExpand.test.tsx`** — append 1 new it-case asserting `borderTopColor uses semantic.border.default rgb in light mode`. Existing 4 tests untouched.

11. **`packages/officials-ui/test/cards/DistrictBadge.test.tsx`** — append 1 new it-case asserting `pin fill uses semantic.icon.location rgb in light mode` (verifies new token cascade). Existing 6 tests untouched.

Logo test (`packages/officials-ui/test/Logo.test.tsx`) needs NO update — the existing tests verify structural behavior (square + brackets + accessibility), not internal hex values. The `BRAND_PALETTE.light.accent[400]` consumption is internal.

### 5.4 Docs (2)

12. **`docs/brand-migration.md`** — append slice 46 entry covering new `semantic.icon.location` token + 7 hex migrations.

13. **`CLAUDE.md`** — append slice 46 entry in "Slices delivered" section.

(`brand-book.md` could get an updated alert-palette §13 mention of the icon namespace but that's optional polish; defer if file count tightens.)

### 5.5 Closeout

14. **`docs/superpowers/mobile-dod-checklist.md`** — slice 46 section with ~5 verification checkboxes.

(Total: ~14 files including closeout. Spec headline rounds to ~13 since `brand-book.md` is optional.)

## 6. Cross-platform

- All 4 consumer migrations use `useBrandTokens()` on both web and native paths. RNW handles `useColorScheme()` integration; native uses Appearance API. No platform-specific code paths added.
- Logo native-fallback path stays single-color hex (brand identity invariant).
- PillChevron `semantic.bg.subtle` is `#1c1e2270` in dark mode (with alpha). RNW renders alpha through to `rgba(...)`; native RN handles 8-digit hex strings natively. Pre-flight verified.

## 7. Risks

1. **PillChevron + EvidenceExpand bg subtle change in light mode.** The slight color shifts (`#f0eee5` → `#f7efe2`, `#d8d4c9` → `#e8d8c2`) are within the "off by 7 units" threshold — visually imperceptible. Acceptable as documented in §4.2.

2. **DistrictBadge pin red shift in light mode.** `#d13b3b` → `#e74c3c` is a more saturated brighter red. Visible delta on the 12×14px pin icon. Intentional per user pick (P9 = saturated signal red).

3. **New `semantic.icon` namespace bootstrapping.** First key in a new namespace ("icon"). Future location-related icons can extend; non-location icons should NOT colonize. JSDoc on the palette block + brand-migration entry document this constraint.

4. **`'use client'` directives.** The 3 mode-aware consumer migrations (PillChevron, EvidenceExpand, DistrictBadge) need `'use client'` at the top of the file for Next.js 15 RSC compatibility. Verify each file's existing directive state during Task implementation.

5. **Existing tests for the 4 source files don't pin hex.** Pre-flight verified — all 13 existing tests (3+4+6+0 in Logo) test behavior (rendered glyph, text, ordinal labels), not styles. No test churn expected. The 3 new it-cases (Tasks 9-11) are additive.

6. **Logo `BRAND_PALETTE` direct import.** Logo already imports from `@chiaro/ui-tokens` for `LOGO_FILLS` + `logoGeometry`. Adding `BRAND_PALETTE` to the import statement is a 1-line change. No circular dependency risk.

## 8. Testing

- **TDD per consumer task.** Write new it-case first → run RED → implement migration → run GREEN → commit.
- **Token Tasks 1-2 follow same TDD.**
- **`pnpm --filter @chiaro/ui-tokens test`** — should grow from 163 to ~167 (+4 new icon.location tests across palette + semantic).
- **`pnpm --filter @chiaro/officials-ui test`** — should grow from 492 to ~495 (+3 new mode-aware it-cases in PillChevron + EvidenceExpand + DistrictBadge).
- **`pnpm -r typecheck`** — must pass.
- **`pnpm --filter @chiaro/web build`** — should succeed; bundle delta expected ~0 (no new code paths, just token consumption).
- **Visual smoke deferred** per slice 38-45 pattern.

## 9. Surface (deliverables)

- 13 files modified: 2 token src + 2 token tests + 4 consumer src + 3 consumer tests + 2 docs (CLAUDE.md, brand-migration.md, mobile-dod-checklist.md = 3, but spec headlined at ~13 by counting brand-book.md as optional).
- 1 new exported palette key: `BRAND_SEMANTIC.icon.location` (light + dark).
- 0 deleted tokens.
- 0 deleted hooks.
- 0 schema changes.
- 0 new dependencies.
- Test delta: ui-tokens +~4 (icon.location wiring); officials-ui +~3 (consumer mode-aware sanity checks).

## 10. Closeout

- Branch merged to master via `--no-ff` merge commit titled `Merge slice 46: inline-hex sweep (audit F4)`.
- CLAUDE.md slice 46 entry shipped.
- Mobile DoD slice 46 section shipped.
- User memory gets `project_chiaro_slice46_inline_hex_sweep.md` + 1-line MEMORY.md index.

## 11. Unblocks / next steps

After slice 46:

| Slice | Scope | Tier |
|---|---|---|
| 47 | F1 web page rewrites (home, profile/edit, settings/address, settings/layout, officials/, not-found) using slice 45 primitives | Mega |
| 48 | F2 mobile screen rewrites (home, officials list, profile edit, settings address, _layout) + F3 BrandStack mobile nav theming | Mega |
| 49+ | Reskin roadmap #4 industry rainbow (last queued reskin item) | TBD |

After slice 48: the slice 33-43 design system cascade is complete across the full UI surface. Remaining queue item (#4 industry rainbow) is the last philosophy decision.

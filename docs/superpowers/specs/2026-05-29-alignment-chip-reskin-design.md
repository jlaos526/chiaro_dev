# Slice 42 — AlignmentChip palette reskin

**Status:** Approved 2026-05-29
**Tier:** Compressed Slice (~8 files)
**Branch:** `slice-42-alignment-chip-reskin`

---

## 1. Goal

Re-derive the 5-tier `ALIGNMENT_CHIP_COLORS` palette so it (a) sits visually consistent with the slice 41 reskin family, (b) reads as a **cool-to-warm thermal** with a gold-Mixed pivot, and (c) gives the two "Strongly" tiers visible emphasis as poles via deeper bg + sharper fg saturation. As a bonus inside the same slice, refactor `ComplianceIcon` to consume the alignment palette via the slice 37 `useAlignmentChipColors` hook instead of duplicating hex literals.

Closes slice 38+ reskin roadmap decision **#2 AlignmentChip tiers**.

## 2. Non-goals

- **No change to `scoreToTier()` thresholds.** The 5-tier cut points (90/70/40/10) stay identical. This is a palette reskin, not a scoring algorithm change.
- **No change to `ALIGNMENT_LABEL`** text. "Strongly Aligned" / "Mostly Aligned" / "Mixed" / "Mostly Differs" / "Strongly Differs" stay byte-identical.
- **No change to chip layout, padding, border-radius, font-size, or accessibility properties** on the `AlignmentChip` component. Only the palette values feeding `useAlignmentChipColors` change; the consumer keeps compiling unchanged.
- **No change to `PillChevron.tsx`.** It uses the literal `#f0eee5` (which was the slice 37 Mixed bg) for a generic expand-affordance pill; the hex collision is coincidental, not semantic. Migrating PillChevron to a brand token is a separate inline-hex cleanup unrelated to slice 42's reskin scope.
- **No state-officials specific changes.** Alignment chips appear in both federal + state contexts via the same shared component; both consumers pick up the new palette transparently.
- **No new tokens beyond what already exists.** `ALIGNMENT_CHIP_COLORS` and `ALIGNMENT_CHIP_COLORS_DARK` keep their existing 5-key × `{bg, fg}` shape.

## 3. User stories

**As a user reading a profile-page alignment chip,**
the 5-tier gradient now reads as a clear cool-to-warm thermal — emerald-green for "aligned," gold for the on-the-fence "Mixed" middle, terracotta/burgundy for "differs." The two extreme tiers ("Strongly Aligned" + "Strongly Differs") visibly punch out from their neighboring mostly-tiers via deeper bg saturation, so I can scan a page and immediately notice the polar positions.

**As a user in dark mode,**
the chips no longer leak slice-37 warm-brown tones against the slice-40 cool-slate page bg. The dark-mode chips use deep tier-tinted backgrounds (cool emerald, cool slate-gold, warm terracotta) with bright tier-toned text.

**As a user on a page with a `ComplianceIcon` (filing-on-time check or late-X indicator),**
the icon's good/bad colors now match the alignment chip palette exactly, because the icon shares the same `useAlignmentChipColors` source of truth as the chips. When a future slice retones the palette again, the icon retones with it automatically.

## 4. Locked decisions

All 20 hex values, finalized 2026-05-29 across 4 brainstorm screens (Option A direction, Mixed-tier variants, Option-A+B-Mixed hybrid, V2 deeper-saturation Strongly emphasis):

### ALIGNMENT_CHIP_COLORS (light mode)

| Tier | bg | fg | Semantic |
|---|---|---|---|
| `strongly-aligned` | `#a8d4b0` | `#0f3a1c` | Deeper emerald (V2 saturation) |
| `mostly-aligned` | `#d8ecda` | `#2a6b30` | Pale emerald (unchanged from slice 37) |
| `mixed` | `#eedbb5` | `#7c5a1e` | Gold-cream (Option B's Mixed; slice 41 Service Record family) |
| `mostly-differs` | `#f0d3c0` | `#6a3e1c` | Pale peach (slice 37 hue, slightly cleaned fg) |
| `strongly-differs` | `#dca088` | `#4a1e0c` | Deeper terracotta (V2 saturation) |

### ALIGNMENT_CHIP_COLORS_DARK (dark mode)

| Tier | bg | fg | Semantic |
|---|---|---|---|
| `strongly-aligned` | `#143020` | `#a8e0b0` | Deep emerald slate (V2 saturation) |
| `mostly-aligned` | `#24462d` | `#a8c9af` | Mid emerald slate |
| `mixed` | `#23211a` | `#e1c896` | Gold-tinted cool slate (Option B's dark Mixed) |
| `mostly-differs` | `#3e2820` | `#e0a890` | Mid terracotta slate |
| `strongly-differs` | `#5e2418` | `#f5a888` | Deep terracotta slate (V2 saturation) |

### Design rationale

- **Cool → gold → warm thermal.** Light side reads as a continuous gradient: cool emerald → cool sage → gold neutral → warm peach → warm terracotta. This is a coherent perceptual sequence that supports the aligned-vs-differs intuition without requiring symbolic shape/icon scaffolding.
- **Gold Mixed pivot.** Borrowing the slice 41 Service Record gold (`#c89a4e` family) for the Mixed tier solves the slice 37 "Mixed bg blends into cream page" problem while giving the Service Record accent a second consumer downstream. Gold reads naturally as "on-the-fence / balanced."
- **V2 saturation on Strongly tiers.** Color does the emphasis — no font-weight differentiation, no border ring. The 2 Strongly chips become the visual loudest by bg saturation + fg darkness alone. The 3 middle tiers (mostly-aligned, mixed, mostly-differs) stay perceptibly muted, which preserves the gradient's smoothness.
- **Slice 40/41 family consistency.** Dark Mixed bg `#23211a` matches `CATEGORY_CARD_BG_SOLID_DARK['service-record']` byte-for-byte. Light Strongly Differs `#dca088` is a pleural-of-terracotta tied to `CATEGORY_ACCENT['community-presence']` `#b86340`.

## 5. Architecture / file plan

**~8 files. Compressed Slice tier.**

### 5.1 Token source

1. **`packages/ui-tokens/src/alignment.ts`** — replace the 5-entry `ALIGNMENT_CHIP_COLORS` and 5-entry `ALIGNMENT_CHIP_COLORS_DARK` object literals with the 20 locked hex values from §4. Add a slice-41-style comment block per export documenting the cool-to-warm thermal rationale + V2 saturation note. `AlignmentTier`, `ALIGNMENT_LABEL`, and `scoreToTier()` exports stay byte-identical.

### 5.2 Token test

2. **`packages/ui-tokens/test/alignment.test.ts`** — update the existing `describe('ALIGNMENT_CHIP_COLORS', ...)` block's 5 `expect(...).toEqual(...)` assertions to the new locked light hex values. Add a NEW `describe('ALIGNMENT_CHIP_COLORS_DARK (slice 42)', ...)` block asserting all 5 dark `{bg, fg}` pairs. Existing `scoreToTier` + `ALIGNMENT_LABEL` blocks unchanged.

### 5.3 ComplianceIcon refactor (consumer cleanup)

3. **`packages/officials-ui/src/cards/ComplianceIcon.tsx`** — replace the inline `STYLES` const's hex literals (currently `'on-time': { bg: '#c5e3c7', fg: '#1f4d24', ... }` and `'late': { bg: '#f4d3c0', fg: '#7a3e1c', ... }`) with a `useAlignmentChipColors(tier)` lookup. Tier mapping:
   - `state === 'on-time'` → `tier = 'strongly-aligned'`
   - `state === 'late'` → `tier = 'mostly-differs'` (preserves the slice 37 intent — slice 37 picked the mostly-differs hex, not strongly-differs, for "late")

   `glyph` + `label` stay as inline `STYLES` const entries (those aren't palette concerns).

4. **`packages/officials-ui/test/cards/ComplianceIcon.test.tsx`** — existing 3 tests (glyph + accessibility label) keep passing unchanged because they don't pin hex values. Add 1 new test verifying that `<ComplianceIcon state="on-time" />` rendered under the dark-mode override returns the dark strongly-aligned bg via the hook (smoke test for the mode-aware refactor). Test runs under `vitest` + RNW like the rest of officials-ui.

### 5.4 Docs

5. **`docs/brand-book.md`** — append a "Slice 42 — AlignmentChip palette" subsection under §11 (or as a new section ~12 if §11 closed cleanly post-slice-41) listing the 20 hex values + the cool-to-warm thermal narrative.

6. **`docs/brand-migration.md`** — append a `### AlignmentChip palette reskin (slice 42)` section covering: (a) light + dark hex tables, (b) thermal-gradient rationale, (c) ComplianceIcon consumer refactor note, (d) PillChevron hex-collision-not-touched note.

### 5.5 Closeout

7. **`CLAUDE.md`** — append a "Slice 42" entry in the Slices delivered section after the slice 41 entry, before "Specs live in...". Cover: cool-to-warm thermal, V2 saturation Strongly emphasis, gold Mixed pivot, slice 40/41 family consistency, ComplianceIcon refactor, PillChevron not touched.

8. **`docs/superpowers/mobile-dod-checklist.md`** — append a "Slice 42 — AlignmentChip palette" section with ~7 verification checkboxes: 5 tier dot colors verified visually + dark mode verification + ComplianceIcon on-time/late color match.

## 6. Cross-platform

- Web + mobile use the same `@chiaro/officials-ui` `<AlignmentChip>` component and consume `useAlignmentChipColors`. Both pick up the new palette transparently. No additional code path per platform.
- Dark mode toggle (slice 38) drives `useBrandTokens().mode` → `useAlignmentChipColors` picks the right table. No interaction with the slice 40 cool-slate cascade beyond the documented family consistency.

## 7. Risks

1. **Strongly-aligned fg `#0f3a1c` on bg `#a8d4b0` contrast.** Approximate ratio ~9:1 — AA-normal pass, AAA-normal pass. Safe.
2. **Strongly-differs fg `#4a1e0c` on bg `#dca088` contrast.** Approximate ratio ~6:1 — AA-normal pass. Safe.
3. **Mixed fg `#7c5a1e` on bg `#eedbb5` contrast.** Approximate ratio ~5:1 — AA-normal pass. Safe.
4. **Dark Strongly-aligned fg `#a8e0b0` on bg `#143020` contrast.** Approximate ratio ~9:1 — AA-normal pass. Safe.
5. **Coincidental hex collision in PillChevron `#f0eee5`.** The slice 37 Mixed bg was `#f0eee5`; slice 42 Mixed bg moves to `#eedbb5`. PillChevron's literal `#f0eee5` doesn't change (it never consumed via the palette). Documented in CLAUDE.md slice 42 entry as a "left alone — coincidental, not semantic" note.
6. **Slice 41 Gotcha #29 grep coverage.** Pre-flight grep against `packages/officials-ui/test` for any of the 20 OLD hex values (`#c5e3c7` `#d4ecd5` `#f0eee5` `#f4d3c0` `#f0b8a0` `#1f4d24` `#2a6b30` `#5a5751` `#7a3e1c` `#5a2812` `#1f3a25` `#26482e` `#3a3830` `#4a2e1c` `#5a2a18` `#a8d8ad` `#b8e0bd` `#d4d0c5` `#f0c2a5` `#f5b095`) returns ZERO matches in `test/` (verified during spec drafting). The 2 consumer-src hits (`PillChevron.tsx` + `ComplianceIcon.tsx`) are handled per §5.3 + §7.5.

## 8. Testing

- **TDD per Tasks 1-2.** Update test, run RED, update source, run GREEN.
- **`pnpm --filter @chiaro/ui-tokens test`** — should grow from 164 to ~166 (1 new describe block for `_DARK`; existing block updated in place).
- **`pnpm --filter @chiaro/officials-ui test`** — should grow from 457 to 458 (1 new ComplianceIcon dark-mode test). All other tests pass unchanged because `useAlignmentChipColors` tests reference the export (not hard-pinned hex).
- **`pnpm -r typecheck`** — should pass at all 11 projects.
- **No web `pnpm --filter @chiaro/web build` regression expected.** Chip palette change → token bundle is identical size.

## 9. Surface (deliverables)

- 8 files changed (1 token source + 1 token test + 1 consumer refactor + 1 consumer test + 4 docs files: brand-book + brand-migration + CLAUDE.md + mobile DoD).
- 0 schema changes.
- 0 new dependencies.
- 0 new exports.
- Test delta: +~2 ui-tokens cases + +1 officials-ui case.

## 10. Closeout

- Branch merged to master via `--no-ff` merge commit titled `Merge slice 42: AlignmentChip palette reskin`.
- CLAUDE.md slice 42 entry shipped (Task 7).
- Mobile DoD checklist gains slice 42 section (Task 8).
- User memory gets a `project_chiaro_slice42_alignment_chip_reskin.md` file + 1-line MEMORY.md index entry.

## 11. Unblocks (queued reskin roadmap progress)

After slice 42, reskin roadmap state:
- ✅ #1 Link blue — closed by slice 40 (kept as anchor)
- ✅ #2 AlignmentChip tiers — closed by this slice
- ✅ #3 BioPortrait gradient — closed by slice 40 (mode-aware)
- ⏳ #4 Industry rainbow — queued
- ⏳ #5 Finance "money in" green — queued (potential overlap with slice 41 Finance category accent `#1a8f5a`; needs taxonomy decision before reskin)
- ⏳ #6 MetricCardShell retune — queued
- ✅ slice 40 warm-brown dark leftover gap — closed by slice 41

3 reskin decisions remain. #5 is now most-pending since slice 41's Finance category accent (`#1a8f5a` emerald) overlaps semantically with `BRAND_SEMANTIC.signal.success` (`#3da75b` slice 37 green) — a follow-up audit will determine whether to collapse the two or keep them distinct.

# Slice 34 — Shared Foundation Retrofit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate 5 `COLORS.*` files + 8 inline-hex files in `@chiaro/officials-ui` to `BRAND.semantic.*` via `useBrandTokens()`. Brand-aligned hex auto-migrates; domain-divergent hex gets `// TODO slice 37` markers. Ship an audit doc tracking deferrals.

**Architecture:** Apply the slice-33 pattern (`useBrandTokens()` + RN StyleSheet split layout-static/color-inline). Per-component: `const { semantic } = useBrandTokens()` at body top. Tests use `BrandModeOverrideContext.Provider` wrapper. No new tokens in `@chiaro/ui-tokens`.

**Tech Stack:** TypeScript 5.4 strict, vitest 2, `@testing-library/react`, RN/RNW.

**Spec:** `docs/superpowers/specs/2026-05-27-shared-foundation-retrofit-design.md`
**Branch:** `shared-foundation-retrofit` (already created; spec committed at `d4b619d`)

**Canonical migration map:** `docs/brand-migration.md` (created in slice 33) — grep against this for `COLORS.*` mappings. Slice 34 spec §3.2 + §3.3 list the inline-hex dispositions.

---

## File structure

```
packages/officials-ui/src/
├── OfficialsCard.tsx                 Task 1 (Part A)
├── OfficialsList.tsx                 Task 1 (Part A)
├── OfficialAvatar.tsx                Task 1 (Part A)
├── bio/
│   ├── BioServiceCard.tsx            Task 3 (full migrate)
│   ├── BioHeader.tsx                 Task 3 (full migrate)
│   ├── BioIdentityRow.tsx            Task 4 (partial)
│   ├── BioPortrait.tsx               Task 4 (all defer)
│   └── BioContactLinks.tsx           Task 4 (partial)
├── cards/
│   ├── ComingSoonCard.tsx            Task 2 (Part A)
│   ├── CardSubsection.tsx            Task 2 (Part A)
│   └── MetricCardShell.tsx           Task 5 (partial)
└── finance/
    ├── TopAmountBreakdown.tsx        Task 6 (partial)
    └── FinanceSummaryStrip.tsx       Task 6 (partial)

docs/superpowers/audits/
└── 2026-05-27-inline-hex-sweep.md    Task 7 (NEW)

CLAUDE.md                             Task 8 (slice 34 entry)
```

---

## Task 1: Part A — OfficialsCard + OfficialsList + OfficialAvatar

**Files:**
- Modify: `packages/officials-ui/src/OfficialsCard.tsx`
- Modify: `packages/officials-ui/src/OfficialsList.tsx`
- Modify: `packages/officials-ui/src/OfficialAvatar.tsx`
- Update: `packages/officials-ui/test/OfficialsCard.test.tsx` (if exists)
- Update: `packages/officials-ui/test/OfficialsList.test.tsx` (if exists)
- Update: `packages/officials-ui/test/OfficialAvatar.test.tsx` (if exists)

Mechanical migration. Same pattern as slice 33 Task 7.

- [ ] **Step 1: Read source files + test files**

```bash
cat packages/officials-ui/src/OfficialsCard.tsx
cat packages/officials-ui/src/OfficialsList.tsx
cat packages/officials-ui/src/OfficialAvatar.tsx
ls packages/officials-ui/test/Officials*.test.tsx packages/officials-ui/test/Official*.test.tsx 2>/dev/null
```

Note which tests exist and which don't. Don't add a test file if one doesn't already exist for that source.

- [ ] **Step 2: Migrate each source file**

For each of the 3 files, apply the slice-33 pattern:

1. Replace `import { COLORS } from '@chiaro/ui-tokens'` → `import { useBrandTokens } from './brand-hooks.ts'` (paths: `./brand-hooks.ts` since these files are at `src/` root).
2. Inside the exported component, add `const { semantic } = useBrandTokens()` at top of body (after any existing hook calls).
3. Map every `COLORS.*` reference per `docs/brand-migration.md`:

| Was | Becomes |
|---|---|
| `COLORS.brand.primary` | `semantic.accent.primary` |
| `COLORS.brand.accent` | `semantic.accent.secondary` |
| `COLORS.brand.text` | `semantic.text.primary` |
| `COLORS.neutral.background` | `semantic.bg.elevated` |
| `COLORS.neutral.surface` | `semantic.bg.app` |
| `COLORS.neutral.surfaceAlt` | `semantic.bg.subtle` |
| `COLORS.neutral.border` | `semantic.border.default` |
| `COLORS.neutral.mute` | `semantic.text.muted` |
| `COLORS.neutral.textMuted` | `semantic.text.muted` |
| `COLORS.neutral.outline` | `semantic.border.strong` |
| `COLORS.signal.error` | `semantic.alert.danger.fg` |

4. For RN StyleSheet entries whose only purpose was a color: delete them; apply colors inline via `style` array at the consuming JSX site (slice 33 Task 6+7 pattern).

- [ ] **Step 3: Update existing tests (mode-awareness)**

For each existing test file, append a new describe block at the end:

```tsx
import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../src/brand-hooks.ts'

const lightWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
const darkWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)

describe('<ComponentName> — mode awareness', () => {
  it('renders under both light and dark wrappers without throwing', () => {
    expect(() => render(<ComponentName {...minimalProps} />, { wrapper: lightWrapper })).not.toThrow()
    expect(() => render(<ComponentName {...minimalProps} />, { wrapper: darkWrapper })).not.toThrow()
  })
})
```

Adapt `<ComponentName />` and `{...minimalProps}` per the existing test fixtures.

If the test file already imports `createElement`/`ReactNode`/`BrandModeOverrideContext`, don't double-import. If no test file exists for a source, skip — do not add one.

- [ ] **Step 4: Update assertions referencing old hex values**

If any existing test asserts on OLD hex literals (`#5b6cff`, `#c5364a`, `#666`, `#807a72`, etc.), update to NEW values per the migration map. If existing tests assert structurally without hex literals, leave them alone.

- [ ] **Step 5: Run tests + typecheck**

```bash
pnpm --filter @chiaro/officials-ui test --reporter=verbose Officials
pnpm --filter @chiaro/officials-ui typecheck
```

Expected: all 3 files' tests green (existing + new mode-awareness); typecheck clean.

- [ ] **Step 6: Verify no COLORS refs remain in the 3 files**

```bash
grep -n "COLORS\." packages/officials-ui/src/OfficialsCard.tsx packages/officials-ui/src/OfficialsList.tsx packages/officials-ui/src/OfficialAvatar.tsx
```

Expected: empty output.

- [ ] **Step 7: Commit**

```bash
git add packages/officials-ui/src/OfficialsCard.tsx \
        packages/officials-ui/src/OfficialsList.tsx \
        packages/officials-ui/src/OfficialAvatar.tsx \
        packages/officials-ui/test/OfficialsCard.test.tsx \
        packages/officials-ui/test/OfficialsList.test.tsx \
        packages/officials-ui/test/OfficialAvatar.test.tsx 2>/dev/null

# Adjust paths above if some test files don't exist; only add what exists.

git commit -m "$(cat <<'EOF'
refactor(officials-ui): OfficialsCard/List/Avatar migrate to BRAND.semantic

useBrandTokens() per component; RN StyleSheet split layout-static /
color-inline. Mode-awareness tests for files with existing test fixtures.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Part A — ComingSoonCard + CardSubsection

**Files:**
- Modify: `packages/officials-ui/src/cards/ComingSoonCard.tsx`
- Modify: `packages/officials-ui/src/cards/CardSubsection.tsx`
- Update: `packages/officials-ui/test/cards/ComingSoonCard.test.tsx` (if exists)
- Update: `packages/officials-ui/test/cards/CardSubsection.test.tsx` (if exists)

Same mechanical pattern as Task 1, but in `cards/` subdirectory so the hook import path changes.

- [ ] **Step 1: Read source files + test files**

```bash
cat packages/officials-ui/src/cards/ComingSoonCard.tsx
cat packages/officials-ui/src/cards/CardSubsection.tsx
ls packages/officials-ui/test/cards/ComingSoonCard.test.tsx packages/officials-ui/test/cards/CardSubsection.test.tsx 2>/dev/null
```

- [ ] **Step 2: Migrate each source file**

Same as Task 1 Step 2 BUT the hook import path is `'../brand-hooks.ts'` (two levels up from `cards/`):

```ts
import { useBrandTokens } from '../brand-hooks.ts'
```

Apply the same migration table (Task 1 Step 2).

- [ ] **Step 3: Update existing tests for mode-awareness**

Same pattern as Task 1 Step 3, adjusted for `cards/` subdirectory path. The import for `BrandModeOverrideContext` becomes:

```ts
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'
```

- [ ] **Step 4: Run tests + typecheck**

```bash
pnpm --filter @chiaro/officials-ui test ComingSoonCard CardSubsection
pnpm --filter @chiaro/officials-ui typecheck
```

- [ ] **Step 5: Verify no COLORS refs**

```bash
grep -n "COLORS\." packages/officials-ui/src/cards/ComingSoonCard.tsx packages/officials-ui/src/cards/CardSubsection.tsx
```

Expected: empty.

- [ ] **Step 6: Commit**

```bash
git add packages/officials-ui/src/cards/ComingSoonCard.tsx \
        packages/officials-ui/src/cards/CardSubsection.tsx \
        packages/officials-ui/test/cards/ComingSoonCard.test.tsx \
        packages/officials-ui/test/cards/CardSubsection.test.tsx 2>/dev/null
git commit -m "$(cat <<'EOF'
refactor(officials-ui): cards/ComingSoonCard + CardSubsection to BRAND

Mode-aware via useBrandTokens(). Mechanical migration per slice 33 pattern.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Part B — bio/BioServiceCard + bio/BioHeader (full migrate)

**Files:**
- Modify: `packages/officials-ui/src/bio/BioServiceCard.tsx`
- Modify: `packages/officials-ui/src/bio/BioHeader.tsx`
- Update: corresponding test files (if exist)

Both files have only brand-aligned hex values — full migrate, no deferrals.

- [ ] **Step 1: Read source files + tests**

```bash
cat packages/officials-ui/src/bio/BioServiceCard.tsx
cat packages/officials-ui/src/bio/BioHeader.tsx
ls packages/officials-ui/test/bio/BioServiceCard.test.tsx packages/officials-ui/test/bio/BioHeader.test.tsx 2>/dev/null
```

- [ ] **Step 2: Migrate `BioServiceCard.tsx`**

The file currently has 5 inline hex values. Add the hook + replace per this table:

| Inline hex (and role) | Becomes |
|---|---|
| `'#f0eee5'` (line 15, card backgroundColor) | `semantic.bg.subtle` |
| `'#807a72'` (line 22, "PARTY SERVICE" text uppercase) | `semantic.text.muted` |
| `'#1a1714'` (line 25, role badge backgroundColor) | `semantic.text.primary` |
| `'#fff'` (line 26, role text on dark badge) | `semantic.bg.elevated` |
| `'#5a5751'` (line 29, "· Since YYYY" text) | `semantic.text.muted` |

Add `import { useBrandTokens } from '../brand-hooks.ts'` at the top; add `const { semantic } = useBrandTokens()` at component body top.

- [ ] **Step 3: Migrate `BioHeader.tsx`**

The file has 1 inline hex value:

| Inline hex (and role) | Becomes |
|---|---|
| `'#1a1714'` (line 37, fullName text color) | `semantic.text.primary` |

Same import + hook pattern.

- [ ] **Step 4: Add mode-awareness tests where existing tests live**

For each test file that exists, append the mode-awareness describe block (same pattern as Task 1 Step 3). Test import path:
```ts
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'
```

- [ ] **Step 5: Run tests + typecheck**

```bash
pnpm --filter @chiaro/officials-ui test BioServiceCard BioHeader
pnpm --filter @chiaro/officials-ui typecheck
```

- [ ] **Step 6: Verify no inline hex remains in these 2 files**

```bash
grep -nE "#[0-9a-fA-F]{3,8}" packages/officials-ui/src/bio/BioServiceCard.tsx packages/officials-ui/src/bio/BioHeader.tsx
```

Expected: empty (or only matches inside comments — those are fine).

- [ ] **Step 7: Commit**

```bash
git add packages/officials-ui/src/bio/BioServiceCard.tsx \
        packages/officials-ui/src/bio/BioHeader.tsx \
        packages/officials-ui/test/bio/BioServiceCard.test.tsx \
        packages/officials-ui/test/bio/BioHeader.test.tsx 2>/dev/null
git commit -m "$(cat <<'EOF'
refactor(officials-ui): bio BioServiceCard + BioHeader inline hex to BRAND

Full migrate — all 6 hex values map to semantic.* via useBrandTokens().
No deferrals.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Part B — bio/BioIdentityRow + bio/BioContactLinks + bio/BioPortrait (partial / defer)

**Files:**
- Modify: `packages/officials-ui/src/bio/BioIdentityRow.tsx`
- Modify: `packages/officials-ui/src/bio/BioContactLinks.tsx`
- Modify: `packages/officials-ui/src/bio/BioPortrait.tsx`
- Update: corresponding test files (if exist)

Mixed: some hex migrate, some defer with `// TODO slice 37` markers.

- [ ] **Step 1: Read source files + tests**

```bash
cat packages/officials-ui/src/bio/BioIdentityRow.tsx
cat packages/officials-ui/src/bio/BioContactLinks.tsx
cat packages/officials-ui/src/bio/BioPortrait.tsx
ls packages/officials-ui/test/bio/BioIdentityRow.test.tsx packages/officials-ui/test/bio/BioContactLinks.test.tsx packages/officials-ui/test/bio/BioPortrait.test.tsx 2>/dev/null
```

- [ ] **Step 2: Migrate `BioIdentityRow.tsx`** (4 migrate, 1 defer)

| Inline hex | Disposition |
|---|---|
| `'#807a72'` (line 23, PARTY_COLOR fallback when party unknown) | **DEFER** — keep as the PARTY_COLOR-domain default. Add comment: `// TODO slice 37: replace with PARTY_COLOR.unknown when palette gets dark variants` |
| `'#fff'` (line 28, party label text on partyColor bg) | `semantic.bg.elevated` |
| `'#f0eee5'` (line 30, chamber chip bg) | `semantic.bg.subtle` |
| `'#3a352b'` (line 31, chamber chip text) | `semantic.text.body` |
| `'#f0eee5'` (line 35, district chip bg — same as line 30) | `semantic.bg.subtle` |

Add the hook import + hook call.

- [ ] **Step 3: Migrate `BioContactLinks.tsx`** (1 migrate, 1 defer)

| Inline hex | Disposition |
|---|---|
| `'#3b6ed1'` (line 22, link text color) | **DEFER** — add `// TODO slice 37: link color brand-decision (anchor blue vs accent.primary)` |
| `'#d8d4c9'` (line 83, separator dot color) | `semantic.border.default` |

Add hook import + hook call (only needed for the `#d8d4c9` → `semantic.border.default` migration; if the deferred site stays inline, the hook is still required for the migrated site).

- [ ] **Step 4: Annotate `BioPortrait.tsx`** (0 migrate, 3 defer)

All 3 hex are part of the blue portrait gradient — defer entirely.

| Inline hex | Action |
|---|---|
| `'#3b6ed1'` (line 10, gradient start + native solid) | Add `// TODO slice 37: portrait gradient brand-decision` above the const decl |
| `'#5b8de1'` (line 10, gradient end) | Same comment covers both stops |
| `'#3b6ed1'` (line 11, PORTRAIT_SOLID_NATIVE) | Add `// TODO slice 37: portrait solid native — pairs with gradient` |
| `'#fff'` (line 55, initials text on blue bg) | **DEFER** — the white-on-blue contrast pairs with the deferred blue. Mark with same TODO. |

**Do NOT add `useBrandTokens()` to BioPortrait.tsx** — there are no migrations in this file. The deferred sites stay inline with TODO comments; no hook is needed.

- [ ] **Step 5: Update tests for mode-awareness (where existing tests live)**

Same pattern as Task 1 Step 3. Skip files without existing tests.

- [ ] **Step 6: Run tests + typecheck**

```bash
pnpm --filter @chiaro/officials-ui test BioIdentityRow BioContactLinks BioPortrait
pnpm --filter @chiaro/officials-ui typecheck
```

- [ ] **Step 7: Verify remaining inline hex is annotated**

```bash
grep -nE "#[0-9a-fA-F]{3,8}" packages/officials-ui/src/bio/BioIdentityRow.tsx packages/officials-ui/src/bio/BioContactLinks.tsx packages/officials-ui/src/bio/BioPortrait.tsx
```

Expected: every remaining match has a `TODO slice 37` comment within 3 lines above it.

- [ ] **Step 8: Commit**

```bash
git add packages/officials-ui/src/bio/BioIdentityRow.tsx \
        packages/officials-ui/src/bio/BioContactLinks.tsx \
        packages/officials-ui/src/bio/BioPortrait.tsx \
        packages/officials-ui/test/bio/BioIdentityRow.test.tsx \
        packages/officials-ui/test/bio/BioContactLinks.test.tsx \
        packages/officials-ui/test/bio/BioPortrait.test.tsx 2>/dev/null
git commit -m "$(cat <<'EOF'
refactor(officials-ui): bio Identity/Contact/Portrait partial migrate

5 inline hex migrate to semantic.*; 5 inline hex defer to slice 37
with TODO markers (link blue, portrait gradient, PARTY_COLOR fallback).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Part B — cards/MetricCardShell (partial, half-migration)

**Files:**
- Modify: `packages/officials-ui/src/cards/MetricCardShell.tsx`
- Update: `packages/officials-ui/test/cards/MetricCardShell.test.tsx` (if exists)

Heaviest defer file. 16 inline hex; only 3 migrate. Most of the file stays inline with TODO markers awaiting slice 37 (category palette migration).

- [ ] **Step 1: Read the source file**

```bash
cat packages/officials-ui/src/cards/MetricCardShell.tsx
ls packages/officials-ui/test/cards/MetricCardShell.test.tsx 2>/dev/null
```

- [ ] **Step 2: Apply the disposition map**

| Line | Inline hex | Disposition |
|---|---|---|
| 16-21 | `CATEGORY_CARD_BG_SOLID` palette (6 values: `#fcfaf2`, `#f6f8fc`, `#f3faf8`, `#f4faf6`, `#fcf7f0`, `#f7f4fc`) | **DEFER** — add comment block above the const: `// TODO slice 37: migrate CATEGORY_CARD_BG_SOLID to @chiaro/ui-tokens alongside CATEGORY_CARD_GRADIENT` |
| 40 | `'#807a72'` (UNAVAILABLE_GREY) | **MIGRATE** — replace const with `semantic.text.muted` (read from hook at component body) |
| 41 | `'#fafaf6'` (UNAVAILABLE_BG) | **DEFER** — add `// TODO slice 37: domain placeholder bg` |
| 51 | `'#f6f4ed'` (placeholder card bg) | **DEFER** — add `// TODO slice 37: domain placeholder bg` |
| 52 | `'#fcfaf2'` (CATEGORY_CARD_BG_SOLID fallback) | **DEFER** — part of category palette |
| 63 | `'#1a1714'` (text color) | **MIGRATE** — `semantic.text.primary` |
| 69 | `'#5a5751'` (secondary text) | **MIGRATE** — `semantic.text.muted` |
| 69 | `'#1a1714'` (alternate text branch) | **MIGRATE** — `semantic.text.primary` |
| 74 | `'#807a72'` (UNAVAILABLE_GREY reference — already migrated above) | uses the const (covered by line 40 migration) |
| 88 | `'#3b6ed1'` (chip text blue) | **DEFER** — add `// TODO slice 37: link blue brand-decision` |
| 104 | `'#3b6ed1'` (chip text blue, alt branch) | **DEFER** — same TODO |
| 128 | `'#d8d4c9'` (chip border) | **MIGRATE** — `semantic.border.default` |

Strategy:
- Add `import { useBrandTokens } from '../brand-hooks.ts'`
- Add `const { semantic } = useBrandTokens()` at component body top
- The `UNAVAILABLE_GREY` module-level const can't read from a hook. Either: (a) inline the value at each usage site, OR (b) delete the const and replace usage sites with `semantic.text.muted`. Pick (b) — cleaner.
- Wrap the deferred `CATEGORY_CARD_BG_SOLID` const + `UNAVAILABLE_BG` const + the placeholder-bg literals with `// TODO slice 37: ...` comments.

- [ ] **Step 3: Add top-of-file JSDoc note**

Add this near the top of MetricCardShell.tsx (after imports, before the first const):

```ts
/**
 * NOTE (slice 34): This file has 13 inline hex values intentionally retained
 * as `// TODO slice 37` deferrals — they belong to the domain category palette
 * (`CATEGORY_CARD_BG_SOLID`), placeholder-bg literals, and link-blue color
 * which all await slice 37's domain palette work. See:
 * `docs/superpowers/audits/2026-05-27-inline-hex-sweep.md`.
 */
```

- [ ] **Step 4: Update existing test for mode-awareness**

Same pattern as Task 1 Step 3 if a test file exists.

- [ ] **Step 5: Run tests + typecheck**

```bash
pnpm --filter @chiaro/officials-ui test MetricCardShell
pnpm --filter @chiaro/officials-ui typecheck
```

- [ ] **Step 6: Verify deferred hex have TODO markers**

```bash
grep -B2 -nE "#[0-9a-fA-F]{3,8}" packages/officials-ui/src/cards/MetricCardShell.tsx | grep -B0 "TODO slice 37"
```

Expected: every remaining `#hex` line is preceded (within 2 lines) by a `TODO slice 37` comment.

- [ ] **Step 7: Commit**

```bash
git add packages/officials-ui/src/cards/MetricCardShell.tsx \
        packages/officials-ui/test/cards/MetricCardShell.test.tsx 2>/dev/null
git commit -m "$(cat <<'EOF'
refactor(officials-ui): MetricCardShell partial migrate (3 of 16 hex)

3 inline hex migrate to semantic.text.primary/muted + border.default.
13 inline hex defer to slice 37 with TODO markers (category palette,
placeholder bg, link blue). Top-of-file JSDoc points to audit doc.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Part B — finance/TopAmountBreakdown + finance/FinanceSummaryStrip

**Files:**
- Modify: `packages/officials-ui/src/finance/TopAmountBreakdown.tsx`
- Modify: `packages/officials-ui/src/finance/FinanceSummaryStrip.tsx`
- Update: corresponding test files (if exist)

Mixed migrate/defer. Brand-aligned text + border migrate; finance-domain signal colors (green, mint) and link blue defer.

- [ ] **Step 1: Read source files + tests**

```bash
cat packages/officials-ui/src/finance/TopAmountBreakdown.tsx
cat packages/officials-ui/src/finance/FinanceSummaryStrip.tsx
ls packages/officials-ui/test/finance/TopAmountBreakdown.test.tsx packages/officials-ui/test/finance/FinanceSummaryStrip.test.tsx 2>/dev/null
```

- [ ] **Step 2: Migrate `TopAmountBreakdown.tsx`** (6 migrate, 7 defer)

| Line | Hex | Disposition |
|---|---|---|
| 24 | `'#f4faf6'` (SOLID_NATIVE mint bg) | **DEFER** — `// TODO slice 37: finance domain bg` |
| 56 | `'#d8d4c9'` (border) | **MIGRATE** — `semantic.border.default` |
| 72 | `'#1a1714'` (text) | **MIGRATE** — `semantic.text.primary` |
| 78 | `'#1a1714'` (amount text) | **MIGRATE** — `semantic.text.primary` |
| 79 | `'#5a5751'` (percent secondary) | **MIGRATE** — `semantic.text.muted` |
| 82 | `'#e8e6dd'` (progress track) | **MIGRATE** — `semantic.border.default` |
| 85 | `'#3da75b'` (progress fill green) | **DEFER** — `// TODO slice 37: finance signal green` |
| 105 | `'#fff'` (card bg) | **MIGRATE** — `semantic.bg.elevated` |
| 107 | `'#d8d4c9'` (card border) | **MIGRATE** — `semantic.border.default` |
| 117 | `'#1a1714'` (label text) | **MIGRATE** — `semantic.text.primary` |
| 120 | `'#5a5751'` (secondary text) | **MIGRATE** — `semantic.text.muted` |
| 140 | `'#3b6ed1'` (link blue) | **DEFER** — `// TODO slice 37: link blue brand-decision` |
| 153 | `'#3b6ed1'` (link blue, alt site) | **DEFER** — same TODO |

Add hook import + hook call.

- [ ] **Step 3: Migrate `FinanceSummaryStrip.tsx`** (4 migrate, 3 defer)

| Line | Hex | Disposition |
|---|---|---|
| 24 | `'#3da75b'` (DOT — finance success indicator) | **DEFER** — `// TODO slice 37: finance signal green` |
| 25 | `'#f4faf6'` (SOLID_NATIVE mint bg) | **DEFER** — `// TODO slice 37: finance domain bg` |
| 39 | `'#5a5751'` (secondary text) | **MIGRATE** — `semantic.text.muted` |
| 52 | `'#1a1714'` (primary text) | **MIGRATE** — `semantic.text.primary` |
| 82 | `'#d8d4c9'` (border) | **MIGRATE** — `semantic.border.default` |
| 89 | `'#d8d4c9'` (vertical divider) | **MIGRATE** — `semantic.border.default` |
| 91 | `'#d8d4c9'` (vertical divider, 2nd) | **MIGRATE** — `semantic.border.default` |

**Count reconciliation note:** the spec §3.4 reports 4 migrate / 3 defer (7 total). The table above lists 5 migrate (lines 39/52/82/89/91 — 3 of which are the same `#d8d4c9` border value at 3 sites) and 2 defer (lines 24/25). Both add to 7. If the implementer's read finds a different site count, follow the actual file — file lines are authoritative over the spec's tally.

Add hook import + hook call.

- [ ] **Step 4: Update existing tests for mode-awareness**

Same pattern as Task 1 Step 3 where tests exist.

- [ ] **Step 5: Run tests + typecheck**

```bash
pnpm --filter @chiaro/officials-ui test TopAmountBreakdown FinanceSummaryStrip
pnpm --filter @chiaro/officials-ui typecheck
```

- [ ] **Step 6: Verify deferred hex have TODO markers**

```bash
grep -B2 -nE "#[0-9a-fA-F]{3,8}" packages/officials-ui/src/finance/TopAmountBreakdown.tsx packages/officials-ui/src/finance/FinanceSummaryStrip.tsx | grep -B0 "TODO slice 37"
```

Expected: all remaining hex preceded by `TODO slice 37` comments.

- [ ] **Step 7: Commit**

```bash
git add packages/officials-ui/src/finance/TopAmountBreakdown.tsx \
        packages/officials-ui/src/finance/FinanceSummaryStrip.tsx \
        packages/officials-ui/test/finance/TopAmountBreakdown.test.tsx \
        packages/officials-ui/test/finance/FinanceSummaryStrip.test.tsx 2>/dev/null
git commit -m "$(cat <<'EOF'
refactor(officials-ui): finance components partial migrate

10 inline hex migrate to semantic.text/border. 10 inline hex defer to
slice 37 with TODO markers (signal green, mint bg, link blue).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Audit doc — `docs/superpowers/audits/2026-05-27-inline-hex-sweep.md`

**Files:**
- Create: `docs/superpowers/audits/2026-05-27-inline-hex-sweep.md`

Permanent reference enumerating every deferred site. Slice 37's inheritance manifest.

- [ ] **Step 1: Create the audit doc**

Create `docs/superpowers/audits/2026-05-27-inline-hex-sweep.md`:

```markdown
# Inline-Hex Sweep Audit — Slice 34

> Catalogs every inline hex site touched in slice 34: migrated to `BRAND.semantic.*` or deferred to slice 37 with a `// TODO slice 37` marker.
>
> **Slice 37 reads this doc as its inheritance manifest.** Every deferred site below must be addressed (token introduction or brand-philosophy decision) before slice 37 closes.

## Summary

- **Files swept:** 8 (5 bio/ + 1 cards/MetricCardShell + 2 finance/)
- **Sites migrated:** 24
- **Sites deferred:** 28
- **New tokens introduced this slice:** 0 (BRAND surface unchanged)
- **Pending slice-37 tokens:** finance signal green, finance mint bg, category card bg, placeholder card bg, link blue

## Migrated sites

Sites where an inline hex was replaced with a `semantic.*` token via `useBrandTokens()`.

### bio/BioServiceCard.tsx (5)

| Line (pre) | Old | New |
|---|---|---|
| 15 | `'#f0eee5'` | `semantic.bg.subtle` |
| 22 | `'#807a72'` | `semantic.text.muted` |
| 25 | `'#1a1714'` | `semantic.text.primary` |
| 26 | `'#fff'` | `semantic.bg.elevated` |
| 29 | `'#5a5751'` | `semantic.text.muted` |

### bio/BioHeader.tsx (1)

| Line (pre) | Old | New |
|---|---|---|
| 37 | `'#1a1714'` | `semantic.text.primary` |

### bio/BioIdentityRow.tsx (4)

| Line (pre) | Old | New |
|---|---|---|
| 28 | `'#fff'` | `semantic.bg.elevated` |
| 30 | `'#f0eee5'` | `semantic.bg.subtle` |
| 31 | `'#3a352b'` | `semantic.text.body` |
| 35 | `'#f0eee5'` | `semantic.bg.subtle` |

### bio/BioContactLinks.tsx (1)

| Line (pre) | Old | New |
|---|---|---|
| 83 | `'#d8d4c9'` | `semantic.border.default` |

### cards/MetricCardShell.tsx (3)

| Line (pre) | Old | New |
|---|---|---|
| 40 | `'#807a72'` (UNAVAILABLE_GREY const) | `semantic.text.muted` |
| 63 | `'#1a1714'` | `semantic.text.primary` |
| 69 | `'#5a5751'` + `'#1a1714'` | `semantic.text.muted` + `semantic.text.primary` |
| 128 | `'#d8d4c9'` | `semantic.border.default` |

### finance/TopAmountBreakdown.tsx (6)

| Line (pre) | Old | New |
|---|---|---|
| 56 | `'#d8d4c9'` | `semantic.border.default` |
| 72 | `'#1a1714'` | `semantic.text.primary` |
| 78 | `'#1a1714'` | `semantic.text.primary` |
| 79 | `'#5a5751'` | `semantic.text.muted` |
| 82 | `'#e8e6dd'` | `semantic.border.default` |
| 105 | `'#fff'` | `semantic.bg.elevated` |
| 107 | `'#d8d4c9'` | `semantic.border.default` |
| 117 | `'#1a1714'` | `semantic.text.primary` |
| 120 | `'#5a5751'` | `semantic.text.muted` |

### finance/FinanceSummaryStrip.tsx (4)

| Line (pre) | Old | New |
|---|---|---|
| 39 | `'#5a5751'` | `semantic.text.muted` |
| 52 | `'#1a1714'` | `semantic.text.primary` |
| 82, 89, 91 | `'#d8d4c9'` (3 sites) | `semantic.border.default` |

## Deferred sites — slice 37 must address

Sites where inline hex stays with a `// TODO slice 37` marker.

### Link blue (`#3b6ed1`, `#5b8de1`)

| File | Sites | Slice 37 decision |
|---|---|---|
| `bio/BioPortrait.tsx` | 2 (gradient start + native solid + 1 lighter stop `#5b8de1`) | Portrait gradient: stay blue, or rebase to brand orange? |
| `bio/BioContactLinks.tsx` | 1 (line 22, anchor color) | Anchor color: blue or `accent.primary`? Decision propagates to all link sites. |
| `cards/MetricCardShell.tsx` | 2 (lines 88, 104 chip text blue) | Same. |
| `finance/TopAmountBreakdown.tsx` | 2 (lines 140, 153 link text) | Same. |

**Recommended slice-37 action:** introduce `semantic.link.fg` token; decide whether it resolves to deep orange `accent.primary` or stays blue. Migrate all 7 sites at once.

### Finance signal green (`#3da75b`)

| File | Sites |
|---|---|
| `finance/TopAmountBreakdown.tsx` | 1 (line 85, progress fill) |
| `finance/FinanceSummaryStrip.tsx` | 1 (line 24, DOT const) |

**Recommended slice-37 action:** introduce `semantic.signal.success` token (light + dark). Update slice 32 spec §4.1 to add the alert.success row (currently only alert.danger exists).

### Finance mint background (`#f4faf6`)

| File | Sites |
|---|---|
| `finance/TopAmountBreakdown.tsx` | 1 (line 24, SOLID_NATIVE const) |
| `finance/FinanceSummaryStrip.tsx` | 1 (line 25, SOLID_NATIVE const) |

**Recommended slice-37 action:** introduce `FINANCE_CARD_BG` token in `@chiaro/ui-tokens/finance.ts` alongside existing finance domain palette. Light + dark variants.

### MetricCardShell category palette (`#fcfaf2`, `#f6f8fc`, `#f3faf8`, `#f4faf6`, `#fcf7f0`, `#f7f4fc`)

| File | Sites |
|---|---|
| `cards/MetricCardShell.tsx` | 6 (lines 16-21, `CATEGORY_CARD_BG_SOLID` const) |

**Recommended slice-37 action:** move `CATEGORY_CARD_BG_SOLID` to `@chiaro/ui-tokens/category.ts` alongside existing `CATEGORY_CARD_GRADIENT`. Add dark variants.

### MetricCardShell placeholder backgrounds (`#fafaf6`, `#f6f4ed`)

| File | Sites |
|---|---|
| `cards/MetricCardShell.tsx` | 2 (lines 41, 51 — UNAVAILABLE_BG + placeholder) |

**Recommended slice-37 action:** introduce `semantic.bg.placeholder` token (or fold into existing `bg.subtle` if visual diff is acceptable).

### PARTY_COLOR fallback (`#807a72`)

| File | Sites |
|---|---|
| `bio/BioIdentityRow.tsx` | 1 (line 23, fallback when party unknown) |

**Recommended slice-37 action:** add `PARTY_COLOR.unknown` to `@chiaro/ui-tokens/party.ts` with explicit light + dark values.

### BioPortrait white-on-blue (`#fff`)

| File | Sites |
|---|---|
| `bio/BioPortrait.tsx` | 1 (line 55, initials text) |

**Recommended slice-37 action:** pair with the portrait-gradient decision. If portrait stays blue, this stays white. If portrait rebases to orange, the white-on-orange contrast may need reconsideration.

## Guidance for future authors

If you reach for an inline hex value in `@chiaro/officials-ui`, check this audit first:

1. Does the hex match a `BRAND.semantic.*` token? Use `useBrandTokens()` instead.
2. Is the hex in this audit's "Deferred sites" section? Match the TODO comment style and add yourself to the list.
3. Is the hex truly novel (no existing token, no existing TODO)? File an issue or update this audit before committing.

The CLAUDE.md Code Style rule "Inline hex colors are forbidden" stands; this audit catalogs the known exceptions awaiting slice 37.

---

*Generated alongside slice 34. See `docs/superpowers/specs/2026-05-27-shared-foundation-retrofit-design.md` for the slice 34 design and `docs/brand-migration.md` for the canonical migration vocabulary.*
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/audits/2026-05-27-inline-hex-sweep.md
git commit -m "$(cat <<'EOF'
docs(brand): inline-hex sweep audit — slice 37 inheritance manifest

Catalogs all 24 migrated + 28 deferred sites from slice 34. Each
deferred site has a recommended slice-37 action. Future-author
guidance section closes the inline-hex-introduction loophole.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Final verification + CLAUDE.md slice 34

**Files:**
- Verify: workspace state
- Modify: `CLAUDE.md`

Final gate.

- [ ] **Step 1: Full workspace typecheck**

```bash
pnpm -r typecheck
```

Expected: 11 packages green.

- [ ] **Step 2: Full workspace test**

```bash
pnpm test
```

Expected: every package's tests pass (except known env-only Supabase integration tests).

- [ ] **Step 3: Confirm scope**

```bash
git diff master --name-only -- 'apps/' 'packages/officials/' 'packages/state-bills/' 'packages/bills/' 'packages/location/' 'packages/profile/' 'packages/supabase-client/' 'packages/db/' 'packages/ui-tokens/'
```

Expected: empty. Slice 34 only touches `packages/officials-ui/`, `docs/`, and `CLAUDE.md`.

- [ ] **Step 4: Web build smoke**

```bash
pnpm --filter @chiaro/web build
```

Expected: clean build. First Load JS per route within ±2 kB of slice 33 baseline.

- [ ] **Step 5: Update CLAUDE.md "Slices delivered" section**

Find the slice 33 bullet (starts with `- **Slice 33 — Auth brand retrofit + Logo + useBrandTokens**`). Append a new bullet immediately after:

```markdown
- **Slice 34 — Shared foundation retrofit + inline-hex sweep** (2026-05-27): Mechanical migration of 5 `COLORS.*` files (`OfficialsCard`, `OfficialsList`, `OfficialAvatar`, `ComingSoonCard`, `CardSubsection`) to `BRAND.semantic.*` via `useBrandTokens()` (slice 33 pattern). Plus inline-hex sweep across 8 files (bio/* + cards/MetricCardShell + finance/*): 24 brand-aligned hex sites migrated; 28 domain-divergent hex sites deferred to slice 37 with `// TODO slice 37` markers. New `docs/superpowers/audits/2026-05-27-inline-hex-sweep.md` audit doc enumerates every deferred site with a recommended slice-37 action — slice 37's inheritance manifest. No new tokens in `@chiaro/ui-tokens` (BRAND surface unchanged). ~25 files; no schema work; pgTAP unchanged at 428 plans.
```

- [ ] **Step 6: Commit CLAUDE.md**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs(claude): record slice 34 — shared foundation retrofit

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 7: Final state check**

```bash
git log --oneline master..shared-foundation-retrofit
git status --short
```

Expected: ~10 commits on branch (spec + plan + 7 task commits + CLAUDE.md update); clean working tree.

---

## Notes for the implementer

1. **Mode-aware hook placement.** Every file that migrates ANY hex value needs `const { semantic } = useBrandTokens()` at the top of its component body. Files that only DEFER (like `bio/BioPortrait.tsx`) do NOT get the hook — they're untouched except for `// TODO slice 37` annotations.

2. **TODO comment style.** `// TODO slice 37: <one-line reason>` — one line, always references slice 37 explicitly so the audit doc grep finds them.

3. **`UNAVAILABLE_GREY` const in MetricCardShell.** It's a module-level const that can't read a hook. Delete the const and replace its usage sites with `semantic.text.muted` directly. Same for any other module-level hex consts that get migrated.

4. **Audit doc is load-bearing.** Every deferred site MUST appear in `docs/superpowers/audits/2026-05-27-inline-hex-sweep.md`. Slice 37 reads it as its inheritance manifest.

5. **No new tokens.** The BRAND surface from slice 32 is unchanged in slice 34. If a hex value can't map to an existing token, it goes in the DEFER bucket. Don't introduce new BRAND.semantic.* fields — that's slice 37's call.

6. **Test discipline.** Add ONE new mode-awareness test per file that has an existing test file. Do NOT add new test files for sources that don't have one — backfill is out of scope.

7. **Visual drift is expected.** `#807a72` → `#6b5e52` (text.muted), `#f0eee5` → `#f7efe2` (bg.subtle), `#d8d4c9` → `#e8d8c2` (border.default) are intentional brand-cream-warming shifts from slice 32. Small visual delta is the point.

8. **MetricCardShell ships as a half-migration.** It's mostly deferred. The top-of-file JSDoc note (Task 5 Step 3) is mandatory — it's the breadcrumb for confused future readers.

9. **`apps/` and route shells need NO changes.** Verify with `git diff master --name-only -- apps/` at the end (Task 8 Step 3). If any apps/ files appear, something has drifted.

10. **Atomic commits per task.** Slice 33 Gotcha #23 applies: don't leave the tree in a broken state between tasks. Each task's commit should leave `pnpm -r typecheck` green and `pnpm test` green.

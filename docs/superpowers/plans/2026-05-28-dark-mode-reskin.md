# Slice 40 — Dark mode reskin (palette + portrait) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the heuristic warm-brown dark palette with a cohesive cool-slate + slate-blue dark theme, plus give BioPortrait a dedicated mode-aware `semantic.portrait` token surface. Light mode untouched.

**Architecture:** Two-layer token change. (1) Palette: new `portrait` block in both modes + replace dark `surface.*` + `border.*` + `accent.*` values with cool slate / slate-blue derivatives. (2) Semantic: pipe palette `portrait` through `semantic.portrait.gradient/initials`. BioPortrait is the only component that reads new tokens; every other consumer of `semantic.bg.*` / `semantic.accent.*` automatically picks up the new dark values through Context.

**Tech Stack:** TypeScript strict + `exactOptionalPropertyTypes`, vitest, React Native + react-native-web (BioPortrait pattern from slice 33). Brand tokens consumed via `useBrandTokens()`.

**Spec:** `docs/superpowers/specs/2026-05-28-dark-mode-reskin-design.md`

---

## Task 1: Add `portrait` palette block (both modes)

**Files:**
- Modify: `packages/ui-tokens/src/brand/palette.ts`
- Modify: `packages/ui-tokens/test/brand-palette.test.ts`

Pure addition. New `portrait` block under `BRAND_PALETTE.light` and `BRAND_PALETTE.dark` with light = brand orange + white initials, dark = sage + warm cream initials.

- [ ] **Step 1: Write the failing test**

Append to `packages/ui-tokens/test/brand-palette.test.ts` — inside the `describe('BRAND_PALETTE.light', ...)` block, before its closing `})`:

```ts
  it('exports the portrait block (light)', () => {
    expect(BRAND_PALETTE.light.portrait.gradient.from).toBe('#c46a2a')
    expect(BRAND_PALETTE.light.portrait.gradient.to).toBe('#e8a060')
    expect(BRAND_PALETTE.light.portrait.initials).toBe('#ffffff')
  })
```

And inside the `describe('BRAND_PALETTE.dark', ...)` block, before its closing `})`:

```ts
  it('exports the portrait block (dark)', () => {
    expect(BRAND_PALETTE.dark.portrait.gradient.from).toBe('#6b7a5d')
    expect(BRAND_PALETTE.dark.portrait.gradient.to).toBe('#9caa8e')
    expect(BRAND_PALETTE.dark.portrait.initials).toBe('#fff0dc')
  })
```

And inside the `describe('palette mode parity', ...)` block, before its closing `})`:

```ts
  it('light and dark have identical portrait keys', () => {
    expect(Object.keys(BRAND_PALETTE.light.portrait).sort())
      .toEqual(Object.keys(BRAND_PALETTE.dark.portrait).sort())
  })

  it('light and dark portrait.gradient share from/to keys', () => {
    expect(Object.keys(BRAND_PALETTE.light.portrait.gradient).sort())
      .toEqual(Object.keys(BRAND_PALETTE.dark.portrait.gradient).sort())
  })
```

- [ ] **Step 2: Run to verify fail**

Run: `pnpm --filter @chiaro/ui-tokens test -- brand-palette`
Expected: FAIL with `TypeError: Cannot read properties of undefined (reading 'gradient')` (4 failures: 2 value tests + 2 parity tests).

- [ ] **Step 3: Add palette blocks**

Edit `packages/ui-tokens/src/brand/palette.ts`.

Inside the `light:` object, AFTER the `link:` block (which ends at line 42 `},`) and BEFORE the closing `}` of `light` (line 43), append:

```ts
    portrait: {
      gradient: { from: '#c46a2a', to: '#e8a060' },
      initials: '#ffffff',
    },
```

Inside the `dark:` object, AFTER the `link:` block (which ends at line 81 `},`) and BEFORE the closing `}` of `dark` (line 82), append:

```ts
    portrait: {
      gradient: { from: '#6b7a5d', to: '#9caa8e' },
      initials: '#fff0dc',
    },
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @chiaro/ui-tokens test -- brand-palette`
Expected: PASS. New tests pass; all existing pass too (additive change preserves all prior values).

- [ ] **Step 5: Verify typecheck**

Run: `pnpm --filter @chiaro/ui-tokens typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/ui-tokens/src/brand/palette.ts packages/ui-tokens/test/brand-palette.test.ts
git commit -m "feat(ui-tokens): add portrait palette block (light + dark)

Slice 40 task 1. New BRAND_PALETTE.{light,dark}.portrait block with
mode-aware gradient.from/to + initials text color. Pure addition;
no existing values change. Sets up the semantic.portrait surface
that Task 2 will pipe through, and decouples BioPortrait from
semantic.link.fg (Task 3).

Light: orange gradient #c46a2a → #e8a060 + white initials.
Dark: sage gradient #6b7a5d → #9caa8e + cream initials #fff0dc.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Pipe `portrait` through semantic.ts

**Files:**
- Modify: `packages/ui-tokens/src/brand/semantic.ts`
- Modify: `packages/ui-tokens/test/brand-semantic.test.ts`

Add `portrait` to the semantic builder so consumers read `semantic.portrait.gradient.from/to` + `semantic.portrait.initials` instead of reaching for palette directly.

- [ ] **Step 1: Write the failing test**

Inside `describe('BRAND_SEMANTIC.light → palette references', ...)`, before its closing `})`:

```ts
  it('resolves portrait.gradient.from/to + initials (light)', () => {
    expect(BRAND_SEMANTIC.light.portrait.gradient.from).toBe('#c46a2a')
    expect(BRAND_SEMANTIC.light.portrait.gradient.to).toBe('#e8a060')
    expect(BRAND_SEMANTIC.light.portrait.initials).toBe('#ffffff')
  })
```

Inside `describe('BRAND_SEMANTIC.dark → palette references', ...)`, before its closing `})`:

```ts
  it('resolves portrait.gradient.from/to + initials (dark)', () => {
    expect(BRAND_SEMANTIC.dark.portrait.gradient.from).toBe('#6b7a5d')
    expect(BRAND_SEMANTIC.dark.portrait.gradient.to).toBe('#9caa8e')
    expect(BRAND_SEMANTIC.dark.portrait.initials).toBe('#fff0dc')
  })
```

Inside `describe('semantic parity between modes', ...)`, before its closing `})`:

```ts
  it('portrait keys are identical between modes', () => {
    expect(Object.keys(BRAND_SEMANTIC.light.portrait).sort())
      .toEqual(Object.keys(BRAND_SEMANTIC.dark.portrait).sort())
  })

  it('portrait.gradient keys are identical between modes', () => {
    expect(Object.keys(BRAND_SEMANTIC.light.portrait.gradient).sort())
      .toEqual(Object.keys(BRAND_SEMANTIC.dark.portrait.gradient).sort())
  })
```

- [ ] **Step 2: Run to verify fail**

Run: `pnpm --filter @chiaro/ui-tokens test -- brand-semantic`
Expected: FAIL with `Cannot read properties of undefined (reading 'gradient')` (4 failures).

- [ ] **Step 3: Add semantic block**

Edit `packages/ui-tokens/src/brand/semantic.ts`. Inside the `buildSemantic` return object, AFTER the existing `link:` block and BEFORE the closing `}` of the returned object, add:

```ts
    portrait: {
      gradient: { from: p.portrait.gradient.from, to: p.portrait.gradient.to },
      initials: p.portrait.initials,
    },
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @chiaro/ui-tokens test -- brand-semantic`
Expected: PASS (all new tests + all existing tests; semantic builder is now structurally complete).

- [ ] **Step 5: Verify workspace typecheck**

Run: `pnpm --filter @chiaro/ui-tokens typecheck`
Expected: PASS.

Run: `pnpm --filter @chiaro/officials-ui typecheck`
Expected: PASS (BrandSemantic type widening, no consumer broken yet).

- [ ] **Step 6: Commit**

```bash
git add packages/ui-tokens/src/brand/semantic.ts packages/ui-tokens/test/brand-semantic.test.ts
git commit -m "feat(ui-tokens): pipe portrait palette through semantic

Slice 40 task 2. New semantic.portrait.{gradient.from, gradient.to,
initials} block deriving directly from palette.portrait. Mode-aware
through the same buildSemantic(mode) pattern as every other semantic
group. Consumed by BioPortrait in Task 3.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: BioPortrait consumes `semantic.portrait`

**Files:**
- Modify: `packages/officials-ui/src/bio/BioPortrait.tsx`
- Modify: `packages/officials-ui/test/bio/BioPortrait.test.tsx`

Switch BioPortrait off `semantic.link.fg` (blue) and the hardcoded `#5b8de1` second stop. Read `semantic.portrait.gradient.from/to` for both stops and `semantic.portrait.initials` for the text color. Update the assertions that hard-pin blue hex strings.

- [ ] **Step 1: Update the failing test**

Replace the existing `'applies diagonal blue gradient on web when portrait missing'` test in `packages/officials-ui/test/bio/BioPortrait.test.tsx` with a mode-aware pair. Remove this test (lines 31-38):

```tsx
  it('applies diagonal blue gradient on web when portrait missing', () => {
    const { container } = render(<BioPortrait fullName="Nancy Pelosi" portraitUrl={null} size={72} />)
    // Outer wrapper is the raw <div> that carries the CSS gradient.
    const outer = container.firstElementChild as HTMLElement | null
    expect(outer).not.toBeNull()
    const bg = outer?.getAttribute('style') ?? ''
    expect(bg).toMatch(/linear-gradient\(135deg, #3b6ed1 0%, #5b8de1 100%\)/)
  })
```

Replace with these three:

```tsx
  it('applies light-mode orange gradient on web when portrait missing', () => {
    const { container } = render(
      <BioPortrait fullName="Nancy Pelosi" portraitUrl={null} size={72} />,
      { wrapper: lightWrapper },
    )
    const outer = container.firstElementChild as HTMLElement | null
    const bg = outer?.getAttribute('style') ?? ''
    expect(bg).toMatch(/linear-gradient\(135deg, #c46a2a 0%, #e8a060 100%\)/)
  })

  it('applies dark-mode sage gradient on web when portrait missing', () => {
    const { container } = render(
      <BioPortrait fullName="Nancy Pelosi" portraitUrl={null} size={72} />,
      { wrapper: darkWrapper },
    )
    const outer = container.firstElementChild as HTMLElement | null
    const bg = outer?.getAttribute('style') ?? ''
    expect(bg).toMatch(/linear-gradient\(135deg, #6b7a5d 0%, #9caa8e 100%\)/)
  })

  it('initials text uses semantic.portrait.initials (light = white, dark = cream)', () => {
    const { rerender, getByText } = render(
      <BioPortrait fullName="Nancy Pelosi" portraitUrl={null} size={72} />,
      { wrapper: lightWrapper },
    )
    const lightStyle = (getByText('NP') as HTMLElement).getAttribute('style') ?? ''
    expect(lightStyle).toMatch(/color:\s*(?:#ffffff|rgb\(255,\s*255,\s*255\))/i)

    rerender(<BioPortrait fullName="Nancy Pelosi" portraitUrl={null} size={72} />)
    // Re-render under dark wrapper through fresh render (rerender preserves wrapper)
    const dark = render(
      <BioPortrait fullName="Nancy Pelosi" portraitUrl={null} size={72} />,
      { wrapper: darkWrapper },
    )
    const darkStyle = (dark.getByText('NP') as HTMLElement).getAttribute('style') ?? ''
    expect(darkStyle).toMatch(/color:\s*(?:#fff0dc|rgb\(255,\s*240,\s*220\))/i)
  })
```

- [ ] **Step 2: Run to verify fail**

Run: `pnpm --filter @chiaro/officials-ui test -- BioPortrait`
Expected: FAIL. The light gradient test fails because BioPortrait still emits `#3b6ed1 → #5b8de1` (link blue); the dark test fails similarly; the initials test fails because color is `semantic.text.onAccent` not `semantic.portrait.initials`.

- [ ] **Step 3: Update BioPortrait component**

Edit `packages/officials-ui/src/bio/BioPortrait.tsx`. Replace lines 20-27 (the body up to the `if (portraitUrl)` early return):

```tsx
export function BioPortrait({ fullName, portraitUrl, size }: BioPortraitProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const portraitSolid = semantic.link.fg
  const portraitGradient = useMemo(
    // #5b8de1 derived from link.fg; slice 38+ may centralize gradient derivation
    () => `linear-gradient(135deg, ${semantic.link.fg} 0%, #5b8de1 100%)`,
    [semantic.link.fg],
  )
```

With:

```tsx
export function BioPortrait({ fullName, portraitUrl, size }: BioPortraitProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  // Mode-aware portrait: light = brand orange, dark = sage. Centralized
  // via semantic.portrait (slice 40) — decoupled from semantic.link.fg.
  const portraitSolid = semantic.portrait.gradient.from
  const portraitGradient = useMemo(
    () =>
      `linear-gradient(135deg, ${semantic.portrait.gradient.from} 0%, ${semantic.portrait.gradient.to} 100%)`,
    [semantic.portrait.gradient.from, semantic.portrait.gradient.to],
  )
```

Then find the initials Text element (line 61) and replace `semantic.text.onAccent` with `semantic.portrait.initials`:

```tsx
      <Text style={{ color: semantic.portrait.initials, fontWeight: '700', fontSize: size * 0.42 }}>
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @chiaro/officials-ui test -- BioPortrait`
Expected: PASS — all 8 BioPortrait tests pass (5 existing + 3 new).

- [ ] **Step 5: Verify typecheck**

Run: `pnpm --filter @chiaro/officials-ui typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/officials-ui/src/bio/BioPortrait.tsx packages/officials-ui/test/bio/BioPortrait.test.tsx
git commit -m "feat(officials-ui): BioPortrait reads semantic.portrait

Slice 40 task 3. BioPortrait gradient + initials text now read
semantic.portrait.* (mode-aware) instead of semantic.link.fg + a
hardcoded #5b8de1 stop. Closes the slice-38+ TODO comment about
centralizing gradient derivation.

Light mode unchanged visually (orange #c46a2a → #e8a060). Dark mode
flips from blue-derived to sage #6b7a5d → #9caa8e with cream initials
#fff0dc (the user-locked decisions from the slice 40 visual brainstorm).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Update dark `surface.*` to cool slate

**Files:**
- Modify: `packages/ui-tokens/src/brand/palette.ts`
- Modify: `packages/ui-tokens/test/brand-palette.test.ts`
- Modify: `packages/ui-tokens/test/brand-semantic.test.ts`

Cascade dark surface tokens from warm brown to cool slate family. Update the existing palette test assertions + the semantic test that pins `bg.app === '#1a1410'`.

- [ ] **Step 1: Update palette test assertions**

In `packages/ui-tokens/test/brand-palette.test.ts`, find the test `'uses deep-warm surface (no neutral grays)'` (around line 64) and replace its body:

```ts
  it('uses cool slate surface (slice 40 reskin)', () => {
    expect(BRAND_PALETTE.dark.surface.base).toBe('#16181c')
    expect(BRAND_PALETTE.dark.surface.card).toBe('#1e2126')
    expect(BRAND_PALETTE.dark.surface.elevated).toBe('#262a30')
    expect(BRAND_PALETTE.dark.surface.subtle).toBe('#1c1e2270')
  })
```

The test name + body change together. Notice we now also assert `surface.subtle` explicitly (the original only covered base/card/elevated).

- [ ] **Step 2: Update semantic test assertion**

In `packages/ui-tokens/test/brand-semantic.test.ts`, find the `'resolves bg.app to dark surface.base'` test and replace its body:

```ts
  it('resolves bg.app to dark surface.base (cool slate)', () => {
    expect(BRAND_SEMANTIC.dark.bg.app).toBe('#16181c')
  })
```

- [ ] **Step 3: Run to verify fail**

Run: `pnpm --filter @chiaro/ui-tokens test`
Expected: 2 failures — palette test expects `#16181c` but palette still returns `#1a1410`; semantic test fails similarly.

- [ ] **Step 4: Update palette values**

Edit `packages/ui-tokens/src/brand/palette.ts`. Find the dark surface block (lines 52-57) and replace:

```ts
    surface: {
      base:     '#1a1410',   // app background
      card:     '#2a221c',   // card / panel
      elevated: '#3a2e26',   // modal, popover
      subtle:   '#22191344', // sub-card / hover (rgba over base)
    },
```

With:

```ts
    surface: {
      base:     '#16181c',   // app background — slice 40 cool slate
      card:     '#1e2126',   // card / panel — slice 40 cool slate +luminance
      elevated: '#262a30',   // modal, popover — slice 40 cool slate ++luminance
      subtle:   '#1c1e2270', // sub-card / hover — 4-byte rgba over base
    },
```

- [ ] **Step 5: Run to verify pass**

Run: `pnpm --filter @chiaro/ui-tokens test`
Expected: PASS.

- [ ] **Step 6: Verify workspace typecheck**

Run: `pnpm --filter @chiaro/officials-ui typecheck && pnpm --filter @chiaro/web typecheck && pnpm --filter @chiaro/mobile typecheck`
Expected: PASS (token value change, type unchanged).

- [ ] **Step 7: Commit**

```bash
git add packages/ui-tokens/src/brand/palette.ts packages/ui-tokens/test/brand-palette.test.ts packages/ui-tokens/test/brand-semantic.test.ts
git commit -m "feat(ui-tokens): dark surface cascade to cool slate

Slice 40 task 4. BRAND_PALETTE.dark.surface.{base,card,elevated,subtle}
cascades from the slice-33 warm brown family to a cool slate family.
Decided in the slice 40 visual brainstorm — cohesive temperature
across page bg + cards + elevated + hover surfaces.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Update dark `border.*` to cool slate

**Files:**
- Modify: `packages/ui-tokens/src/brand/palette.ts`
- Modify: `packages/ui-tokens/test/brand-palette.test.ts`

Cascade dark border tokens to cool slate equivalents (matches Task 4 family).

- [ ] **Step 1: Write the failing test**

In `packages/ui-tokens/test/brand-palette.test.ts`, inside `describe('BRAND_PALETTE.dark', ...)`, add (before the closing `})`):

```ts
  it('exports cool slate border tokens (slice 40 reskin)', () => {
    expect(BRAND_PALETTE.dark.border.default).toBe('#2a2d33')
    expect(BRAND_PALETTE.dark.border.strong).toBe('#3a3e45')
  })
```

- [ ] **Step 2: Run to verify fail**

Run: `pnpm --filter @chiaro/ui-tokens test -- brand-palette`
Expected: FAIL — palette still returns `#3a2e26` / `#4a3e35` warm browns.

- [ ] **Step 3: Update palette values**

Edit `packages/ui-tokens/src/brand/palette.ts`. Find the dark border block (lines 58-61) and replace:

```ts
    border: {
      default: '#3a2e26',
      strong:  '#4a3e35',
    },
```

With:

```ts
    border: {
      default: '#2a2d33',   // slice 40 cool slate equivalent
      strong:  '#3a3e45',   // slice 40 cool slate equivalent
    },
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @chiaro/ui-tokens test -- brand-palette`
Expected: PASS.

- [ ] **Step 5: Verify workspace typecheck**

Run: `pnpm --filter @chiaro/ui-tokens typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/ui-tokens/src/brand/palette.ts packages/ui-tokens/test/brand-palette.test.ts
git commit -m "feat(ui-tokens): dark border cascade to cool slate

Slice 40 task 5. BRAND_PALETTE.dark.border.{default,strong} follow
the surface cascade from Task 4. Same temperature family as the new
cool slate surfaces.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Rebuild dark accent ramp around slate-blue

**Files:**
- Modify: `packages/ui-tokens/src/brand/palette.ts`
- Modify: `packages/ui-tokens/test/brand-palette.test.ts`
- Modify: `packages/ui-tokens/test/brand-semantic.test.ts`

Replace all 7 dark accent stops with slate-blue equivalents. The dark `accent.500` (primary, CTA bg) changes from warm tan `#e8a060` to slate-blue `#374f68`; hover (`accent.400`), pressed (`accent.600`), accent.bg (`accent.100`), and other ramp stops all derive from the same slate-blue family.

- [ ] **Step 1: Update palette test assertions**

In `packages/ui-tokens/test/brand-palette.test.ts`, find the test `'saturates accent up (light orange becomes primary on dark)'` (around line 70) and replace its body:

```ts
  it('uses slate-blue accent ramp (slice 40 reskin)', () => {
    expect(BRAND_PALETTE.dark.accent[100]).toBe('#1a1f28')
    expect(BRAND_PALETTE.dark.accent[200]).toBe('#232a36')
    expect(BRAND_PALETTE.dark.accent[400]).toBe('#2e405a')
    expect(BRAND_PALETTE.dark.accent[500]).toBe('#374f68')
    expect(BRAND_PALETTE.dark.accent[600]).toBe('#485e76')
    expect(BRAND_PALETTE.dark.accent[700]).toBe('#6a7d96')
    expect(BRAND_PALETTE.dark.accent[900]).toBe('#ced8e4')
  })
```

The test name + body change together; we now assert all 7 stops explicitly (the original only covered 400/500).

- [ ] **Step 2: Update semantic test assertion**

In `packages/ui-tokens/test/brand-semantic.test.ts`, find the `'resolves accent.primary to dark accent.500 (saturated up)'` test and replace its body:

```ts
  it('resolves accent.primary to dark accent.500 (slate-blue)', () => {
    expect(BRAND_SEMANTIC.dark.accent.primary).toBe('#374f68')
  })
```

- [ ] **Step 3: Run to verify fail**

Run: `pnpm --filter @chiaro/ui-tokens test`
Expected: 2 failures — palette ramp still warm; semantic still resolves `#e8a060`.

- [ ] **Step 4: Update palette values**

Edit `packages/ui-tokens/src/brand/palette.ts`. Find the dark accent block (lines 62-70) and replace:

```ts
    accent: {
      100: '#2a1808',
      200: '#5a3814',
      400: '#c46a2a',   // hover (light-mode primary moves here)
      500: '#e8a060',   // PRIMARY ACCENT in dark
      600: '#f0b380',
      700: '#fbe1c8',
      900: '#fff0dc',
    },
```

With:

```ts
    accent: {
      100: '#1a1f28',   // slice 40 slate-blue dark (accent.bg surface)
      200: '#232a36',
      400: '#2e405a',   // hover (darker than primary in dark mode)
      500: '#374f68',   // PRIMARY ACCENT in dark (CTA bg) — slice 40
      600: '#485e76',   // pressed (lighter than primary in dark mode)
      700: '#6a7d96',
      900: '#ced8e4',   // slice 40 slate-blue lightest (was warm cream)
    },
```

- [ ] **Step 5: Run to verify pass**

Run: `pnpm --filter @chiaro/ui-tokens test`
Expected: PASS — all palette tests + all semantic tests pass.

- [ ] **Step 6: Run all officials-ui tests + verify typecheck**

Run: `pnpm --filter @chiaro/officials-ui test`
Expected: PASS. (Some components may visually shift in dark mode — that's the intended end-state — but no tests should break since none hard-pin the dark accent hex values.)

Run: `pnpm -r typecheck`
Expected: PASS across all 11 workspace projects.

- [ ] **Step 7: Commit**

```bash
git add packages/ui-tokens/src/brand/palette.ts packages/ui-tokens/test/brand-palette.test.ts packages/ui-tokens/test/brand-semantic.test.ts
git commit -m "feat(ui-tokens): dark accent ramp cascade to slate-blue

Slice 40 task 6. Full rebuild of BRAND_PALETTE.dark.accent.{100,200,
400,500,600,700,900} around the slice-40-locked #374f68 slate-blue
primary. Hover stays darker than primary (#2e405a), pressed stays
lighter (#485e76) — preserves the dark-mode convention. Tested 7
stops explicitly.

semantic.accent.primary in dark now resolves to #374f68 (was #e8a060
warm tan). Every consumer of semantic.accent.* automatically picks
up the slate-blue values through Context.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Update brand docs

**Files:**
- Modify: `docs/brand-book.md`
- Modify: `docs/brand-migration.md`

Refresh the brand documentation so future contributors see the slice-40 dark palette + the new `semantic.portrait` vocabulary entry. Implementer reads the docs first, then applies surgical updates.

- [ ] **Step 1: Read `docs/brand-book.md` and identify the dark palette section**

Search the file for `#1a1410` (the old dark `surface.base`). The hit lands in the dark mode palette table (likely §3 Palette per the file header in palette.ts source comments).

- [ ] **Step 2: Update dark palette tables in `docs/brand-book.md`**

Replace every occurrence of the old dark hex values with the slice-40 new values in the palette table(s):

| Old | New | Token |
|---|---|---|
| `#1a1410` | `#16181c` | `surface.base` (dark) |
| `#2a221c` | `#1e2126` | `surface.card` (dark) |
| `#3a2e26` | `#262a30` | `surface.elevated` (dark) |
| `#22191344` | `#1c1e2270` | `surface.subtle` (dark) |
| `#3a2e26` (second occurrence — border) | `#2a2d33` | `border.default` (dark) |
| `#4a3e35` | `#3a3e45` | `border.strong` (dark) |
| `#2a1808` | `#1a1f28` | `accent.100` (dark) |
| `#5a3814` | `#232a36` | `accent.200` (dark) |
| `#c46a2a` (in DARK rows only) | `#2e405a` | `accent.400` (dark) |
| `#e8a060` (in DARK rows only) | `#374f68` | `accent.500` (dark — PRIMARY) |
| `#f0b380` | `#485e76` | `accent.600` (dark) |
| `#fbe1c8` (in DARK rows only) | `#6a7d96` | `accent.700` (dark) |
| `#fff0dc` (in DARK rows only) | `#ced8e4` | `accent.900` (dark) |

**Important:** `#c46a2a`, `#e8a060`, `#fbe1c8`, `#fff0dc` ALSO appear in LIGHT mode rows in brand-book.md (light primary accent, etc.) — those occurrences must NOT change. Match the dark column only.

Append a new row to the dark palette table for the portrait block:

| Token | Value | Notes |
|---|---|---|
| `portrait.gradient.from` (dark) | `#6b7a5d` | sage start |
| `portrait.gradient.to` (dark) | `#9caa8e` | sage end |
| `portrait.initials` (dark) | `#fff0dc` | warm cream |

And to the light palette table:

| `portrait.gradient.from` (light) | `#c46a2a` | brand orange start |
| `portrait.gradient.to` (light) | `#e8a060` | brand orange end |
| `portrait.initials` (light) | `#ffffff` | pure white |

- [ ] **Step 3: Read `docs/brand-migration.md` and find the semantic vocabulary section**

This file documents the `COLORS.* → BRAND.semantic.*` migration vocabulary from slices 33-37. Find the section listing semantic token names.

- [ ] **Step 4: Append `semantic.portrait` vocabulary entry to `docs/brand-migration.md`**

After the last entry in the semantic vocabulary list, append:

```markdown
### `semantic.portrait` (slice 40)

Mode-aware portrait gradient + initials text for `BioPortrait`. Decouples portrait rendering from `semantic.link.fg` (the slice 33-37 derivation).

- `semantic.portrait.gradient.from` — gradient start hex
- `semantic.portrait.gradient.to` — gradient end hex
- `semantic.portrait.initials` — text color for initials fallback

Light mode: brand orange `#c46a2a → #e8a060` + white initials.
Dark mode: sage `#6b7a5d → #9caa8e` + warm cream initials `#fff0dc`.

Only consumer is `packages/officials-ui/src/bio/BioPortrait.tsx`. Native (no CSS gradient primitive) falls back to `gradient.from` as the solid color, same as the slice 33 pattern.
```

- [ ] **Step 5: Commit**

```bash
git add docs/brand-book.md docs/brand-migration.md
git commit -m "docs(slice-40): refresh palette tables + semantic.portrait vocabulary

Slice 40 task 7. brand-book.md gets the new dark palette values
(cool slate surfaces + slate-blue accent ramp + portrait block).
brand-migration.md gains the semantic.portrait vocabulary entry
following the existing slice-37 pattern.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Final verification + CLAUDE.md + mobile DoD

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/mobile-dod-checklist.md`

- [ ] **Step 1: Run full workspace typecheck**

Run: `pnpm -r typecheck`
Expected: PASS across all 11 workspace projects.

- [ ] **Step 2: Run full workspace tests**

Run: `pnpm test`
Expected: PASS for ui-tokens, officials-ui, and all other packages that don't require Supabase env vars. Integration tests requiring `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_ANON_KEY` may fail with the documented pre-existing skip (CLAUDE.md Testing section + Gotcha #1) — those are not slice 40 regressions.

- [ ] **Step 3: Run web build**

Run: `pnpm --filter @chiaro/web build`
Expected: PASS. Capture any bundle size deltas on `/officials/[id]` and `/state-officials/[id]` (the two routes that render BioPortrait); the only change should be the swapped hex string literals — bundle should be ~unchanged.

- [ ] **Step 4: Manual web smoke (Chrome)**

Verify in light mode:
- `/sign-in` — auth screen still cream-on-warm-brown (unchanged); BioPortrait nowhere on this surface, no regression possible.
- `/settings` — verify Theme row, light palette unchanged.
- `/officials/[any-bioguide]` — verify orange BioPortrait fallback gradient still renders for officials without `portrait_url`.

Toggle to dark mode:
- `/settings` — page bg now cool slate `#16181c`; card bg `#1e2126`; Calibrate-style buttons slate-blue.
- `/officials/[any-bioguide]` — BioPortrait shows sage gradient + cream initials.
- Verify no obvious visual regressions: text contrast on cards, hover states on links/buttons, alert tints (danger/warning/success), focus rings.

Record any visual bug for follow-up.

- [ ] **Step 5: Update CLAUDE.md**

Open `CLAUDE.md`, find the "Slices delivered" section. After the last existing slice entry (likely slice 39 + follow-ups), before "Specs live in...", append:

```markdown
- **Slice 40 — Dark mode reskin (palette + portrait)** (2026-05-28): Compressed-to-Mega-Slice (~10 files). Replaces the slice 33-37 heuristic dark palette (warm-brown family) with a cohesive cool-slate-and-slate-blue dark theme. Light mode unchanged. **Dark mode changes**: `bg.app` #1a1410 → #16181c cool slate; `bg.card` #2a221c → #1e2126; `bg.elevated` #3a2e26 → #262a30; `bg.subtle` #22191344 → #1c1e2270; `border.default` #3a2e26 → #2a2d33; `border.strong` #4a3e35 → #3a3e45; full `accent.*` ramp rebuilt around slate-blue `#374f68` primary (was warm tan `#e8a060`). **New token surface**: `semantic.portrait.{gradient.from, gradient.to, initials}` — mode-aware, replaces BioPortrait's slice-33 derivation from `semantic.link.fg`. Light portrait stays brand orange `#c46a2a → #e8a060` + white initials; dark portrait shifts to sage `#6b7a5d → #9caa8e` + warm cream initials `#fff0dc`. Closes slice 38+ reskin roadmap decisions #1 (link blue — kept as anchor) and #3 (BioPortrait gradient — rebased to mode-aware). Other roadmap decisions (AlignmentChip tiers, industry rainbow, finance green, MetricCardShell retune) remain queued. Decided across 10+ visual companion iterations. **Accepted trade-off**: portrait initials `#fff0dc` cream on the bright sage gradient corner gives ~2.5:1 contrast (AA-large pass, AA-normal fail) — documented in spec §7.1, future a11y audit may revisit.
```

- [ ] **Step 6: Update mobile DoD checklist**

Open `docs/superpowers/mobile-dod-checklist.md` and append:

```markdown
## Slice 40 — Dark mode reskin

- [ ] Light mode unchanged: BioPortrait orange gradient, link blue, brand-orange CTA buttons.
- [ ] Dark mode toggle → page bg becomes cool slate (not warm brown).
- [ ] Dark mode card bg + elevated surfaces are cool slate equivalents (no warm-brown card islands floating on cool bg).
- [ ] BioPortrait dark fallback gradient is sage (#6b7a5d → #9caa8e), not blue.
- [ ] BioPortrait initials in dark are warm cream (#fff0dc), not white or dark ink.
- [ ] CTA buttons (Calibrate, Sign in, etc.) in dark use slate-blue (#374f68), not warm tan orange.
- [ ] Hover/pressed states stay in the slate-blue family (no orange flash).
- [ ] Alert tints (danger red, warning amber, success green) unchanged in dark.
- [ ] Link blue (#7a98e1) unchanged in dark.
```

- [ ] **Step 7: Final commit**

```bash
git add CLAUDE.md docs/superpowers/mobile-dod-checklist.md
git commit -m "docs(slice-40): record slice 40 closeout

Slice 40 task 8. CLAUDE.md gets the Slices delivered entry covering
the dark mode reskin (cool slate cascade + slate-blue accent ramp +
mode-aware semantic.portrait). Mobile DoD checklist gains the slice
40 smoke section.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 8: Final summary to user**

Report:
- Commits on branch `slice-40-dark-mode-reskin`: 1 (spec) + 1 (plan) + 8 (task commits) = 10 total.
- Files changed: 6 src/test + 2 brand docs + 2 final docs = 10.
- Test delta: ~6 new palette/semantic tests + ~3 new BioPortrait tests + ~5 updated assertions.
- Smoke status: web walked, mobile DoD checklist captured (on-device deferred per slice-5+ pattern).
- Bundle: web `/officials/[id]` + `/state-officials/[id]` sizes pre/post (expected near-unchanged).

---

## Self-review notes

**Spec coverage:**
- §5.1 + §5.4 semantic portrait block → Task 2. ✅
- §5.2 dark palette surface/border/accent → Tasks 4/5/6. ✅
- §5.3 light palette portrait block → Task 1. ✅
- §5.5 BioPortrait component → Task 3. ✅
- §6 cross-platform (web gradient via createElement, native solid fallback) → preserved in Task 3 — only the source of the colors changes, not the rendering pattern. ✅
- §7 risk #1 (portrait initials AA-borderline contrast) → documented in CLAUDE.md slice 40 entry (Task 8). ✅
- §8.1 palette tests → Tasks 1/4/5/6. ✅
- §8.2 semantic tests → Tasks 2/4/6. ✅
- §8.3 BioPortrait tests → Task 3. ✅
- §9 file count = 10 → Tasks span exactly those 10 files. ✅
- §10 closeout criteria → Task 8 Steps 1-4 walk all of them. ✅

**Placeholder scan:** none. Every step has runnable code or exact commands. The brand-book.md hex replacement table in Task 7 Step 2 is the most fragile — explicitly calls out which color hexes appear in both light and dark rows and need careful column-matching.

**Type consistency:**
- `semantic.portrait.gradient.from/to` + `semantic.portrait.initials` consistent across Tasks 1, 2, 3.
- Hex values consistent: light orange `#c46a2a → #e8a060` + white `#ffffff`; dark sage `#6b7a5d → #9caa8e` + cream `#fff0dc`; dark CTA `#374f68` + cream CTA text `#fff0dc`.
- Test names + values align: each updated test in Tasks 4/5/6 renames the test to mention `(slice 40 reskin)` so future readers know the assertion was deliberately changed.

**Scope check:** single subsystem (dark palette + BioPortrait). Not decomposable.

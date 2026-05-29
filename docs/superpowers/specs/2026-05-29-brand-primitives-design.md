# Slice 45 — Brand primitives

**Status:** Approved 2026-05-29
**Tier:** Mega Slice (~21 files)
**Branch:** `slice-45-brand-primitives`

---

## 1. Goal

Build the 5 foundational brand primitives missing from `@chiaro/officials-ui` — `BrandButton`, `BrandHeading`, `BrandBodyText`, `BrandLink`, `BrandAlert` — and retune `BRAND_PALETTE.alert.*` from slice 32's generic red/amber/teal/peach to a slice 41/42-aligned brand-family palette (burgundy / gold / emerald / terracotta).

The primitives unblock slices 46-48 (the F1 + F2 page rewrites from the slice 44 audit). Without them, every un-migrated page rewrite is bespoke — drop-in primitives are the architectural piece that lets the audit findings cascade.

Closes slice 44 audit finding **F5** (missing brand primitives). Provides the foundation for slice 47 (web F1 page rewrites) + slice 48 (mobile F2 screen rewrites).

## 2. Non-goals

- **No F1/F2 page rewrites.** Slice 45 ships the primitives; slices 47-48 use them. Trying to bundle even one F1 page rewrite into slice 45 explodes the scope.
- **No F3 BrandStack mobile nav theming.** Tracked as audit follow-up; ships independently.
- **No F4 inline-hex sweep across the other 8 hex literals** (PillChevron, EvidenceExpand, DistrictBadge, Logo native fallback). Slice 46 owns those.
- **EXCEPTION — AuthForm `#fef2f0` inline literal IS in scope.** Slice 45 retunes `BRAND_PALETTE.light.alert.danger.bg` from `#fdf2f0` to a brand-family burgundy bg. AuthForm's hardcoded `#fef2f0` literal would go stale — must consume `semantic.alert.danger.bg` instead.
- **No new typography/spacing/radii tokens.** Existing `BRAND_TYPE` h1/h2/h3 + `BRAND_RADII` md/xl + `BRAND_SPACE.{1,2,3,4}` are sufficient.
- **No icon library.** The 4 alert icons (`!`, `✓`, `i`) ship as text glyphs inside a circular bg. Sufficient for v1; future slices can swap to SVG icons.
- **No state-officials/federal-officials surface changes.** Detail surfaces are slice 33-43 complete; primitives are forward-only.

## 3. User stories

**As a developer writing a new screen,**
I can compose `<BrandButton variant="primary">Save</BrandButton>`, `<BrandHeading level={1}>Settings</BrandHeading>`, `<BrandBodyText>...</BrandBodyText>`, `<BrandLink href="/x">tag</BrandLink>`, and `<BrandAlert severity="danger" title="...">...</BrandAlert>` from a single barrel without manually wiring `useBrandTokens()` or inline styles. The primitives auto-cascade light/dark via the slice 38 mode toggle.

**As a developer running the F1 web page rewrites in slice 47,**
I can rewrite `apps/web/app/profile/edit/page.tsx` as a declarative composition: `BrandHeading + BrandTextInput + BrandTextInput + BrandAlert + BrandButton`. No HTML element wrangling, no inline hex.

**As a user toggling dark mode,**
every primitive repaints automatically — buttons swap from brand orange to slate-blue, headings swap text color, alerts swap to cool-slate cards with brand-family bands, links swap to brighter slate-blue.

**As a user with a screen reader,**
buttons get `accessibilityLabel`, headings get `accessibilityRole='header'` + `accessibilityLevel={N}`, links get smart-anchor `<a href>` semantics on web, alerts get `role='alert'`.

## 4. Locked decisions

All visual decisions finalized 2026-05-29 across 7 visual companion screens (catalog v1 → v2 with line-height fix + 3 alert intensities → 5 alert variants → 5 V3+V5 hybrids → 12 band variants → 10 V5-deeper band styles → 10 pill geometry variants → P1 vs P2 full matrix → final lock).

### 4.1 BrandButton

```tsx
<BrandButton
  variant="primary" | "secondary"     // default: "primary"
  size="sm" | "default" | "lg"        // default: "default"
  disabled?: boolean
  onPress: () => void
  accessibilityLabel?: string
>
  {children}
</BrandButton>
```

**Sizing:**
- `sm`: height 32px, padding-x 12px, font-size 13px
- `default`: height 40px, padding-x 18px, font-size 14px
- `lg`: height 48px, padding-x 22px, font-size 15px

**Visual treatment:**
- Primary: `backgroundColor: semantic.accent.primary`, `color: semantic.text.onAccent`
- Secondary: `backgroundColor: 'transparent'`, `borderWidth: 1`, `borderColor: semantic.accent.primary`, `color: semantic.accent.primary`
- Disabled: `opacity: 0.4`, `cursor: 'not-allowed'` (web)
- Hover (web only): primary → `accent.pressed`; secondary → `accent.bg` tint
- All variants: `borderRadius: 6` (BRAND_RADII.md), `fontFamily: BRAND_TYPE_FAMILY`, `fontWeight: 600`

### 4.2 BrandHeading

```tsx
<BrandHeading
  level={1 | 2 | 3}                   // required
  color?: string                       // override default text.primary
>
  {children}
</BrandHeading>
```

**Sizing (from BRAND_TYPE):**
- `1`: 28px / line-height 1.2 / tracking -0.015em / weight 700
- `2`: 22px / line-height 1.25 / tracking -0.01em / weight 700
- `3`: 18px / line-height 1.3 / tracking -0.005em / weight 700

**Platform:**
- Web: `<h1>` / `<h2>` / `<h3>` HTML semantic (SEO + screen reader landmark)
- Native: `<Text accessibilityRole="header" accessibilityLevel={N}>`

Default color: `semantic.text.primary`.

### 4.3 BrandBodyText

```tsx
<BrandBodyText
  size="default" | "sm"               // default: "default"
  muted?: boolean                      // default: false
>
  {children}
</BrandBodyText>
```

**Sizing:**
- `default`: 15px / line-height 1.55 (Inter regular weight 400)
- `sm`: 13px / line-height 1.55 (Inter regular weight 400)

**Color:**
- Default: `semantic.text.body`
- `muted={true}`: `semantic.text.muted`

**Platform:** `<Text>` on both (semantic role: native paragraph text).

### 4.4 BrandLink

```tsx
<BrandLink
  href: string                         // required
  onPress?: () => void                // optional override (for routing)
  external?: boolean                   // skips smart-anchor interception
>
  {children}
</BrandLink>
```

**Visual:**
- `color: semantic.link.fg` (slice 40 `#3b6ed1` light / `#7a98e1` dark)
- `textDecoration: 'underline'`
- `fontWeight: 500`
- Inline rendering (no block-level wrapping)

**Smart-anchor pattern (slice 14 + 18 hoisted):**
- Web + `external !== true`: `createElement('a', { href, onClick })`. Plain left-clicks → `e.preventDefault()` + `onPress` (if provided) or `Linking.openURL(href)`. Modifier-key clicks (Cmd/Ctrl/Shift/middle) fall through to browser default → new tab, etc.
- Web + `external === true`: same `<a>` but with `target="_blank" rel="noopener noreferrer"`.
- Native: `<Pressable accessibilityRole="link" onPress={() => onPress?.() ?? Linking.openURL(href)}>` wrapping `<Text>`.

### 4.5 BrandAlert

```tsx
<BrandAlert
  severity="danger" | "warning" | "success" | "info"  // required
  title?: string
>
  {children}                           // body text
</BrandAlert>
```

**Layout (locked from final-lock screen):**
- Card: `borderRadius: 12` (BRAND_RADII.xl), `borderWidth: 1`, `borderColor: semantic.border.strong`, `backgroundColor: CATEGORY_CARD_BG` (slice 43 universal)
- Pill on left: 7px wide, fully rounded ends (`borderRadius: 999`), 6px inset from card edges (top + bottom + left padding)
- Icon circle: 18px × 18px, severity-colored bg, white glyph (`!` for danger/warning, `✓` for success, `i` for info), positioned inline before the title
- Title text: severity-colored, font-weight 700, font-size 12.5px
- Body text: `semantic.text.body`, font-size 12.5px, line-height 1.5
- Internal padding: 9-10px vertical, 12-14px horizontal

**Color palette (NEW — brand-family retune of BRAND_PALETTE.alert.*):**

Light mode:
| severity | bg (band+icon) | title fg | card bg | card border |
|---|---|---|---|---|
| danger | `#8a3a4d` (burgundy) | `#8a3a4d` | `#fffaf2` | `#d6c3a8` |
| warning | `#c89a4e` (gold) | `#7c5a1e` | `#fffaf2` | `#d6c3a8` |
| success | `#1a8f5a` (emerald) | `#0f5a4f` | `#fffaf2` | `#d6c3a8` |
| info | `#b86340` (terracotta) | `#7a3e23` | `#fffaf2` | `#d6c3a8` |

Dark mode (same band+icon hex per slice 41 single-hex collapse, brighter title for contrast):
| severity | bg (band+icon) | title fg | card bg | card border |
|---|---|---|---|---|
| danger | `#8a3a4d` | `#c89aa8` | `#2a2e34` | `#3a3e45` |
| warning | `#c89a4e` | `#e1c896` | `#2a2e34` | `#3a3e45` |
| success | `#1a8f5a` | `#7eb898` | `#2a2e34` | `#3a3e45` |
| info | `#b86340` | `#e0b8a0` | `#2a2e34` | `#3a3e45` |

Notice the dark title colors are exactly `SUB_CASCADE_ACCENT_DARK` values for the matching category — slice 41 cross-token consistency.

### 4.6 BRAND_PALETTE retune

`BRAND_PALETTE.light.alert` and `BRAND_PALETTE.dark.alert` are retuned to the values above. The slice 32 generic `alert.danger/warning/success.{fg,bg,border}` shape stays unchanged; only the hex values shift. Adds a NEW `alert.info` key (not in slice 32 baseline).

Existing consumers of `semantic.alert.success.fg` (6 sites — FederalSponsoredBillsList passed-bill status, etc.) update transparently: `#1f9b88` teal → `#1a8f5a` emerald. Visual delta: success indicators become emerald instead of teal — consistent with the slice 41 Finance category accent.

`semantic.alert.warning.fg` consumers (FederalEthicsAccountabilityCard compliance ≥50%, StateOfficialEventsList censure events) update: `#d68a1f` amber → `#c89a4e` gold. Less saturated, slice 41 Service Record family.

`semantic.alert.danger.fg` consumers (FederalEthicsAccountabilityCard compliance ≥0%, StateEthicsComplaintsList sanctioned status, StateOfficialEventsList expulsion+recall_succeeded, StateIssueVotesEvidence 'no' vote) update: `#a83a3a` red → `#8a3a4d` burgundy. Same hue family, deeper saturation.

### 4.7 AuthForm refactor (consumer cleanup)

`packages/officials-ui/src/auth/AuthForm.tsx:169` currently uses inline `backgroundColor: '#fef2f0'` for the error banner bg. This is the slice 32 `alert.danger.bg` literal. Post-slice-45 retune, this token shifts. Update AuthForm to consume `semantic.alert.danger.bg` via `useBrandTokens()`. Also a candidate to refactor to render via `<BrandAlert severity="danger">` directly, but that's outside slice 45 scope — slice 47+ can do that as part of the F1 rewrites.

## 5. Architecture / file plan

**~21 files. Mega Slice tier.**

### 5.1 Primitive source files (5)

1. **`packages/officials-ui/src/primitives/BrandButton.tsx`** — variant + size + disabled, accessibility, primary/secondary variants, mode-aware via `useBrandTokens()`.

2. **`packages/officials-ui/src/primitives/BrandHeading.tsx`** — level={1,2,3}, BRAND_TYPE-driven sizing, web `<h1/2/3>` + native accessibilityRole='header' + accessibilityLevel.

3. **`packages/officials-ui/src/primitives/BrandBodyText.tsx`** — size + muted, BRAND_TYPE.body / .bodySm sizing.

4. **`packages/officials-ui/src/primitives/BrandLink.tsx`** — smart-anchor pattern hoisted from slice 14 AlignmentChip + slice 18 hoists. semantic.link.fg.

5. **`packages/officials-ui/src/primitives/BrandAlert.tsx`** — P2 pill design, severity-keyed palette via new `semantic.alert.{danger,warning,success,info}.{bg,fg,band,iconGlyph,titleFg}` derived shape.

### 5.2 Primitive test files (5)

6. **`packages/officials-ui/test/primitives/BrandButton.test.tsx`** — render variant matrix; verify primary bg matches `accent.primary` rgb (RNW pattern); disabled state; onPress callback.

7. **`packages/officials-ui/test/primitives/BrandHeading.test.tsx`** — level renders correct h1/h2/h3 on web; native renders Text with accessibilityRole + accessibilityLevel.

8. **`packages/officials-ui/test/primitives/BrandBodyText.test.tsx`** — default vs sm size; muted color override.

9. **`packages/officials-ui/test/primitives/BrandLink.test.tsx`** — smart-anchor `<a href>` on web; modifier-key click falls through; native renders Pressable.

10. **`packages/officials-ui/test/primitives/BrandAlert.test.tsx`** — 4 severity variants render correct band + icon color; title vs body; aria-role.

### 5.3 Token retune (2)

11. **`packages/ui-tokens/src/brand/palette.ts`** — retune `BRAND_PALETTE.light.alert.{danger,warning,success}` + add `alert.info`. Mirror in `BRAND_PALETTE.dark.alert.*`. Comments document the slice 45 brand-family alignment.

12. **`packages/ui-tokens/src/brand/semantic.ts`** — add `info: { fg, bg, border }` to the `alert` shape build. The semantic shape already pipes alert.danger/warning/success through; info follows the same pattern.

### 5.4 Token tests (2)

13. **`packages/ui-tokens/test/brand-palette.test.ts`** — update existing alert.{danger,warning,success}.{fg,bg,border} hex assertions; add new alert.info.* assertions; add light + dark dark.

14. **`packages/ui-tokens/test/brand-semantic.test.ts`** — same updates for BRAND_SEMANTIC.

### 5.5 Barrel + consumer (2)

15. **`packages/officials-ui/src/index.ts`** — re-export 5 new primitives. Place under a new `// Slice 45: brand primitives` section.

16. **`packages/officials-ui/src/auth/AuthForm.tsx`** — replace inline `backgroundColor: '#fef2f0'` (line 169) with `semantic.alert.danger.bg` via `useBrandTokens()`.

### 5.6 Docs (3)

17. **`docs/brand-book.md`** — new §12 "Brand primitives (slice 45)" with the 5 primitive APIs + alert palette table.

18. **`docs/brand-migration.md`** — slice 45 entry covering: 5 new primitives, alert palette retune (slice 32 generic → slice 41/42 brand-family), AuthForm consumer migration, downstream slice cascade plan.

### 5.7 Closeout (2)

19. **`CLAUDE.md`** — slice 45 entry in Slices delivered, updates Gotcha #19f cross-reference (slice 14 smart-anchor pattern now lives in `BrandLink`).

20. **`docs/superpowers/mobile-dod-checklist.md`** — slice 45 section.

(Total: 5+5+2+2+2+3+2 = 21 files. Spec headline aligned at ~21.)

## 6. Cross-platform

- **Web + native via existing patterns.** `BrandButton`/`BrandHeading`/`BrandBodyText`/`BrandAlert` use `<View>` + `<Text>` + `<Pressable>` — RN + RNW identical paths. No createElement escape hatches.
- **BrandLink uses smart-anchor.** Web uses `createElement('a', ...)` (slice 14 pattern). Native uses `Pressable` wrapping `Text`.
- **BrandHeading uses createElement on web** for HTML semantic h1/h2/h3 (RNW renders `<Text accessibilityRole="header">` as a `<div>`, not `<hN>`).
- **Dark mode toggle (slice 38)** drives `useBrandTokens().mode` → all 5 primitives repaint via the same hook.

## 7. Risks

1. **Alert palette consumer behavior change.** 6 existing consumers of `semantic.alert.*.fg` will visibly swap colors:
   - "passed bill" indicators: teal `#1f9b88` → emerald `#1a8f5a` (slice 41 finance accent)
   - "sanctioned" / "expulsion" indicators: red `#a83a3a` → burgundy `#8a3a4d` (slice 42 alignment burgundy)
   - "censure" / "compliance warning" indicators: amber `#d68a1f` → gold `#c89a4e` (slice 41 Service Record accent)
   
   Visual delta is intentional — slice 45 cascades the slice 41 + 42 reskin into alert tokens. Gotcha #29 grep (Task 10 of plan) will catch any test pins.

2. **Smart-anchor pattern duplication.** Slice 14 AlignmentChip + slice 18 hoists already factor smart-anchor logic. Slice 45 introduces a 3rd consumer (`BrandLink`). YAGNI per CLAUDE.md style: `BrandLink` inlines its own copy of the smart-anchor pattern rather than blocking on a shared helper extraction. Existing AlignmentChip + 7 other slice-18 sites stay untouched. Future slice consolidates if a 4th consumer emerges — until then, 3 copies coexist as a documented duplication.

3. **AuthForm visual regression.** The error banner color (`#fef2f0` peach-pink) shifts to brand-family burgundy bg. May visibly differ from existing screenshots. Pre-flight grep confirmed only 1 hex-pin test assertion (auth tests use BRAND_PALETTE.alert.* references, not literals). Acceptable.

4. **BrandHeading SEO on web.** Slice 47 will use BrandHeading inside `apps/web/app/*` pages. The `<h1>` / `<h2>` / `<h3>` semantic must render correctly for SEO. Test coverage in Task 6 verifies the DOM element type per level.

5. **createElement web/native split for BrandHeading + BrandLink.** Two more files using Pattern A (slice 14 smart-anchor createElement). Already documented as a permanent pattern; no Gotcha update needed.

6. **6-character glyph icons in BrandAlert.** `!`, `✓`, `i` are text glyphs in a 18px circle. Cross-platform font rendering may differ slightly (especially `✓` U+2713). Accept as v1; SVG icon upgrade is future scope.

## 8. Testing

- **TDD per primitive task.** Write test → run RED → implement → run GREEN → commit.
- **`pnpm --filter @chiaro/officials-ui test`** — should grow from 456 to ~480 (+~5 tests per primitive × 5 primitives = ~25).
- **`pnpm --filter @chiaro/ui-tokens test`** — palette + semantic tests updated; net delta ~+4 (alert.info added; existing alert tests shift values).
- **`pnpm -r typecheck`** — must pass.
- **`pnpm --filter @chiaro/web build`** — should succeed; bundle delta expected ~+2-4 kB per primitive (~+10-20 kB total) for the 5 new components.
- **Visual smoke deferred** per slice 38-43 pattern. Slices 47-48 will exercise the primitives in real pages.

## 9. Surface (deliverables)

- 21 files changed: 5 primitive src + 5 primitive tests + 2 token src + 2 token tests + 1 barrel + 1 AuthForm consumer + 3 docs + 2 closeout.
- 5 new exports from `@chiaro/officials-ui`: `BrandButton`, `BrandHeading`, `BrandBodyText`, `BrandLink`, `BrandAlert`.
- 1 new exported palette key: `BRAND_SEMANTIC.alert.info.{fg,bg,border}`.
- 3 alert tokens retuned (danger/warning/success). 0 deletions.
- BrandLink inlines smart-anchor (3rd copy of the slice 14 + 18 pattern; YAGNI per Risk #2).
- 0 schema changes.
- 0 new dependencies.
- Test delta: ui-tokens +~4 (alert.info + retune); officials-ui +~25 (5 primitives × 5 tests).

## 10. Closeout

- Branch merged to master via `--no-ff` merge commit titled `Merge slice 45: brand primitives`.
- CLAUDE.md slice 45 entry shipped.
- Mobile DoD slice 45 section shipped.
- User memory gets `project_chiaro_slice45_brand_primitives.md` + 1-line MEMORY.md index.
- Audit doc at `docs/superpowers/audits/2026-05-29-comprehensive-ui-audit.md` stays as the prep record — slice 45 closes F5.

## 11. Unblocks / next steps

After slice 45:

| Slice | Scope | Tier |
|---|---|---|
| 46 | F4 inline-hex sweep (PillChevron + EvidenceExpand + DistrictBadge + Logo native fallback — 8 hex literals across 4 files) | Patch-Compressed |
| 47 | F1 web page rewrites (home, profile/edit, settings/address, settings/layout, officials/, not-found) using slice 45 primitives | Mega |
| 48 | F2 mobile screen rewrites (home, officials list, profile edit, settings address, _layout) + F3 BrandStack mobile nav theming | Mega |
| 49+ | Reskin roadmap #4 industry rainbow (last queued reskin item) | TBD |

After slice 48: the slice 33-43 design system cascade is complete across the full UI surface. The remaining queue item (#4 industry rainbow) is the last philosophy decision.

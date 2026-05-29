# Comprehensive UI audit — slice 33-43 direction

**Status:** Audit-tier (research). 2026-05-29. Branch: `slice-44-ui-audit`.

**Question:** Which UI surfaces have NOT been migrated to the slice 33-43 design system (BRAND tokens + dark mode + cool slate cascade + V2b cards + stripe pattern + declarative composition)? Where is inline hex still leaking? Which primitives are missing from `@chiaro/officials-ui`?

**Scope:** All TypeScript/TSX files under `apps/` + `packages/officials-ui/src/`. SQL, seed scripts, and Edge Functions excluded (no UI surface).

**Output:** Inventory + categorized findings + recommended slice 45+ scope. No code changes.

---

## 1. Executive summary

The slice 33-43 design system reskin landed in a layered way:

- **Slices 33-37 (foundation)** built the `BRAND` token surface + accessor hooks + dark variants
- **Slices 38-40 (toggle + reskin)** added the dark-mode toggle UI + the cool-slate dark palette + portrait gradient
- **Slices 41-43 (cards)** retoned the category palette + alignment chips + replaced gradients with the universal-bg + stripe pattern

The result is a **strong design-system core** in `packages/officials-ui/src/` for the officials-detail surfaces, but **un-migrated peripheral surfaces** in `apps/web/` and `apps/mobile/` that bypass the system entirely. Six findings, three priority tiers:

| # | Finding | Severity | Scope est. |
|---|---|---|---|
| F1 | Slice-1-era raw-HTML pages on web (no brand integration) | 🔴 High | 6 files, ~150 lines |
| F2 | Slice-1-era inline-style mobile screens (raw colors) | 🔴 High | 5 files, ~100 lines |
| F3 | Mobile Stack navigator headers use RN defaults, not slice 40 cool slate | 🟡 Medium | 2 layout files |
| F4 | 9 inline hex literals inside `@chiaro/officials-ui/src/` | 🟡 Medium | 5 files |
| F5 | Missing brand primitives (Button, Heading, Card, Text) | 🟡 Medium | Architectural |
| F6 | PillChevron `#f0eee5` known coincidental collision (slice 42 + 43 deferral) | 🟢 Low | 1 file |

## 2. The slice 33-43 baseline

What the design system gives you when you compose with it:

- `BRAND_SEMANTIC.{light,dark}.{bg,text,border,accent,alert,signal,link,portrait}` via `useBrandTokens()`
- Per-domain mode-aware accessor hooks: `usePartyColor`, `useAlignmentChipColors`, `useScorecardLeanColor`, `useCategoryAccent`, `useCategoryCardBg` (slice 43), `useIndustryColor`, `useFinanceSubSectionShade`, `useMapColors`
- Dark mode toggle: `BrandModeProvider` (slice 38), `BrandModeOverrideContext`, settings-level `BrandModeThemeRow`
- Declarative composition primitives: `AuthScreen`, `AuthForm`, `AuthInput`/`BrandTextInput`, `AuthWordmark`, `Logo`, `SettingsScreen`, `SettingsSection`, `SettingsRow` + 5 variants, `CalibrateScreen`
- Card primitives: `MetricCardShell`, `CardSubsection`, `ComingSoonCard`, `EvidenceExpand`, `PillChevron`
- Detail surfaces: 6 federal `Federal*Card` components, 6 state `State*Card` components, `BioHeader` + 4 bio sub-components, `OfficialsCard`, `OfficialsList`, `OfficialAvatar`, `DistrictBadge`, `PartyBadge`

What slice 33-43 did NOT build:

- `BrandPrimaryButton` / `BrandSecondaryButton` / `BrandIconButton`
- `BrandHeading` (h1/h2/h3 with locked typography)
- `BrandBodyText` / `BrandLink` / `BrandAlert`
- `BrandCard` (universal card surface — slice 43 came close with the stripe pattern but only for the 6 categories)

This omission is why the un-migrated surfaces have stayed un-migrated: there's no `<BrandPrimaryButton>` to drop into `apps/web/app/profile/edit/page.tsx` to replace the raw `<button type="submit">`.

## 3. Finding F1 — web pages still rendering raw HTML

**Files:**

| File | Lines | What it renders |
|---|---|---|
| `apps/web/app/page.tsx` | 30 | `<main>`, `<h1>`, `<p>`, `<a>`, `<form>`, `<button>` for home + sign-out |
| `apps/web/app/officials/page.tsx` | 15 | `<main>`, `<h1>` wrapper around `OfficialsListClient` |
| `apps/web/app/settings/layout.tsx` | 13 | `<main>`, `<nav>`, `<Link>`, `<h1>` |
| `apps/web/app/settings/address/page.tsx` | 75 | `<section>`, `<h2>`, `<form>`, `<input>`, `<button>` |
| `apps/web/app/profile/edit/page.tsx` | 46 | `<main>`, `<h1>`, `<form>`, `<input>`, `<button>` |
| `apps/web/app/not-found.tsx` | 8 | `<main>`, `<h1>`, `<p>`, `<a>` |

**Visual effect today:** The slice 38 follow-up patch (`230e7bd`) applied `semantic.bg.app` + `semantic.text.body` at the `<body>` level. So these pages do show the right page bg + text color. But every CHILD element (h1, h2, p, button, input, a) uses browser default styling:
- Text size + weight: browser default Times-ish for headings, default sans for body
- Buttons: native `<button>` rendering — browser-themed
- Inputs: native `<input>` — browser-themed
- Links: blue underlined (NOT slice 40 `semantic.link.fg`)
- No card containers — content sits directly on body bg without elevation

**Severity:** 🔴 High. These are production routes a user lands on regularly (`/`, `/officials`, `/profile/edit`, `/settings/address`, `/not-found`). The contrast with the polished slice 31/39/43 routes (auth, settings, officials/[id]) is visible.

**Recommended fix:** Each page rewritten as a shared `@chiaro/officials-ui` composition. Requires F5 primitives first (BrandPrimaryButton, BrandHeading, BrandBodyText) — without them, each rewrite is bespoke.

## 4. Finding F2 — mobile slice-1-era screens with inline hex + raw colors

**Files:**

| File | Inline hex / raw colors | Slice-1 baseline tells |
|---|---|---|
| `apps/mobile/app/(app)/index.tsx` | `fontSize: 24` inline + raw `<Text>` styles, no `useBrandTokens()` | Slice 1 home screen, never migrated |
| `apps/mobile/app/(app)/officials/index.tsx` | Inline `fontSize: 24, fontWeight: '700'` on `<Text>` | Slice 3 list screen, never migrated |
| `apps/mobile/app/(app)/profile/edit.tsx` | `color: 'red'` raw color string | Slice 1 profile edit, never migrated |
| `apps/mobile/app/(app)/settings/address.tsx` | **6 inline hex literals**: `#888` border, `#5b6cff` button bg, `#666` muted text, `#d85c5c` error | Slice 5A address edit, never migrated |
| `apps/mobile/app/(app)/_layout.tsx` | `<Stack screenOptions={{ headerShown: true }}>` — uses RN/Expo defaults | Slice 1 layout, never migrated |

**Severity:** 🔴 High. The slice 1 inline-styles bypass `useBrandTokens()` entirely → dark mode toggle does NOT repaint these screens. User toggling Dark from the settings screen lands back on home with a white/cream body but a Stack header that's still RN-default-white. Same issue on `/settings/address` — button stays slate-blue `#5b6cff` (a token from slice 32 era), error text stays raw red `#d85c5c`, regardless of mode.

**Recommended fix:** Migrate each screen to consume the slice 33-43 primitives. `apps/mobile/app/(app)/settings/address.tsx` is the most egregious — 6 inline hex literals + no token consumption. Fix order: layouts first (Stack screen options + nav theming), then individual screens.

## 5. Finding F3 — mobile Stack navigator uses RN defaults

**Files:**
- `apps/mobile/app/(app)/_layout.tsx:41` — `<Stack screenOptions={{ headerShown: true }} />`
- `apps/mobile/app/(app)/settings/_layout.tsx:5` — `<Stack screenOptions={{ headerTitle: 'Settings' }}>`

The Stack navigator's `screenOptions` are not theming the header bg / title color / back arrow. RN/Expo defaults apply: white header bg + dark text on iOS, gray-themed Material header on Android. Neither matches slice 40 cool slate dark or slice 32 brand cream light.

**Severity:** 🟡 Medium. Affects every mobile route. The fix is one `screenOptions` extension that reads from `useBrandTokens()` and passes through `headerStyle: { backgroundColor: semantic.bg.card }`, `headerTintColor: semantic.text.body`, etc.

**Recommended fix:** A `BrandStack` wrapper component in `@chiaro/officials-ui` (or `apps/mobile/lib/`) that consumes `useBrandTokens()` + spreads brand-themed `screenOptions`. Mobile `_layout.tsx` files replace `<Stack>` with `<BrandStack>`.

## 6. Finding F4 — 9 inline hex literals in @chiaro/officials-ui/src/

Despite slice 34's inline-hex sweep + slice 42's ComplianceIcon refactor, 9 hex literals remain inside the shared component package:

| File:line | Hex | What it styles | Likely replacement |
|---|---|---|---|
| `auth/AuthForm.tsx:169` | `#fef2f0` | error banner bg | `semantic.alert.danger.bg` |
| `cards/PillChevron.tsx:16` | `#f0eee5` | bg | New `semantic.bg.subtle` or generic chevron pill token |
| `cards/PillChevron.tsx:21` | `#1a1714` | text | `semantic.text.primary` (same as `BRAND_PALETTE.light.ink[1000]`) |
| `Logo.tsx:136` | `#e8a060` | native fallback fill | `BRAND_PALETTE.light.accent[400]` |
| `cards/EvidenceExpand.tsx:25` | `#d8d4c9` | borderTopColor | `semantic.border.default` |
| `cards/EvidenceExpand.tsx:34` | `#1a1714` | text color | `semantic.text.primary` |
| `cards/EvidenceExpand.tsx:51` | `#1a1714` | text color | `semantic.text.primary` |
| `cards/DistrictBadge.tsx:49` | `#d13b3b` | SVG fill (warning/red marker?) | `semantic.alert.danger.fg` or party-R |
| `cards/DistrictBadge.tsx:52` | `#3a352b` | text | `BRAND_PALETTE.light.ink[700]` (`semantic.text.body`) |

**Severity:** 🟡 Medium. All 9 are inside the shared package — invisible to consumers but block the dark-mode + reskin cascade. Notably:
- `PillChevron` and `EvidenceExpand` are slice 4-era components used INSIDE the slice 33-43 cards. They flip mode-unaware behavior into otherwise-mode-aware containers — broken dark mode for the chevron + evidence expand UI.
- `DistrictBadge` `#3a352b` text is a warm brown — will look fine in light but unreadable on cool-slate dark.

**Recommended fix:** A `BRAND_PALETTE` consumer pass on these 5 files. Each one is 3-5 lines. ~15 line changes total, ~5 files.

## 7. Finding F5 — missing brand primitives (architectural)

`@chiaro/officials-ui` lacks these foundational primitives:

| Missing primitive | Current state | Used by |
|---|---|---|
| `BrandPrimaryButton` | Raw `<button>` (web) or inline-styled `<Pressable>` everywhere | Home, profile/edit, settings/address, calibrate (twice — submit + GPS), sign-in, sign-up |
| `BrandSecondaryButton` | None — settings nav rows used as quasi-buttons | About-section refresh buttons (future) |
| `BrandHeading` (h1/h2/h3) | Raw `<h1>`/`<Text fontSize: 24>` everywhere | All un-migrated pages |
| `BrandBodyText` | Raw `<p>`/`<Text>` | All un-migrated pages |
| `BrandLink` | Raw `<a>`/`<Link>` (web) — slice 14 AlignmentChip has the smart-anchor pattern but it's not factored out | Home, settings/layout, not-found |
| `BrandAlert` | Inline-styled error `<Text role="alert">` in 4+ places | All form-bearing screens |

**Severity:** 🟡 Medium-blocking. Without these primitives, every F1/F2 page rewrite is bespoke — defeating the design-system pattern. Slice 31 (`AuthInput`) + slice 39 (`SettingsRow*`) hint at the architecture: declarative, mode-aware, cross-platform. Extending this catalog is the missing piece.

**Recommended fix:** Build the 4-5 primitives as a self-contained slice. Estimate: ~6-8 files, Compressed Slice tier. Once landed, slices 46-47 can sweep through F1 + F2 with mechanical rewrites.

## 8. Finding F6 — PillChevron `#f0eee5` coincidental collision (deferred)

Slice 42 + 43 both flagged this:
- Slice 42 noted PillChevron uses `#f0eee5` (was the slice 37 Mixed bg) as a generic expand-affordance pill. Not semantically alignment-related; coincidental collision.
- Slice 43 mentioned the migration to a brand token is a separate inline-hex cleanup task.

This is covered by F4's `PillChevron.tsx:16` line item. F6 is the same finding repeated for traceability of the slice 42 + 43 deferrals.

**Severity:** 🟢 Low. Already-tracked carry-over. Rolls up into F4 fix.

## 9. Non-findings (verified clean)

- **`BioPortrait` Pattern B createElement gradient** — verified at `bio/BioPortrait.tsx:27,42-49`. Still the only consumer of Gotcha #19f post-slice-43. Correctly preserved.
- **State officials page** — `apps/web/app/state-officials/[id]/page.tsx` is a thin server-component wrapper around `StateOfficialDetailPage` from `@chiaro/officials-ui`. Fully migrated.
- **Federal officials page** — same wrapper pattern, fully migrated.
- **Auth screens** — slice 31 + 33 + 41 + 42 retrofits applied. Fully migrated.
- **Calibrate screen** — slice 39 + follow-up. Fully migrated.
- **Settings screen** — slice 39. Fully migrated.
- **Web body bg + colorScheme** — slice 38 + follow-up patch. Renders `semantic.bg.app` + `semantic.text.body` at body level. Correct.
- **Web officials list** — `OfficialsListClient` wraps `OfficialsList` from the shared package. Fully migrated.
- **Legal pages** — slice 39 cleanup batch added them as `SettingsScreen` compositions. Fully migrated.
- **Test hex-pin discipline** — only 2 hex pins in officials-ui tests (`BrandTextInput.test.tsx:124-125`), both intentional consumer-side coverage of slice 40 border tokens. Not a Gotcha #29 risk.

## 10. Recommended scope for slice 45 (next slice)

The audit surfaces 3 natural slice-sized chunks:

### Option α — Primitives-first (highest leverage)
Build F5: `BrandPrimaryButton`, `BrandSecondaryButton`, `BrandHeading`, `BrandBodyText`, `BrandLink`, `BrandAlert`. Compressed-Slice tier (~6-8 files in `@chiaro/officials-ui/src/primitives/` + barrel + tests). After landing, slices 46-47 sweep F1 + F2 mechanically.

### Option β — F4 inline-hex cleanup (fastest)
Migrate the 9 hex literals across 5 officials-ui files to brand tokens. Patch-to-Compressed-Slice tier (~5 files, ~15 line changes). Closes a Gotcha #29 surface + brings PillChevron + EvidenceExpand into dark-mode coverage. Doesn't unblock the larger F1/F2 issue.

### Option γ — F3 mobile nav theming
Add `BrandStack` wrapper in `@chiaro/officials-ui` + retrofit `apps/mobile/app/(app)/_layout.tsx` + `(app)/settings/_layout.tsx`. Patch tier (~3 files). Fixes the headerShown white-bar issue but doesn't touch screens.

### Recommended order
1. **Slice 45**: Option α (primitives) — unblocks downstream rewrites
2. **Slice 46**: Option β (inline-hex sweep) — closes Gotcha #29 surface
3. **Slice 47**: F1 web page rewrites using the new primitives — Mega Slice
4. **Slice 48**: F2 mobile screen rewrites using the new primitives + Option γ nav theming — Mega Slice
5. **Slice 49+**: Reskin roadmap **#4 industry rainbow** (last queued reskin item)

This sequence respects the dependency graph (primitives → page rewrites) and progresses from low-blast-radius (inline-hex sweep) to high-blast-radius (full page rewrites).

## 11. Audit conclusions

- Slice 33-43 built a strong design-system core but stopped at the **officials-detail surfaces**. Peripheral surfaces (home, profile edit, settings address, not-found, mobile officials list) are still slice-1-era raw-HTML or inline-style code.
- The system's missing primitives (Button, Heading, Card, BodyText, Link, Alert) explain why these surfaces have stayed un-migrated — there's no clean component to drop in.
- 9 inline hex literals inside `@chiaro/officials-ui/src/` itself remain from slices 1-30 (pre-BRAND-system). These should be cleaned up at a Patch-Compressed-Slice cost.
- Mobile Stack navigator headers use RN/Expo defaults — visible against slice 40 cool slate dark + slice 32 cream light.
- The reskin roadmap closes with **#4 industry rainbow** as the only remaining philosophy decision. Once F1-F5 land, the slice 33-43 cascade is complete across the full UI surface.

## 12. Out of scope

- `apps/web/components/DistrictMap.tsx` + `apps/mobile/components/DistrictMap.tsx` — platform-specific map renderers. Use `useMapColors()` per slice 37; verified migrated.
- Edge Function logic (Deno) — no UI surface.
- Seed scripts (`packages/db/supabase/seed/`) — operator scripts, no UI.
- pgTAP tests — DB-only.
- Sentry telemetry surfaces — operator-side, no UI styling.
- Mobile app distribution (EAS build config) — separate concern.

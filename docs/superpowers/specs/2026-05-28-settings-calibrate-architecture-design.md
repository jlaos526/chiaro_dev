# Slice 39 — Settings architecture + Calibrate refactor

**Status:** Draft for review
**Date:** 2026-05-28
**Tier:** Mega-Slice (~24 files)
**Prerequisite slices:** 33 (BrandModeOverrideContext + auth screens), 38 (Dark mode toggle + body-style)
**Unblocks:** future settings entries (notifications, profile, legal), consistent account-flow visual rhythm

## 1. Goal

Replace the slice-1-era raw-HTML `/settings` and `/calibrate` pages with a production-ready, brand-tokened, cross-platform component architecture in `@chiaro/officials-ui`. Settings becomes a declarative composition of 5 sections × 7 row variants. Calibrate adopts the slice 33 auth-card aesthetic so account-flow surfaces share visual rhythm.

## 2. Non-goals

- **Real Profile / Notifications data.** Display name, Avatar, Push, Email toggles ship as disabled/coming-soon placeholders. Backing data is future scope.
- **Legal page content.** `/legal/privacy` and `/legal/terms` routes get TODO destinations from settings rows but aren't created in this slice.
- **About section richness.** MVP shows version string only. Build date / commit SHA / device info is future.
- **Mobile DoD on-device smoke.** Captured in checklist; deferred per slice-5/38 pattern.
- **/settings/address page redesign.** Stays at slice-1 era for this slice; redesign is follow-up.
- **CalibrateScreen on mobile.** Mobile already uses `(auth)` flow for first-time calibrate; mobile-side calibrate page wiring deferred unless a parallel mobile route exists. Verify during impl.

## 3. User stories

- A signed-in user opens Settings on web and sees 5 well-organized sections (Account, Appearance, Notifications, Profile, About) with consistent visual rhythm and full brand-token theming including dark mode.
- A signed-in user sees clearly which sections are interactive vs. placeholder (disabled toggles, "Coming soon" rows).
- A signed-in user navigating Settings on a fresh device after slice 38's toggle finds appearance preferences cleanly grouped with the rest of their account settings.
- A new user routed to /calibrate sees an inviting branded card matching the sign-in aesthetic — the flow feels like part of the same account setup, not a slice-1 placeholder.
- A developer building future settings entries imports `<SettingsNavRow>` / `<SettingsToggleRow>` / etc. and gets correct theming, accessibility, and cross-platform behavior without page-level styling work.

## 4. User-facing decisions captured during brainstorming

| Decision | Pick | Why |
|---|---|---|
| Scope | Full settings architecture | User chose Mega-Slice tier. Shared component system, not one-off page polish. |
| Visual style | iOS Settings-style card sections | Familiar; brand-tokens-friendly; matches existing officials-ui card aesthetic. |
| Section content (v1) | 5 sections | Account / Appearance / Notifications / Profile / About. Forward-looking placeholders for slices 40+. |
| Calibrate approach | Reuse AuthScreen card pattern | Parallel `<CalibrateScreen>`; both screens share viewport-fill, brand-bg, centered-card layout. |
| Inputs | Extract slice-31 AuthInput → BrandTextInput | Reusable for non-auth surfaces. Auth re-exports for back-compat. |

## 5. Architecture

### 5.1 New shared package surface

```
@chiaro/officials-ui/src/
  inputs/
    BrandTextInput.tsx          # ← extracted/renamed from auth/AuthInput.tsx
  auth/AuthInput.tsx            # ← becomes thin re-export of BrandTextInput
  calibrate/
    CalibrateScreen.tsx         # parallel to auth/AuthScreen.tsx
  settings/
    SettingsScreen.tsx          # viewport container + page title
    SettingsSection.tsx         # card-grouped section + optional header
    SettingsRow.tsx             # base row (rarely used directly)
    SettingsNavRow.tsx          # label + value + chevron → onPress
    SettingsActionRow.tsx       # label + onPress (with `danger` variant)
    SettingsToggleRow.tsx       # label + Switch
    SettingsValueRow.tsx        # label + read-only value
    SettingsComingSoonRow.tsx   # label + "Coming soon" pill
    brand-mode-theme-row.tsx    # ← existing slice 38 file
```

### 5.2 Web page glue

`apps/web/app/settings/page.tsx` and `apps/web/app/calibrate/page.tsx` become declarative compositions. Existing logic (sign-out, calibrate Edge Function invocation, error mapping) stays at the page level.

### 5.3 Mobile page glue

`apps/mobile/app/(app)/settings/index.tsx` mirrors the web composition. Mobile calibrate stays in scope only if a parallel mobile route exists — verify during impl; if not, mobile calibrate is a follow-up.

### 5.4 Architectural invariants

- **No router import in shared components.** Navigation via `onPress` / `onSubmit` / `onSkip` callbacks. Continues slice 10 convention.
- **No platform-specific JSX in component bodies.** Only RN primitives (`View`, `Text`, `Pressable`, `Switch`, `StyleSheet`, `Platform`). Web-specific HTML reaches code only through the `createElement('div'|'a', ...)` escape hatch per Gotcha #19f.
- **All theming via `useBrandTokens()`.** Slice 37 hooks (`useFinanceCardBg`, etc.) are NOT consumed here — this is generic settings chrome.
- **`SettingsScreen` does NOT include SafeAreaView.** Mobile pages handle that at glue layer.
- **`SettingsScreen` does NOT include a back button.** Browser back (web) / native header chrome (mobile) handle it.

## 6. Component contracts

### `<BrandTextInput>`

Extracted from `auth/AuthInput.tsx` (slice 31). Same floating-label-outlined behavior. `auth/AuthInput.tsx` becomes:

```tsx
export { BrandTextInput as AuthInput, type BrandTextInputProps as AuthInputProps } from '../inputs/BrandTextInput.tsx'
```

Zero API change for existing auth callsites.

### `<CalibrateScreen>`

```tsx
interface CalibrateScreenProps {
  title?: string              // default "Set your home location"
  description?: string        // default copy from current page
  initialAddress?: string
  onSubmit: (address: string) => Promise<void>   // throws on error
  onSkip?: () => void         // omit to hide the Skip link
  submitLabel?: string        // default "Calibrate"
  loadingLabel?: string       // default "Calibrating…"
}
```

Internal state: `address`, `loading`, `error`. On submit: calls `onSubmit(address)`, catches thrown errors → displays `error.message`. Page-level callsite owns Edge Function invocation + status-code → message mapping.

Visual: same shell as `<AuthScreen>` — viewport-fill outer with brand bg + centered max-width-400 card with elevated bg + 16px radius + warm shadow.

### `<SettingsScreen>`

```tsx
interface SettingsScreenProps {
  title?: string              // default "Settings"
  children: ReactNode         // sections
}
```

Renders:
- Brand-bg viewport-fill outer View (web: `Platform.OS === 'web' && { minHeight: '100vh' }`).
- Max-width 560px inner column, centered horizontally.
- `<h1>`-equivalent title (`accessibilityRole="header"` + `accessibilityLevel={1}`).
- Vertical-stack children with 24px gap between sections.

### `<SettingsSection>`

```tsx
interface SettingsSectionProps {
  title?: string              // section header (uppercase, tracked-out, muted)
  description?: string        // optional muted text below title
  children: ReactNode         // SettingsRow variants
}
```

Renders:
- Optional title with `accessibilityRole="header"` + `accessibilityLevel={2}`.
- Optional description (`semantic.text.muted`, 13px).
- Card View: `bg.card`, `border.default`, 12px radius, `overflow: 'hidden'`.
- Children separated by automatic 1px inset divider (`border.default`).

### `<SettingsRow>` (base)

```tsx
interface SettingsRowProps {
  children: ReactNode
  onPress?: () => void        // when present, wraps in Pressable
  disabled?: boolean
  accessibilityLabel?: string
  accessibilityRole?: 'button' | 'link'  // default 'button' if onPress
}
```

Renders: 56px min-height row with 16px horizontal padding. Optional Pressable wrap with subtle hover/pressed state (`semantic.bg.subtle` on press).

### Variant rows

```tsx
interface SettingsNavRowProps {
  label: string
  value?: string              // muted text before chevron
  onPress: () => void
  href?: string               // web smart-anchor (Gotcha #22)
}

interface SettingsActionRowProps {
  label: string
  onPress: () => void
  danger?: boolean            // styles label with semantic.alert.danger.fg
}

interface SettingsToggleRowProps {
  label: string
  description?: string        // optional second-line muted text
  value: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
}

interface SettingsValueRowProps {
  label: string
  value: string               // right-aligned muted text
}

interface SettingsComingSoonRowProps {
  label: string
  description?: string
}
```

All variants:
- `useBrandTokens()` for self-theming.
- `accessibilityRole="button"` / `"link"` + `accessibilityState={{ disabled }}` + `aria-disabled` for web (Gotcha #22 dual-write).
- Cross-platform via RN primitives.

### Smart-anchor in `<SettingsNavRow>`

When `href` is provided on web (`Platform.OS === 'web'`), internally:

```tsx
createElement('a', {
  href,
  onClick: (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return  // browser default
    e.preventDefault()
    onPress()
  },
  style: { /* link-styled */ },
}, content)
```

Same pattern as slice 14 AlignmentChip + slice 18 M6 propagation. Restores middle-click → new tab, status-bar URL preview, link prefetch.

## 7. Composition + data flow

### Settings page composition

`apps/web/app/settings/page.tsx` becomes a declarative tree (5 sections × 7 row variants). Existing logic preserved:
- Sign-out clears `chiaro_skip_calibrate` cookie + calls `supabase.auth.signOut()` + routes to `/sign-in`.
- Theme stays inside `<BrandModeThemeRow>` (slice 38, untouched).
- All navigation via `router.push()` callbacks.

Mobile composition uses identical component tree with expo-router `useRouter()` for `onPress` callbacks.

### Calibrate page composition

`apps/web/app/calibrate/page.tsx` becomes:

```tsx
<CalibrateScreen onSubmit={handleSubmit} onSkip={handleSkip} />
```

`handleSubmit(address)`:
1. Validates via `addressInputSchema.safeParse({ address })` → throws on fail.
2. Calls `supabase.functions.invoke('calibrate-location', { body: { address } })`.
3. Maps invoke error status codes (400 / 422 / 502 / default) to user-friendly messages → throws.
4. On success: `router.push('/')` + `router.refresh()`.

`handleSkip()`: sets `chiaro_skip_calibrate=1` cookie + `router.push('/')`.

All existing behavior preserved; only the component shell changes.

### Brand mode propagation

`useBrandTokens()` is called per-component (per-row). When user toggles via `BrandModeThemeRow`, Context updates → every Settings component re-renders with new tokens. ~10 rows × ~3 token lookups each = no perceptible cost.

## 8. Cross-platform considerations

| Concern | Pattern | Source |
|---|---|---|
| Viewport-fill outer | `Platform.OS === 'web' && { minHeight: '100vh' as unknown as number }` | AuthScreen 2026-05-28 fix |
| Smart-anchor (real `<a href>`) | `createElement('a', { href, onClick })` on web; `<Pressable>` on native | Gotcha #19f, slice 14 + slice 18 M6 |
| A11y dual-prop | `accessibilityState={{ selected/disabled }}` + `aria-*` direct | Gotcha #22, slice 14 + slice 38 |
| Heading semantics | `accessibilityRole="header"` + `accessibilityLevel={N}` | Slice 25 a11y closeout |

### Platform-specific differences

- `<Switch>` renders differently on web (RNW styled checkbox composite) vs. native. Accepted; matches RN convention.
- `<SettingsNavRow>` smart-anchor only fires on web. Native always uses `onPress` callback path.
- `<SettingsScreen>` page background uses `semantic.bg.app`. On web this overlays the slice 38 body-style — same value, no seam.
- `<Text>` on RNW renders as `<div>`; `accessibilityRole="header"` + `accessibilityLevel={N}` emits `<h{N}>`. RN strips browser heading defaults; spacing is StyleSheet-controlled.

## 9. Testing

Total: **~30 new test cases across 8 test files** under `packages/officials-ui/test/`.

| Test file | Cases | Verifies |
|---|---|---|
| `inputs/BrandTextInput.test.tsx` | ~4 | Behavior unchanged from old AuthInput. |
| `calibrate/CalibrateScreen.test.tsx` | ~6 | Renders title/desc/input/CTA/Skip; submit→onSubmit; throws→error display; loading→CTA disabled; Skip omitted when no callback. |
| `settings/SettingsScreen.test.tsx` | ~2 | Renders h1 title + children; viewport-fill on web. |
| `settings/SettingsSection.test.tsx` | ~3 | Optional title; card grouping; divider between rows; no divider on single child. |
| `settings/SettingsNavRow.test.tsx` | ~5 | Label + value + chevron; press→onPress; smart-anchor href on web; modifier-click fallthrough. |
| `settings/SettingsActionRow.test.tsx` | ~3 | Label + press; `danger` variant uses semantic.alert.danger.fg. |
| `settings/SettingsToggleRow.test.tsx` | ~4 | Label + Switch; toggle→onChange(next); `disabled` blocks + sets aria-disabled. |
| `settings/Settings{Value,ComingSoon}Row.test.tsx` | ~3 | Label + value/badge; non-interactive. |

### Out of scope tests

- Cookie round-trip integration on web (no Next.js test harness).
- Real Edge Function invocation in CalibrateScreen tests (mocked via `onSubmit` callback).
- Mobile on-device tests (deferred to DoD).
- Legal page route assertions (routes don't exist yet).

### Manual smoke checklist

Web (Chrome):
- `/settings` shows 5 sections in correct order with all variants rendered.
- Dark mode toggle repaints all rows + sections.
- "Sign out" row uses red text.
- "Home address" nav row navigates to `/settings/address`; middle-click opens new tab.
- Notifications toggles are disabled and don't fire.
- "Coming soon" rows are non-interactive.
- About section shows version string.
- Privacy / Terms rows navigate (even if destination is 404 in v1).
- `/calibrate` shows centered branded card; submit + skip work; existing error messages still display.

Mobile (DoD checklist):
- Settings page renders 5 sections identical to web.
- Dark mode toggle repaints.
- All nav rows + action rows work via expo-router.

## 10. Implementation surface

**New component files (10):**
- `packages/officials-ui/src/inputs/BrandTextInput.tsx`
- `packages/officials-ui/src/calibrate/CalibrateScreen.tsx`
- `packages/officials-ui/src/settings/SettingsScreen.tsx`
- `packages/officials-ui/src/settings/SettingsSection.tsx`
- `packages/officials-ui/src/settings/SettingsRow.tsx`
- `packages/officials-ui/src/settings/SettingsNavRow.tsx`
- `packages/officials-ui/src/settings/SettingsActionRow.tsx`
- `packages/officials-ui/src/settings/SettingsToggleRow.tsx`
- `packages/officials-ui/src/settings/SettingsValueRow.tsx`
- `packages/officials-ui/src/settings/SettingsComingSoonRow.tsx`

**New test files (8):** see §9.

**Edited files (5):**
- `packages/officials-ui/src/auth/AuthInput.tsx` → thin re-export of BrandTextInput.
- `packages/officials-ui/src/index.ts` → add exports.
- `apps/web/app/settings/page.tsx` → declarative composition.
- `apps/web/app/calibrate/page.tsx` → declarative composition.
- `apps/mobile/app/(app)/settings/index.tsx` → declarative composition.

**Renamed files (1):**
- `packages/officials-ui/test/auth/AuthInput.test.tsx` → `test/inputs/BrandTextInput.test.tsx`.

**Total: 10 new components + 8 new tests + 5 edited + 1 renamed = 24 files.**

Falls in Mega-Slice tier per `feedback_workflow_tiers.md`. Brainstorm → spec → plan → subagent-driven-development flow (same as slice 38).

## 11. Risks + open questions

- **Mobile calibrate route may not exist.** Mobile `(auth)` flow may handle first-time calibrate inside sign-up. Verify during impl. If no separate route exists, mobile calibrate is dropped from this slice.
- **Address value preview on Home address row.** Need to fetch the user's current home address to display next to the row. May require either passing as a prop from the page (which needs to query user_locations) or adding a query inside the row component. Implementer decision: pass as prop (avoid coupling row to data layer).
- **Switch component theming on RNW.** RN's `<Switch>` track color uses `trackColor` prop; may need brand-tokened values. Verify visual fidelity in light + dark during impl.
- **`<SettingsScreen>` `<h1>` margins.** RNW strips defaults; manual StyleSheet padding required. Implementer verifies no visual gap before/after title.
- **`/legal/privacy` + `/legal/terms` 404.** Those routes don't exist yet. Acceptable for v1 — rows visually point at the destination; routes get created in follow-up. Document in CLAUDE.md slice 39 entry.

## 12. Closeout criteria

- All ~30 new tests pass.
- `pnpm -r typecheck` green.
- `pnpm test` workspace tests pass (modulo pre-existing env-var-gated integration tests).
- `pnpm --filter @chiaro/web build` green.
- Manual web smoke (§9 checklist) walked in Chrome.
- Mobile DoD checklist gains slice 39 section; on-device smoke deferred.
- CLAUDE.md gets slice 39 entry in "Slices delivered".
- No `COLORS.*` references introduced (slice 37 closeout invariant).

## 13. What this slice unblocks

- **Notifications backing data** (slice 40+): tokens + UI exist; just wire toggles to real prefs.
- **Profile editing** (slice 40+): row variants ready; need data layer + form.
- **Legal pages** (follow-up): row destinations declared; pages need MDX/static creation.
- **Future onboarding screens**: `<CalibrateScreen>` shell + `<BrandTextInput>` are now generic enough to host email-verify, welcome-survey, etc.
- **Slice 39+ visual reskin philosophy decisions**: settings is one more dark-mode-ready surface to validate against (e.g., does the link blue stand out enough on dark `bg.card`?).

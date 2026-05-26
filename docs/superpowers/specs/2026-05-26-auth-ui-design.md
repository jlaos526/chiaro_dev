# Slice 31 — Auth UI (sign-in + sign-up) design

**Status:** approved 2026-05-26 (visual brainstorming via companion; layout direction "C-Floating + wordmark" locked)
**Tier:** Compressed-to-Mega-Slice (~14-18 files)
**Builds on:** Slice 1 (auth wiring + sign-in/sign-up routes), slice 10 (`@chiaro/officials-ui` RNW shared package), slice 14 (a11y baseline — `accessibilityRole="link"` smart-anchor), slice 25 (RN AccessibilityProps augmentation + Gotcha #22).

## Goal

Replace the raw slice 1 sign-in + sign-up screens (unstyled `<form>` / `<TextInput>`) with a polished, accessible auth UI shared across web + iOS + Android via `@chiaro/officials-ui`. Lock in `AuthForm` + `AuthScreen` components using Material-3-style floating-label inputs + CHIARO wordmark + civic-green CTA.

After this slice:
- `/sign-in` + `/sign-up` web routes use the new shared components
- `(auth)/sign-in.tsx` + `(auth)/sign-up.tsx` mobile screens use the same shared components
- All field states (empty / focused / filled / error / disabled / loading) consistent across platforms
- Existing Supabase auth happy-path flows preserved (signInWithPassword / signUp)
- Cross-link between sign-in ↔ sign-up wired via callback prop (web router.push / native router.navigate)

## Non-goals

- **No magic-link, OAuth, or passwordless flows.** Email + password only (scope locked).
- **No forgot-password screen.** Out of scope (deferred to slice 32+).
- **No email-verification waiting screen.** Out of scope.
- **No backend / Supabase config changes.** Auth wiring (signUp / signInWithPassword) unchanged.
- **No schema migrations.** Pure UI/component refactor.
- **No new workspace deps.** Reuse `@chiaro/ui-tokens`, RN core, RNW.
- **No animations / micro-interactions** beyond input focus state. Floating-label transition is CSS-only (`transform` + `transition`) on web; native uses static "compact label always" treatment for v1.
- **No password-strength meter, social previews, illustrations, or marketing copy.** Visual polish only.

## Architecture

### Visual direction (approved)

**Mobile** (iOS + Android):
- Full-screen white card on cream/neutral background
- Top: CHIARO wordmark (logo dot + uppercase letter-spaced text)
- Headline: "Sign in" / "Create account" (700 weight, 22-24px, `-0.01em` letter-spacing)
- Subhead: "to your Chiaro account" / "Track your reps, see your bills" (11-12px, muted)
- Floating-label outlined inputs (Material 3 style; 48px height; 10px border-radius)
- Primary CTA: civic-green pill button, full-width, 40-42px height
- Cross-link at bottom: "New here? Create account" / "Already have one? Sign in"

**Web** (desktop):
- Page chrome: CHIARO wordmark top-left + cross-link top-right ("Sign up" on sign-in page; "Sign in" on sign-up page)
- Centered card on cream/neutral surface, max-width ~360-400px
- Card carries headline + form only (NO duplicate wordmark inside)
- Same input + CTA visuals as mobile

**Mobile/web parity:** shared `AuthForm` accepts a `showBranding?: boolean` prop. Mobile passes `true`; web passes `false`. Same component, two contexts.

### Color palette (placeholder values to calibrate against `@chiaro/ui-tokens`)

Mockup used:
- Civic green primary: `#1a5f4a` → maps to `COLORS.brand.primary` (TBD; implementer verifies token name during scaffold)
- Surface cream: `#f4f1ee` → `COLORS.neutral.surface` (TBD)
- Border neutral: `#d4d0ca` → `COLORS.neutral.border` (TBD)
- Text ink: `#1a1714` → `COLORS.brand.text` (TBD)
- Text muted: `#6b6b6b` → `COLORS.neutral.textMuted` (TBD)

**Implementer audits `@chiaro/ui-tokens` at scaffold time** and maps to existing tokens. If a token doesn't exist (e.g. no "civic green" defined), the spec accepts adding to ui-tokens IF the slice 10 RNW conversion already established the color elsewhere; otherwise picks the closest existing token + flags as a follow-up.

### Component layout

```
@chiaro/officials-ui (new):
  src/auth/
    AuthForm.tsx              shared form (sign-in OR sign-up; mode prop)
    AuthScreen.tsx            shared screen wrapper (carries wordmark + cross-link logic)
    AuthInput.tsx             floating-label outlined input
    AuthWordmark.tsx          CHIARO logo dot + wordmark
    AuthCrossLink.tsx         "New here? Create account" / mirror
  src/index.ts                barrel exports for the 5 new components

apps/web/app/sign-in/page.tsx     refactor to use AuthScreen
apps/web/app/sign-up/page.tsx     refactor to use AuthScreen
apps/mobile/app/(auth)/sign-in.tsx  refactor to use AuthScreen
apps/mobile/app/(auth)/sign-up.tsx  refactor to use AuthScreen
apps/mobile/app/(auth)/_layout.tsx  possibly trim now that the screens self-style
```

### File count

- 5 new components in @chiaro/officials-ui
- 5 new component tests in officials-ui/test/
- 2 web pages refactored
- 2 mobile screens refactored
- 1 ui-tokens addition (if needed)
- 1 CLAUDE.md slice entry + Gotcha entries if surfaced
- = **~14-16 files**. Compressed-Slice tier; trends toward Mega-Slice if ui-tokens additions are needed.

## Components

### `AuthInput.tsx` — Floating-label outlined input

Props:
```ts
export interface AuthInputProps {
  label: string                    // 'Email' | 'Password' | 'Confirm password'
  value: string
  onChangeText: (next: string) => void
  type?: 'email' | 'password' | 'text'
  placeholder?: string             // shown inline below label when value is empty
  error?: string                   // shown in red below input when set
  disabled?: boolean
  autoComplete?: string            // 'email' | 'current-password' | 'new-password'
  testID?: string
}
```

States:
- **Empty / unfocused:** label is compact (8px, top of input box, uppercase letter-spaced, muted color); border neutral. Placeholder shows below in italic-muted if `placeholder` prop set.
- **Focused (with or without value):** border + label color shift to civic green; border thickens (1.5px). Native: `onFocus` listener manages state via `useState`; web: same.
- **Filled (unfocused):** border returns to neutral but label stays compact and visible.
- **Error:** border + label switch to error red; error text appears below at 10-11px.
- **Disabled:** opacity 0.5; pointer-events: none on web; native uses `editable={false}`.

Implementation notes:
- Native: `<TextInput>` with `secureTextEntry={type === 'password'}` + `keyboardType={type === 'email' ? 'email-address' : 'default'}` + `autoCapitalize={type === 'email' || type === 'password' ? 'none' : 'sentences'}` + appropriate `autoComplete`.
- Web (via RNW): translates `autoComplete` to native HTML attribute (`autocomplete="email" autocomplete="current-password"` etc.). Password managers + browser autofill rely on this.
- Accessibility: `accessibilityLabel` always equals the human label text; `accessibilityState={{ disabled }}` and `aria-invalid={!!error}` (slice 22 Gotcha #22 direct-DOM-attribute pattern).
- The label "compact-to-floating" animation is web-only (CSS `transform: translateY(...)` + `transition`). Native uses static "always-compact" layout for v1 (simpler; matches the mockup; no animation library dep). Document as Risk + acceptable v1 cost.

### `AuthForm.tsx` — Form orchestrator

Props:
```ts
export interface AuthFormProps {
  mode: 'sign-in' | 'sign-up'
  onSubmit: (vals: { email: string; password: string }) => Promise<void>
  onCrossLinkPress: () => void     // wires "Sign up" / "Sign in" button → router.push
  initialEmail?: string             // for prefill after errors
  testID?: string
}
```

Behavior:
- Manages `email`, `password`, `confirmPassword` (sign-up only) state.
- Manages `submitting`, `error` state.
- On submit:
  - Sign-up validates `password === confirmPassword` client-side; sets field-level error if mismatch.
  - Sign-up validates `password.length >= 8` client-side; sets field-level error if too short.
  - Calls `onSubmit({ email, password })` then catches errors → form-level `<Text>` error banner above the CTA.
- Renders:
  - Headline + subhead (different per `mode`)
  - 2-3 `AuthInput`s (email + password + optional confirm)
  - Primary CTA (`'Sign in'` or `'Create account'`); shows `'…'` suffix or spinner when submitting
  - `AuthCrossLink` at bottom

### `AuthWordmark.tsx` — Logo + wordmark

Props:
```ts
export interface AuthWordmarkProps {
  size?: 'sm' | 'md'  // sm for desktop page-chrome; md for mobile in-card
}
```

Renders: `<View flexDirection="row" gap=6-8 alignItems="center">` containing a `<View>` square (logo dot, civic-green background, 6px radius) + a `<Text>` wordmark ("CHIARO", letter-spaced 0.08em, weight 600). Size variants tune the dot dimension + font size.

### `AuthCrossLink.tsx` — "New here? Create account" link

Props:
```ts
export interface AuthCrossLinkProps {
  mode: 'sign-in' | 'sign-up'      // determines prefix copy
  onPress: () => void
  href?: string                     // web a11y: real <a href> for middle-click / new-tab (slice 14 pattern)
}
```

Mode mapping:
- `'sign-in'` → "New here? <strong>Create account</strong>"
- `'sign-up'` → "Already have one? <strong>Sign in</strong>"

Uses the slice 14 + slice 18 M6 smart-anchor pattern: `Platform.OS === 'web' && href` → `createElement('a', { href, onClick })` with plain left-clicks intercepted + modifier-key clicks falling through to browser default. Native uses `<Pressable>`.

### `AuthScreen.tsx` — Page wrapper

Props:
```ts
export interface AuthScreenProps {
  mode: 'sign-in' | 'sign-up'
  onSubmit: (vals: { email: string; password: string }) => Promise<void>
  onCrossLinkPress: () => void
  crossLinkHref?: string
  showBranding?: boolean            // defaults true on mobile; false on web (page chrome carries it)
}
```

Renders:
- Outer surface (cream background)
- Optional `<AuthWordmark size="md" />` at top of card (only when `showBranding`)
- `<AuthForm />`
- Card styling: white background, 16px radius, padding 30px×24px, max-width 400px on web, full-bleed on mobile

Web parent (in `apps/web/app/sign-in/page.tsx`) renders a separate page-chrome bar with the `AuthWordmark size="sm"` + a top-right cross-link, then mounts `<AuthScreen showBranding={false} ... />` below.

### Web pages

`apps/web/app/sign-in/page.tsx`:
```tsx
'use client'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { AuthScreen, AuthWordmark } from '@chiaro/officials-ui'

export default function SignInPage() {
  const router = useRouter()
  async function handleSubmit({ email, password }: { email: string; password: string }) {
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
    router.push('/')
    router.refresh()
  }
  return (
    <main style={{ minHeight: '100vh', backgroundColor: COLORS.neutral.surface }}>
      <PageChrome rightCrossLink={{ label: 'Sign up', href: '/sign-up' }} />
      <AuthScreen
        mode="sign-in"
        onSubmit={handleSubmit}
        onCrossLinkPress={() => router.push('/sign-up')}
        crossLinkHref="/sign-up"
        showBranding={false}
      />
    </main>
  )
}
```

`apps/web/app/sign-up/page.tsx`: mirror with `mode="sign-up"` + signUp call.

### Mobile screens

`apps/mobile/app/(auth)/sign-in.tsx`:
```tsx
import { useRouter } from 'expo-router'
import { AuthScreen } from '@chiaro/officials-ui'
import { supabase } from '@/lib/supabase'

export default function SignIn() {
  const router = useRouter()
  async function handleSubmit({ email, password }: { email: string; password: string }) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
    // expo-router redirects via root layout's auth guard
  }
  return (
    <AuthScreen
      mode="sign-in"
      onSubmit={handleSubmit}
      onCrossLinkPress={() => router.push('/(auth)/sign-up')}
      showBranding
    />
  )
}
```

`apps/mobile/app/(auth)/sign-up.tsx`: mirror with `mode="sign-up"` + signUp call.

`apps/mobile/app/(auth)/_layout.tsx`: review whether the existing layout needs changes; if it adds chrome (header), trim it now that the screens self-style.

## Data flow

```
User submits AuthForm
  ↓
AuthForm.handleSubmit (validates passwords match + length)
  ↓
calls props.onSubmit({ email, password })
  ↓
Web: supabase.auth.signInWithPassword (or signUp)
Mobile: same supabase client (apps/mobile/lib/supabase.ts)
  ↓ (success)
Web: router.push('/') + router.refresh()
Mobile: expo-router auth guard redirects from root layout
  ↓ (error)
AuthForm catches in try/catch + displays form-level error banner above CTA
```

No new data flow. Supabase happy-path identical to slice 1.

## Error handling

3 levels of error display:

1. **Field-level (validation)**: client-side checks before submit (password mismatch, min length). Rendered inline below the affected `AuthInput` in red.

2. **Form-level (Supabase auth errors)**: caught from `onSubmit` rejection. Rendered as a `<Text>` banner above the CTA in error red. Examples: "Invalid email or password" / "Email already registered" / "Network error".

3. **Disabled-during-submit**: while `submitting`, the form's inputs receive `disabled={true}` + the CTA shows `'Signing in…'` / `'Creating account…'` text. No spinner in v1 (text suffix carries the load state).

Error styling:
- Border + label color: error red (`COLORS.signal.error` — verify in ui-tokens)
- Error text: 10-11px, regular weight, error red
- Form-level banner: 12-13px, regular weight, error red on light-pink background (`#fef2f0` placeholder; verify in tokens)

## Testing strategy

**Component unit tests** (5 files in `packages/officials-ui/test/auth/`):
- `AuthInput.test.tsx` — empty state, focused state, filled state, error state, disabled state, autoComplete props, slice 22 Gotcha #22 direct-DOM-attribute assertions for `aria-invalid`
- `AuthForm.test.tsx` — mode toggle, password mismatch validation, password length validation, submit success path, submit error path, disabled-during-submit
- `AuthWordmark.test.tsx` — renders logo dot + text; size variants
- `AuthCrossLink.test.tsx` — mode mapping, smart-anchor pattern (web vs native), onPress callback, href prop
- `AuthScreen.test.tsx` — orchestrates AuthForm + optional Wordmark; `showBranding` toggle

Expected test count delta: +30-40 cases. officials-ui vitest: 276 → ~310.

**No integration tests** (Supabase auth happy-path is owned by slice 1 + existing apps/web build).

**Web build smoke**: `/sign-in` + `/sign-up` routes build cleanly. Bundle delta: +5-10 kB (new components offset by removed inline form code).

**Mobile manual smoke**: rebuild Expo dev client; visit auth screens; verify keyboard handling + iOS + Android visual parity.

## Verify gate

- `pnpm -r typecheck` → 11/11 green
- `pnpm --filter @chiaro/officials-ui exec vitest run auth` → 30-40 new tests green
- `pnpm --filter @chiaro/officials-ui exec vitest run` → 276 → ~310 (overall)
- `pnpm --filter @chiaro/web build` → 12 routes; `/sign-in` + `/sign-up` bundle delta ≤ +10 kB each
- Manual mobile smoke (operator)

## Risk + tradeoffs

1. **Floating-label transition is web-only in v1.** Native uses static "always compact" labels. Animated label transition on RN requires `Animated` API or `react-native-reanimated`; out of scope. Document in component JSDoc. Mockup reflects the static native treatment.

2. **`@chiaro/ui-tokens` may not have civic-green / cream defined.** Mockup used `#1a5f4a` / `#f4f1ee` placeholders. Implementer audits tokens at scaffold; if missing, either adds to `ui-tokens` (small follow-up) OR uses closest existing tokens + flags as a slice 32 follow-up. Don't block slice 31 on token discovery.

3. **Mobile `(auth)/_layout.tsx` interaction.** If the existing layout adds a navigation header or styling that conflicts with the new full-bleed card, trim it. Possible cascade into Expo-router config; bounded risk.

4. **Web page chrome (top-bar wordmark + cross-link) introduces a new shell.** Currently `apps/web/app/sign-in/page.tsx` is bare-`<main>`. The new design needs a thin page-chrome shell. Inline in the page component OR shared `AuthPageChrome` component? Recommendation: shared via `@chiaro/officials-ui` for symmetry (`AuthPageChrome` taking `rightCrossLink: { label, href }`). +1 component file.

5. **Smart-anchor pattern (slice 14 / slice 18 M6).** Already proven on AlignmentChip + OfficialsList + several other sites. Reuse the established convention; no risk of regression.

6. **Password manager UX.** Floating-label inputs interact well with browser autofill (label stays compact when password manager fills the field). Verify on Safari + Chrome + iOS Safari + Android Chrome during smoke.

7. **A11y baseline.** Inherit slice 14 + 22 + 25 patterns: `accessibilityRole="header"` + `accessibilityLevel` on headlines (Gotcha #19e + slice 25 RN types augmentation); `aria-invalid` direct-DOM-attribute pattern on inputs (Gotcha #22); smart-anchor on cross-links.

8. **No spinner on submit.** Text-suffix load state (`'Signing in…'`) is simpler + accessible + matches existing site convention. Adding a spinner requires animation library; out of scope.

9. **`AuthCrossLink` smart-anchor requires `href` prop on web.** Mobile callers can omit; web should always pass. Document expected usage in JSDoc.

10. **Mid-flight scope creep risk: forgot-password.** Users may surface "while we're here…" requests. Defer rigorously to slice 32; slice 31 is visual polish + cross-platform unification only.

## Schema verification needed during planning

None — no schema work.

## Cross-references

- Slice 1 (auth + profile origin — preserved happy-path flows)
- Slice 10 (`@chiaro/officials-ui` RNW shared package pattern this slice extends)
- Slice 14 (a11y baseline + smart-anchor / direct-DOM-attribute pattern this slice inherits)
- Slice 18 M6 (smart-anchor propagation to multiple sites — establishes the convention used by AuthCrossLink)
- Slice 22 (Gotcha #22 direct-DOM-attribute assertion test pattern)
- Slice 25 (RN AccessibilityProps augmentation — allows `accessibilityLevel` on the headlines)
- CLAUDE.md `## Code style` (no inline hex; use `@chiaro/ui-tokens`)
- Memory: [[project-chiaro-slice1-auth-profile]] (slice 1 origin), [[project-chiaro-slice10-officials-ui]] (RNW conversion pattern), [[project-chiaro-slice14-a11y-batch]] (smart-anchor + Gotcha #22), [[project-chiaro-slice25-a11y-closeout]] (RN types augmentation)

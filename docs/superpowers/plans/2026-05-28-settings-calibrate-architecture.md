# Slice 39 — Settings architecture + Calibrate refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the slice-1-era raw-HTML `/settings` and `/calibrate` pages with a production-ready, brand-tokened, cross-platform component architecture in `@chiaro/officials-ui`.

**Architecture:** New `inputs/`, `calibrate/`, and `settings/` subfolders in `@chiaro/officials-ui/src/`. Settings becomes a declarative composition of 5 sections × 7 row variants. Calibrate adopts the slice 33 auth-card aesthetic via parallel `<CalibrateScreen>`. AuthInput hoists to `<BrandTextInput>` for non-auth reuse; auth re-exports for back-compat.

**Tech Stack:** React Native + react-native-web (slice 10 cross-platform pattern), TypeScript strict + `exactOptionalPropertyTypes`, vitest + `@testing-library/react`, brand tokens from `@chiaro/ui-tokens` via `useBrandTokens()`.

**Spec:** `docs/superpowers/specs/2026-05-28-settings-calibrate-architecture-design.md`

---

## Task 1: Extract BrandTextInput from AuthInput

**Files:**
- Create: `packages/officials-ui/src/inputs/BrandTextInput.tsx`
- Modify: `packages/officials-ui/src/auth/AuthInput.tsx` → thin re-export
- Rename: `packages/officials-ui/test/auth/AuthInput.test.tsx` → `packages/officials-ui/test/inputs/BrandTextInput.test.tsx`
- Modify: `packages/officials-ui/src/index.ts` → add BrandTextInput export, keep AuthInput export

The actual code from `auth/AuthInput.tsx` (slice 31) moves verbatim to `inputs/BrandTextInput.tsx` with only the symbol names changing (`AuthInput` → `BrandTextInput`, `AuthInputProps` → `BrandTextInputProps`). The class names inside the CSS template change from `auth-input-*` / `auth-input__*` to `brand-text-input-*` / `brand-text-input__*` for naming clarity. The auth re-export shim preserves `AuthInput` symbol so existing callers don't break.

- [ ] **Step 1: Create the new BrandTextInput file**

Copy the entire current contents of `packages/officials-ui/src/auth/AuthInput.tsx` to `packages/officials-ui/src/inputs/BrandTextInput.tsx`, performing these find-and-replace substitutions in the new file:

- `AuthInput` → `BrandTextInput`
- `AuthInputProps` → `BrandTextInputProps`
- `auth-input-` → `brand-text-input-`
- `auth-input__field` → `brand-text-input__field`
- `auth-input__label` → `brand-text-input__label`
- `auth-input__error` → `brand-text-input__error`

The component is identical in behavior — only naming changes.

- [ ] **Step 2: Replace auth/AuthInput.tsx with a re-export shim**

Replace the entire contents of `packages/officials-ui/src/auth/AuthInput.tsx` with:

```tsx
// Back-compat shim for the slice-31 export name. The component lives at
// inputs/BrandTextInput.tsx (slice 39) and is now generic enough for non-auth
// callers. Existing auth pages import { AuthInput } from this path; both names
// stay valid.

export {
  BrandTextInput as AuthInput,
  type BrandTextInputProps as AuthInputProps,
} from '../inputs/BrandTextInput.tsx'
```

- [ ] **Step 3: Move the test file**

Rename the test file:

```bash
mkdir -p packages/officials-ui/test/inputs
git mv packages/officials-ui/test/auth/AuthInput.test.tsx packages/officials-ui/test/inputs/BrandTextInput.test.tsx
```

Then update the moved file: change the import line `import { AuthInput } from '../../src/auth/AuthInput.tsx'` to `import { BrandTextInput } from '../../src/inputs/BrandTextInput.tsx'` and change all references to `AuthInput` within the test file to `BrandTextInput`. Also change any test names that say `AuthInput` to `BrandTextInput`.

- [ ] **Step 4: Update barrel exports**

Edit `packages/officials-ui/src/index.ts`. Find the `// auth/* primitives (slice 31)` block and immediately above it, add:

```ts
// Slice 39 — generic input primitives
export { BrandTextInput, type BrandTextInputProps } from './inputs/BrandTextInput.tsx'
```

Leave the existing `export { AuthInput, type AuthInputProps } from './auth/AuthInput.tsx'` line alone — it now re-exports through the shim.

- [ ] **Step 5: Run BrandTextInput tests + AuthScreen tests to verify no regression**

Run: `pnpm --filter @chiaro/officials-ui test -- BrandTextInput`
Expected: PASS (same case count as the old AuthInput test file).

Run: `pnpm --filter @chiaro/officials-ui test -- AuthScreen`
Expected: PASS (6 tests; auth back-compat shim still works).

- [ ] **Step 6: Verify typecheck**

Run: `pnpm --filter @chiaro/officials-ui typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/officials-ui/src/inputs/BrandTextInput.tsx packages/officials-ui/src/auth/AuthInput.tsx packages/officials-ui/test/inputs/BrandTextInput.test.tsx packages/officials-ui/src/index.ts
git rm packages/officials-ui/test/auth/AuthInput.test.tsx 2>/dev/null || true
git commit -m "refactor(officials-ui): hoist AuthInput to inputs/BrandTextInput

Slice 39 task 1. Extracts the slice-31 floating-label outlined input
to a generic location so non-auth surfaces (CalibrateScreen, future)
can reuse it. auth/AuthInput.tsx becomes a thin re-export for
back-compat — existing AuthScreen + AuthForm callers see no change.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: SettingsRow base + SettingsScreen + SettingsSection

**Files:**
- Create: `packages/officials-ui/src/settings/SettingsRow.tsx`
- Create: `packages/officials-ui/src/settings/SettingsScreen.tsx`
- Create: `packages/officials-ui/src/settings/SettingsSection.tsx`
- Create: `packages/officials-ui/test/settings/SettingsScreen.test.tsx`
- Create: `packages/officials-ui/test/settings/SettingsSection.test.tsx`
- Modify: `packages/officials-ui/src/index.ts` — add exports

SettingsRow is the base building block; SettingsScreen is the page container; SettingsSection is the card-grouped section. SettingsRow doesn't get its own test (it's covered through variant tests in tasks 3-5).

- [ ] **Step 1: Write the SettingsScreen test**

Create `packages/officials-ui/test/settings/SettingsScreen.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'
import { SettingsScreen } from '../../src/settings/SettingsScreen.tsx'

function withMode(mode: 'light' | 'dark') {
  return ({ children }: { children: ReactNode }) =>
    createElement(BrandModeOverrideContext.Provider, { value: mode }, children)
}

describe('SettingsScreen', () => {
  it('renders default "Settings" title as h1', () => {
    const { container } = render(<SettingsScreen>{null}</SettingsScreen>, { wrapper: withMode('light') })
    const h1 = container.querySelector('h1[role="heading"][aria-level="1"]')
    expect(h1?.textContent).toBe('Settings')
  })

  it('renders custom title when prop provided', () => {
    const { container } = render(<SettingsScreen title="Preferences">{null}</SettingsScreen>, { wrapper: withMode('light') })
    expect(container.querySelector('h1')?.textContent).toBe('Preferences')
  })

  it('renders children below title', () => {
    const { getByText } = render(
      <SettingsScreen><div>child-content</div></SettingsScreen>,
      { wrapper: withMode('light') },
    )
    expect(getByText('child-content')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Write the SettingsSection test**

Create `packages/officials-ui/test/settings/SettingsSection.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'
import { SettingsSection } from '../../src/settings/SettingsSection.tsx'

function withMode(mode: 'light' | 'dark') {
  return ({ children }: { children: ReactNode }) =>
    createElement(BrandModeOverrideContext.Provider, { value: mode }, children)
}

describe('SettingsSection', () => {
  it('renders without title (card only)', () => {
    const { container } = render(
      <SettingsSection><div>row-1</div></SettingsSection>,
      { wrapper: withMode('light') },
    )
    expect(container.querySelector('[role="heading"]')).toBeNull()
  })

  it('renders uppercase title as h2', () => {
    const { container } = render(
      <SettingsSection title="Account"><div>row-1</div></SettingsSection>,
      { wrapper: withMode('light') },
    )
    const h2 = container.querySelector('[role="heading"][aria-level="2"]')
    expect(h2?.textContent).toBe('ACCOUNT')
  })

  it('renders description below title when provided', () => {
    const { getByText } = render(
      <SettingsSection title="Notifications" description="Coming soon">
        <div>row-1</div>
      </SettingsSection>,
      { wrapper: withMode('light') },
    )
    expect(getByText('Coming soon')).toBeTruthy()
  })

  it('renders dividers between children but not after the last', () => {
    const { container } = render(
      <SettingsSection>
        <div data-testid="row-1">row-1</div>
        <div data-testid="row-2">row-2</div>
        <div data-testid="row-3">row-3</div>
      </SettingsSection>,
      { wrapper: withMode('light') },
    )
    // 3 children → expect 2 dividers
    const dividers = container.querySelectorAll('[data-divider="true"]')
    expect(dividers.length).toBe(2)
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter @chiaro/officials-ui test -- "Settings(Screen|Section)"`
Expected: FAIL with `Cannot find module '../../src/settings/SettingsScreen.tsx'`.

- [ ] **Step 4: Implement SettingsRow (base)**

Create `packages/officials-ui/src/settings/SettingsRow.tsx`:

```tsx
'use client'

import { Pressable, StyleSheet, View } from 'react-native'
import type { ReactNode } from 'react'
import { useBrandTokens } from '../brand-hooks.ts'

export interface SettingsRowProps {
  children: ReactNode
  onPress?: () => void
  disabled?: boolean
  accessibilityLabel?: string
  accessibilityRole?: 'button' | 'link'
}

export function SettingsRow({
  children,
  onPress,
  disabled,
  accessibilityLabel,
  accessibilityRole = 'button',
}: SettingsRowProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  if (onPress) {
    return (
      <Pressable
        onPress={disabled ? undefined : onPress}
        accessibilityRole={accessibilityRole}
        accessibilityState={{ disabled: !!disabled }}
        aria-disabled={disabled}
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [
          styles.row,
          pressed && !disabled ? { backgroundColor: semantic.bg.subtle } : null,
        ]}
      >
        {children}
      </Pressable>
    )
  }
  return <View style={styles.row}>{children}</View>
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
})
```

- [ ] **Step 5: Implement SettingsScreen**

Create `packages/officials-ui/src/settings/SettingsScreen.tsx`:

```tsx
'use client'

import { Platform, StyleSheet, Text, View } from 'react-native'
import type { ReactNode } from 'react'
import { useBrandTokens } from '../brand-hooks.ts'

export interface SettingsScreenProps {
  title?: string
  children: ReactNode
}

// Web parent <main>/<body>/<html> have no defined height by default, so the
// flex:1 on `outer` collapses unless we fill the viewport. Mobile gets a
// flex-filled Screen from the navigator and ignores this. Same pattern as
// AuthScreen (2026-05-28 fix).
const WEB_VIEWPORT_FILL = Platform.OS === 'web' ? ({ minHeight: '100vh' as unknown as number }) : null

export function SettingsScreen({ title = 'Settings', children }: SettingsScreenProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  return (
    <View style={[styles.outer, { backgroundColor: semantic.bg.app }, WEB_VIEWPORT_FILL]}>
      <View style={styles.column}>
        <Text
          accessibilityRole="header"
          accessibilityLevel={1}
          style={[styles.title, { color: semantic.text.primary }]}
        >
          {title}
        </Text>
        {children}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  column: {
    width: '100%',
    maxWidth: 560,
    gap: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
})
```

- [ ] **Step 6: Implement SettingsSection**

Create `packages/officials-ui/src/settings/SettingsSection.tsx`:

```tsx
'use client'

import { Children, type ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useBrandTokens } from '../brand-hooks.ts'

export interface SettingsSectionProps {
  title?: string
  description?: string
  children: ReactNode
}

export function SettingsSection({ title, description, children }: SettingsSectionProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const items = Children.toArray(children)
  return (
    <View style={styles.section}>
      {title ? (
        <Text
          accessibilityRole="header"
          accessibilityLevel={2}
          style={[styles.title, { color: semantic.text.muted }]}
        >
          {title.toUpperCase()}
        </Text>
      ) : null}
      {description ? (
        <Text style={[styles.description, { color: semantic.text.muted }]}>{description}</Text>
      ) : null}
      <View style={[styles.card, { backgroundColor: semantic.bg.card, borderColor: semantic.border.default }]}>
        {items.map((child, idx) => (
          <View key={idx}>
            {child}
            {idx < items.length - 1 ? (
              <View
                data-divider="true"
                style={[styles.divider, { backgroundColor: semantic.border.default }]}
              />
            ) : null}
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  section: { gap: 6 },
  title: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  description: { fontSize: 13, marginBottom: 4 },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  divider: {
    height: 1,
    marginLeft: 16,
  },
})
```

Note: the divider element uses `data-divider="true"` so tests can grep for it. RNW passes `data-*` attributes through to the rendered DOM element.

- [ ] **Step 7: Add barrel exports**

Edit `packages/officials-ui/src/index.ts`. After the slice 38 block (around line 217-222 + the slice 38 theme row export), append:

```ts
// Slice 39 — settings architecture
export { SettingsRow, type SettingsRowProps } from './settings/SettingsRow.tsx'
export { SettingsScreen, type SettingsScreenProps } from './settings/SettingsScreen.tsx'
export { SettingsSection, type SettingsSectionProps } from './settings/SettingsSection.tsx'
```

- [ ] **Step 8: Run tests + typecheck**

Run: `pnpm --filter @chiaro/officials-ui test -- "Settings(Screen|Section)"`
Expected: PASS (7 tests across 2 files: 3 SettingsScreen + 4 SettingsSection).

Run: `pnpm --filter @chiaro/officials-ui typecheck`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/officials-ui/src/settings/SettingsRow.tsx packages/officials-ui/src/settings/SettingsScreen.tsx packages/officials-ui/src/settings/SettingsSection.tsx packages/officials-ui/test/settings/SettingsScreen.test.tsx packages/officials-ui/test/settings/SettingsSection.test.tsx packages/officials-ui/src/index.ts
git commit -m "feat(officials-ui): SettingsRow + SettingsScreen + SettingsSection

Slice 39 task 2. Base building blocks: SettingsRow (rarely used
directly, foundation for variants), SettingsScreen (viewport
container + h1 title with web viewport-fill), SettingsSection
(card-grouped section + optional uppercase h2 + auto dividers
between children).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: SettingsNavRow

**Files:**
- Create: `packages/officials-ui/src/settings/SettingsNavRow.tsx`
- Create: `packages/officials-ui/test/settings/SettingsNavRow.test.tsx`
- Modify: `packages/officials-ui/src/index.ts` — add export

Nav row: label + optional value preview + chevron. Smart-anchor on web when `href` is provided (Gotcha #19f).

- [ ] **Step 1: Write the failing test**

Create `packages/officials-ui/test/settings/SettingsNavRow.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'
import { SettingsNavRow } from '../../src/settings/SettingsNavRow.tsx'

function withMode(mode: 'light' | 'dark') {
  return ({ children }: { children: ReactNode }) =>
    createElement(BrandModeOverrideContext.Provider, { value: mode }, children)
}

describe('SettingsNavRow', () => {
  it('renders label + chevron', () => {
    const { getByText } = render(
      <SettingsNavRow label="Home address" onPress={() => {}} />,
      { wrapper: withMode('light') },
    )
    expect(getByText('Home address')).toBeTruthy()
    expect(getByText('›')).toBeTruthy()
  })

  it('renders value when provided', () => {
    const { getByText } = render(
      <SettingsNavRow label="Home address" value="123 Main St" onPress={() => {}} />,
      { wrapper: withMode('light') },
    )
    expect(getByText('123 Main St')).toBeTruthy()
  })

  it('calls onPress when the row is clicked (no href, Pressable path)', () => {
    const onPress = vi.fn()
    const { getByText } = render(
      <SettingsNavRow label="Home address" onPress={onPress} />,
      { wrapper: withMode('light') },
    )
    fireEvent.click(getByText('Home address'))
    expect(onPress).toHaveBeenCalled()
  })

  it('renders an <a href> on web when href is provided (smart-anchor)', () => {
    const { container } = render(
      <SettingsNavRow label="Home address" href="/settings/address" onPress={() => {}} />,
      { wrapper: withMode('light') },
    )
    const anchor = container.querySelector('a[href="/settings/address"]')
    expect(anchor).not.toBeNull()
  })

  it('calls onPress on plain left-click of the anchor (smart-anchor intercepts)', () => {
    const onPress = vi.fn()
    const { container } = render(
      <SettingsNavRow label="Home address" href="/settings/address" onPress={onPress} />,
      { wrapper: withMode('light') },
    )
    const anchor = container.querySelector('a') as HTMLAnchorElement
    fireEvent.click(anchor, { metaKey: false, ctrlKey: false, shiftKey: false, button: 0 })
    expect(onPress).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `pnpm --filter @chiaro/officials-ui test -- SettingsNavRow`
Expected: FAIL with `Cannot find module '../../src/settings/SettingsNavRow.tsx'`.

- [ ] **Step 3: Implement SettingsNavRow**

Create `packages/officials-ui/src/settings/SettingsNavRow.tsx`:

```tsx
'use client'

import { createElement, type MouseEvent } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'
import { useBrandTokens } from '../brand-hooks.ts'
import { SettingsRow } from './SettingsRow.tsx'

export interface SettingsNavRowProps {
  label: string
  value?: string
  onPress: () => void
  href?: string
}

export function SettingsNavRow({ label, value, onPress, href }: SettingsNavRowProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const content = (
    <>
      <Text style={[styles.label, { color: semantic.text.primary }]}>{label}</Text>
      <View style={styles.right}>
        {value ? <Text style={[styles.value, { color: semantic.text.muted }]}>{value}</Text> : null}
        <Text style={[styles.chevron, { color: semantic.text.muted }]}>›</Text>
      </View>
    </>
  )

  // Smart-anchor (Gotcha #19f + slice 14 AlignmentChip): real <a href> with
  // intercepted plain-left-clicks. Modifier-key clicks (Cmd/Ctrl/Shift, middle)
  // fall through to browser default → restores new-tab semantics, link
  // prefetch, status-bar URL preview.
  if (Platform.OS === 'web' && href) {
    return createElement(
      'a',
      {
        href,
        onClick: (e: MouseEvent) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return
          e.preventDefault()
          onPress()
        },
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          minHeight: 56,
          padding: '12px 16px',
          color: 'inherit',
          textDecoration: 'none',
          cursor: 'pointer',
        },
      },
      content,
    )
  }

  return (
    <SettingsRow onPress={onPress} accessibilityRole="link" accessibilityLabel={label}>
      {content}
    </SettingsRow>
  )
}

const styles = StyleSheet.create({
  label: { flex: 1, fontSize: 15 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  value: { fontSize: 14 },
  chevron: { fontSize: 20 },
})
```

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm --filter @chiaro/officials-ui test -- SettingsNavRow`
Expected: PASS (5 tests).

- [ ] **Step 5: Add barrel export**

Edit `packages/officials-ui/src/index.ts`. Inside the existing slice 39 settings block (added in Task 2), append:

```ts
export { SettingsNavRow, type SettingsNavRowProps } from './settings/SettingsNavRow.tsx'
```

- [ ] **Step 6: Verify typecheck**

Run: `pnpm --filter @chiaro/officials-ui typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/officials-ui/src/settings/SettingsNavRow.tsx packages/officials-ui/test/settings/SettingsNavRow.test.tsx packages/officials-ui/src/index.ts
git commit -m "feat(officials-ui): SettingsNavRow w/ smart-anchor

Slice 39 task 3. Nav row: label + optional value preview + chevron.
Web: real <a href> with intercepted plain-click (cmd/ctrl/shift/middle
fall through). Native: SettingsRow Pressable. Pattern from
Gotcha #19f + slice 14 AlignmentChip + slice 18 M6.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: SettingsActionRow + SettingsToggleRow

**Files:**
- Create: `packages/officials-ui/src/settings/SettingsActionRow.tsx`
- Create: `packages/officials-ui/src/settings/SettingsToggleRow.tsx`
- Create: `packages/officials-ui/test/settings/SettingsActionRow.test.tsx`
- Create: `packages/officials-ui/test/settings/SettingsToggleRow.test.tsx`
- Modify: `packages/officials-ui/src/index.ts` — add exports

- [ ] **Step 1: Write SettingsActionRow test**

Create `packages/officials-ui/test/settings/SettingsActionRow.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { BRAND_SEMANTIC } from '@chiaro/ui-tokens'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'
import { SettingsActionRow } from '../../src/settings/SettingsActionRow.tsx'

function withMode(mode: 'light' | 'dark') {
  return ({ children }: { children: ReactNode }) =>
    createElement(BrandModeOverrideContext.Provider, { value: mode }, children)
}

describe('SettingsActionRow', () => {
  it('renders label and calls onPress when clicked', () => {
    const onPress = vi.fn()
    const { getByText } = render(
      <SettingsActionRow label="Sign out" onPress={onPress} />,
      { wrapper: withMode('light') },
    )
    expect(getByText('Sign out')).toBeTruthy()
    fireEvent.click(getByText('Sign out'))
    expect(onPress).toHaveBeenCalled()
  })

  it('non-danger uses text.primary color', () => {
    const { getByText } = render(
      <SettingsActionRow label="Sign out" onPress={() => {}} />,
      { wrapper: withMode('light') },
    )
    const text = getByText('Sign out')
    const inlineStyle = text.getAttribute('style') ?? ''
    expect(inlineStyle).toContain(BRAND_SEMANTIC.light.text.primary)
  })

  it('danger variant uses alert.danger.fg color', () => {
    const { getByText } = render(
      <SettingsActionRow label="Sign out" danger onPress={() => {}} />,
      { wrapper: withMode('light') },
    )
    const text = getByText('Sign out')
    const inlineStyle = text.getAttribute('style') ?? ''
    expect(inlineStyle).toContain(BRAND_SEMANTIC.light.alert.danger.fg)
  })
})
```

- [ ] **Step 2: Write SettingsToggleRow test**

Create `packages/officials-ui/test/settings/SettingsToggleRow.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'
import { SettingsToggleRow } from '../../src/settings/SettingsToggleRow.tsx'

function withMode(mode: 'light' | 'dark') {
  return ({ children }: { children: ReactNode }) =>
    createElement(BrandModeOverrideContext.Provider, { value: mode }, children)
}

describe('SettingsToggleRow', () => {
  it('renders label and switch element', () => {
    const { getByText, container } = render(
      <SettingsToggleRow label="Push notifications" value={false} onChange={() => {}} />,
      { wrapper: withMode('light') },
    )
    expect(getByText('Push notifications')).toBeTruthy()
    expect(container.querySelector('[role="switch"]')).not.toBeNull()
  })

  it('calls onChange with the next value when toggled', () => {
    const onChange = vi.fn()
    const { container } = render(
      <SettingsToggleRow label="Push notifications" value={false} onChange={onChange} />,
      { wrapper: withMode('light') },
    )
    const sw = container.querySelector('[role="switch"]') as HTMLElement
    fireEvent.click(sw)
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('disabled blocks onChange', () => {
    const onChange = vi.fn()
    const { container } = render(
      <SettingsToggleRow label="Push notifications" value={false} onChange={onChange} disabled />,
      { wrapper: withMode('light') },
    )
    const sw = container.querySelector('[role="switch"]') as HTMLElement
    fireEvent.click(sw)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('renders description below label when provided', () => {
    const { getByText } = render(
      <SettingsToggleRow
        label="Push notifications"
        description="Send alerts when bills you follow get scheduled"
        value={false}
        onChange={() => {}}
      />,
      { wrapper: withMode('light') },
    )
    expect(getByText('Send alerts when bills you follow get scheduled')).toBeTruthy()
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter @chiaro/officials-ui test -- "Settings(Action|Toggle)Row"`
Expected: FAIL with `Cannot find module` errors for both files.

- [ ] **Step 4: Implement SettingsActionRow**

Create `packages/officials-ui/src/settings/SettingsActionRow.tsx`:

```tsx
'use client'

import { StyleSheet, Text } from 'react-native'
import { useBrandTokens } from '../brand-hooks.ts'
import { SettingsRow } from './SettingsRow.tsx'

export interface SettingsActionRowProps {
  label: string
  onPress: () => void
  danger?: boolean
}

export function SettingsActionRow({ label, onPress, danger }: SettingsActionRowProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const color = danger ? semantic.alert.danger.fg : semantic.text.primary
  return (
    <SettingsRow onPress={onPress} accessibilityLabel={label}>
      <Text style={[styles.label, { color }]}>{label}</Text>
    </SettingsRow>
  )
}

const styles = StyleSheet.create({
  label: { flex: 1, fontSize: 15 },
})
```

- [ ] **Step 5: Implement SettingsToggleRow**

Create `packages/officials-ui/src/settings/SettingsToggleRow.tsx`:

```tsx
'use client'

import { StyleSheet, Switch, Text, View } from 'react-native'
import { useBrandTokens } from '../brand-hooks.ts'

export interface SettingsToggleRowProps {
  label: string
  description?: string
  value: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
}

export function SettingsToggleRow({
  label,
  description,
  value,
  onChange,
  disabled,
}: SettingsToggleRowProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const opacity = disabled ? 0.5 : 1
  return (
    <View
      style={styles.row}
      aria-disabled={disabled}
      accessibilityState={{ disabled: !!disabled }}
    >
      <View style={styles.labelGroup}>
        <Text style={[styles.label, { color: semantic.text.primary, opacity }]}>{label}</Text>
        {description ? (
          <Text style={[styles.description, { color: semantic.text.muted, opacity }]}>{description}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={disabled ? undefined : onChange}
        disabled={disabled}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  labelGroup: { flex: 1, gap: 2 },
  label: { fontSize: 15 },
  description: { fontSize: 13 },
})
```

- [ ] **Step 6: Add barrel exports**

Edit `packages/officials-ui/src/index.ts`. Inside the slice 39 settings block, append:

```ts
export { SettingsActionRow, type SettingsActionRowProps } from './settings/SettingsActionRow.tsx'
export { SettingsToggleRow, type SettingsToggleRowProps } from './settings/SettingsToggleRow.tsx'
```

- [ ] **Step 7: Run tests + typecheck**

Run: `pnpm --filter @chiaro/officials-ui test -- "Settings(Action|Toggle)Row"`
Expected: PASS (7 tests across 2 files: 3 ActionRow + 4 ToggleRow).

Run: `pnpm --filter @chiaro/officials-ui typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/officials-ui/src/settings/SettingsActionRow.tsx packages/officials-ui/src/settings/SettingsToggleRow.tsx packages/officials-ui/test/settings/SettingsActionRow.test.tsx packages/officials-ui/test/settings/SettingsToggleRow.test.tsx packages/officials-ui/src/index.ts
git commit -m "feat(officials-ui): SettingsActionRow + SettingsToggleRow

Slice 39 task 4. Action row: label + onPress with optional `danger`
variant (semantic.alert.danger.fg). Toggle row: label + RN Switch
with optional description; disabled state with aria-disabled.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: SettingsValueRow + SettingsComingSoonRow

**Files:**
- Create: `packages/officials-ui/src/settings/SettingsValueRow.tsx`
- Create: `packages/officials-ui/src/settings/SettingsComingSoonRow.tsx`
- Create: `packages/officials-ui/test/settings/SettingsValueComingSoonRow.test.tsx` (combined)
- Modify: `packages/officials-ui/src/index.ts` — add exports

- [ ] **Step 1: Write the combined test file**

Create `packages/officials-ui/test/settings/SettingsValueComingSoonRow.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'
import { SettingsValueRow } from '../../src/settings/SettingsValueRow.tsx'
import { SettingsComingSoonRow } from '../../src/settings/SettingsComingSoonRow.tsx'

function withMode(mode: 'light' | 'dark') {
  return ({ children }: { children: ReactNode }) =>
    createElement(BrandModeOverrideContext.Provider, { value: mode }, children)
}

describe('SettingsValueRow', () => {
  it('renders label and right-aligned value', () => {
    const { getByText } = render(
      <SettingsValueRow label="Version" value="1.2.3" />,
      { wrapper: withMode('light') },
    )
    expect(getByText('Version')).toBeTruthy()
    expect(getByText('1.2.3')).toBeTruthy()
  })
})

describe('SettingsComingSoonRow', () => {
  it('renders label and "Coming soon" badge', () => {
    const { getByText } = render(
      <SettingsComingSoonRow label="Display name" />,
      { wrapper: withMode('light') },
    )
    expect(getByText('Display name')).toBeTruthy()
    expect(getByText('Coming soon')).toBeTruthy()
  })

  it('renders description below label when provided', () => {
    const { getByText } = render(
      <SettingsComingSoonRow label="Avatar" description="Upload a profile picture" />,
      { wrapper: withMode('light') },
    )
    expect(getByText('Upload a profile picture')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `pnpm --filter @chiaro/officials-ui test -- SettingsValueComingSoonRow`
Expected: FAIL with `Cannot find module` errors.

- [ ] **Step 3: Implement SettingsValueRow**

Create `packages/officials-ui/src/settings/SettingsValueRow.tsx`:

```tsx
'use client'

import { StyleSheet, Text, View } from 'react-native'
import { useBrandTokens } from '../brand-hooks.ts'

export interface SettingsValueRowProps {
  label: string
  value: string
}

export function SettingsValueRow({ label, value }: SettingsValueRowProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: semantic.text.primary }]}>{label}</Text>
      <Text style={[styles.value, { color: semantic.text.muted }]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  label: { fontSize: 15, flex: 1 },
  value: { fontSize: 14 },
})
```

- [ ] **Step 4: Implement SettingsComingSoonRow**

Create `packages/officials-ui/src/settings/SettingsComingSoonRow.tsx`:

```tsx
'use client'

import { StyleSheet, Text, View } from 'react-native'
import { useBrandTokens } from '../brand-hooks.ts'

export interface SettingsComingSoonRowProps {
  label: string
  description?: string
}

export function SettingsComingSoonRow({ label, description }: SettingsComingSoonRowProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  return (
    <View style={styles.row}>
      <View style={styles.labelGroup}>
        <Text style={[styles.label, { color: semantic.text.primary, opacity: 0.6 }]}>{label}</Text>
        {description ? (
          <Text style={[styles.description, { color: semantic.text.muted }]}>{description}</Text>
        ) : null}
      </View>
      <View style={[styles.badge, { backgroundColor: semantic.bg.subtle }]}>
        <Text style={[styles.badgeText, { color: semantic.text.muted }]}>Coming soon</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  labelGroup: { flex: 1, gap: 2 },
  label: { fontSize: 15 },
  description: { fontSize: 13 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  badgeText: { fontSize: 11, fontWeight: '600' },
})
```

- [ ] **Step 5: Add barrel exports**

Edit `packages/officials-ui/src/index.ts`. Inside the slice 39 settings block, append:

```ts
export { SettingsValueRow, type SettingsValueRowProps } from './settings/SettingsValueRow.tsx'
export { SettingsComingSoonRow, type SettingsComingSoonRowProps } from './settings/SettingsComingSoonRow.tsx'
```

- [ ] **Step 6: Run tests + typecheck**

Run: `pnpm --filter @chiaro/officials-ui test -- SettingsValueComingSoonRow`
Expected: PASS (3 tests).

Run: `pnpm --filter @chiaro/officials-ui typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/officials-ui/src/settings/SettingsValueRow.tsx packages/officials-ui/src/settings/SettingsComingSoonRow.tsx packages/officials-ui/test/settings/SettingsValueComingSoonRow.test.tsx packages/officials-ui/src/index.ts
git commit -m "feat(officials-ui): SettingsValueRow + SettingsComingSoonRow

Slice 39 task 5. Value row: label + right-aligned read-only text.
ComingSoon row: label + 'Coming soon' badge + optional description.
Both non-interactive.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: CalibrateScreen

**Files:**
- Create: `packages/officials-ui/src/calibrate/CalibrateScreen.tsx`
- Create: `packages/officials-ui/test/calibrate/CalibrateScreen.test.tsx`
- Modify: `packages/officials-ui/src/index.ts` — add export

- [ ] **Step 1: Write the failing test**

Create `packages/officials-ui/test/calibrate/CalibrateScreen.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'
import { CalibrateScreen } from '../../src/calibrate/CalibrateScreen.tsx'

function withMode(mode: 'light' | 'dark') {
  return ({ children }: { children: ReactNode }) =>
    createElement(BrandModeOverrideContext.Provider, { value: mode }, children)
}

describe('CalibrateScreen', () => {
  it('renders default title, description, input, CTA, and Skip', () => {
    const { getByText, container } = render(
      <CalibrateScreen onSubmit={async () => {}} onSkip={() => {}} />,
      { wrapper: withMode('light') },
    )
    expect(getByText('Set your home location')).toBeTruthy()
    expect(getByText(/elected officials representing/)).toBeTruthy()
    expect(container.querySelector('input')).not.toBeNull()
    expect(getByText('Calibrate')).toBeTruthy()
    expect(getByText('Skip for now')).toBeTruthy()
  })

  it('omits Skip link when onSkip is not provided', () => {
    const { queryByText } = render(
      <CalibrateScreen onSubmit={async () => {}} />,
      { wrapper: withMode('light') },
    )
    expect(queryByText('Skip for now')).toBeNull()
  })

  it('calls onSubmit with the typed address when CTA is pressed', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const { getByText, container } = render(
      <CalibrateScreen onSubmit={onSubmit} />,
      { wrapper: withMode('light') },
    )
    const input = container.querySelector('input') as HTMLInputElement
    fireEvent.change(input, { target: { value: '123 Main St' } })
    await act(async () => {
      fireEvent.click(getByText('Calibrate'))
    })
    expect(onSubmit).toHaveBeenCalledWith('123 Main St')
  })

  it('shows error message when onSubmit throws', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Address lookup failed'))
    const { getByText, findByText } = render(
      <CalibrateScreen onSubmit={onSubmit} />,
      { wrapper: withMode('light') },
    )
    await act(async () => {
      fireEvent.click(getByText('Calibrate'))
    })
    expect(await findByText('Address lookup failed')).toBeTruthy()
  })

  it('disables CTA while loading and shows loadingLabel', async () => {
    let resolveSubmit: () => void = () => {}
    const onSubmit = vi.fn().mockImplementation(() => new Promise<void>((res) => { resolveSubmit = res }))
    const { getByText } = render(
      <CalibrateScreen onSubmit={onSubmit} />,
      { wrapper: withMode('light') },
    )
    fireEvent.click(getByText('Calibrate'))
    await waitFor(() => expect(getByText('Calibrating…')).toBeTruthy())
    await act(async () => { resolveSubmit() })
  })

  it('calls onSkip when Skip link is pressed', () => {
    const onSkip = vi.fn()
    const { getByText } = render(
      <CalibrateScreen onSubmit={async () => {}} onSkip={onSkip} />,
      { wrapper: withMode('light') },
    )
    fireEvent.click(getByText('Skip for now'))
    expect(onSkip).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `pnpm --filter @chiaro/officials-ui test -- CalibrateScreen`
Expected: FAIL with `Cannot find module '../../src/calibrate/CalibrateScreen.tsx'`.

- [ ] **Step 3: Implement CalibrateScreen**

Create `packages/officials-ui/src/calibrate/CalibrateScreen.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useBrandTokens } from '../brand-hooks.ts'
import { BrandTextInput } from '../inputs/BrandTextInput.tsx'

export interface CalibrateScreenProps {
  title?: string
  description?: string
  initialAddress?: string
  onSubmit: (address: string) => Promise<void>
  onSkip?: () => void
  submitLabel?: string
  loadingLabel?: string
}

const WEB_VIEWPORT_FILL = Platform.OS === 'web' ? ({ minHeight: '100vh' as unknown as number }) : null

export function CalibrateScreen({
  title = 'Set your home location',
  description = "We'll use this to show you the elected officials representing your address.",
  initialAddress = '',
  onSubmit,
  onSkip,
  submitLabel = 'Calibrate',
  loadingLabel = 'Calibrating…',
}: CalibrateScreenProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const [address, setAddress] = useState(initialAddress)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setError(null)
    setLoading(true)
    try {
      await onSubmit(address)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={[styles.outer, { backgroundColor: semantic.bg.app }, WEB_VIEWPORT_FILL]}>
      <View style={[styles.card, { backgroundColor: semantic.bg.elevated }]}>
        <Text style={[styles.title, { color: semantic.text.primary }]}>{title}</Text>
        <Text style={[styles.description, { color: semantic.text.muted }]}>{description}</Text>
        <BrandTextInput
          label="Address"
          value={address}
          onChangeText={setAddress}
          placeholder="123 Main St, Brooklyn, NY 11201"
        />
        {error ? (
          <Text role="alert" style={[styles.error, { color: semantic.alert.danger.fg }]}>{error}</Text>
        ) : null}
        <Pressable
          onPress={loading ? undefined : handleSubmit}
          accessibilityRole="button"
          accessibilityState={{ disabled: loading }}
          aria-disabled={loading}
          style={[styles.cta, { backgroundColor: semantic.accent.primary, opacity: loading ? 0.6 : 1 }]}
        >
          <Text style={[styles.ctaText, { color: semantic.text.onAccent }]}>
            {loading ? loadingLabel : submitLabel}
          </Text>
        </Pressable>
        {onSkip ? (
          <Pressable onPress={onSkip} accessibilityRole="button" style={styles.skip}>
            <Text style={[styles.skipText, { color: semantic.text.muted }]}>Skip for now</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 30,
    gap: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  title: { fontSize: 22, fontWeight: '700' },
  description: { fontSize: 14, lineHeight: 20 },
  error: { fontSize: 13 },
  cta: { borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  ctaText: { fontSize: 15, fontWeight: '600' },
  skip: { alignItems: 'center', paddingVertical: 8 },
  skipText: { fontSize: 14 },
})
```

- [ ] **Step 4: Add barrel export**

Edit `packages/officials-ui/src/index.ts`. Inside the slice 39 settings block (right after Task 5 exports), add:

```ts
// Slice 39 — calibrate
export { CalibrateScreen, type CalibrateScreenProps } from './calibrate/CalibrateScreen.tsx'
```

- [ ] **Step 5: Run tests + typecheck**

Run: `pnpm --filter @chiaro/officials-ui test -- CalibrateScreen`
Expected: PASS (6 tests).

Run: `pnpm --filter @chiaro/officials-ui typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/officials-ui/src/calibrate/CalibrateScreen.tsx packages/officials-ui/test/calibrate/CalibrateScreen.test.tsx packages/officials-ui/src/index.ts
git commit -m "feat(officials-ui): CalibrateScreen

Slice 39 task 6. Parallel to AuthScreen (slice 33) — centered card
on viewport-fill brand background. Uses BrandTextInput (Task 1) for
address entry. Internal loading + error state; throws from onSubmit
show as error text. Skip link conditional on onSkip prop.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Web settings page rewrite

**Files:**
- Modify: `apps/web/app/settings/page.tsx`

Replace the 3-row placeholder with the 5-section declarative composition.

- [ ] **Step 1: Replace settings page contents**

Replace the entire contents of `apps/web/app/settings/page.tsx` with:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import {
  BrandModeThemeRow,
  SettingsActionRow,
  SettingsComingSoonRow,
  SettingsNavRow,
  SettingsScreen,
  SettingsSection,
  SettingsToggleRow,
  SettingsValueRow,
} from '@chiaro/officials-ui'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev'

export default function SettingsIndex() {
  const router = useRouter()

  async function handleSignOut() {
    document.cookie = 'chiaro_skip_calibrate=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/sign-in')
    router.refresh()
  }

  return (
    <SettingsScreen>
      <SettingsSection title="Account">
        <SettingsNavRow
          label="Home address"
          href="/settings/address"
          onPress={() => router.push('/settings/address')}
        />
        <SettingsActionRow label="Sign out" danger onPress={handleSignOut} />
      </SettingsSection>

      <SettingsSection title="Appearance">
        <BrandModeThemeRow />
      </SettingsSection>

      <SettingsSection title="Notifications" description="Coming soon">
        <SettingsToggleRow label="Push notifications" value={false} disabled onChange={() => {}} />
        <SettingsToggleRow label="Email digest" value={false} disabled onChange={() => {}} />
      </SettingsSection>

      <SettingsSection title="Profile">
        <SettingsComingSoonRow label="Display name" />
        <SettingsComingSoonRow label="Avatar" />
      </SettingsSection>

      <SettingsSection title="About">
        <SettingsValueRow label="Version" value={APP_VERSION} />
        <SettingsNavRow
          label="Privacy policy"
          href="/legal/privacy"
          onPress={() => router.push('/legal/privacy')}
        />
        <SettingsNavRow
          label="Terms of service"
          href="/legal/terms"
          onPress={() => router.push('/legal/terms')}
        />
      </SettingsSection>
    </SettingsScreen>
  )
}
```

- [ ] **Step 2: Verify typecheck + build**

Run: `pnpm --filter @chiaro/web typecheck`
Expected: PASS.

Run: `pnpm --filter @chiaro/web build`
Expected: PASS. Note the new `/settings` route bundle size for the closeout commit.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/settings/page.tsx
git commit -m "feat(web): replace settings page with declarative composition

Slice 39 task 7. Web settings becomes 5 sections (Account /
Appearance / Notifications / Profile / About) composed from the
slice 39 settings components. Sign-out moves into Account section
with destructive (red) styling. Notifications + Profile ship as
disabled / coming-soon placeholders. About surfaces version + legal
link destinations (the /legal routes are follow-up scope).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Web calibrate page rewrite

**Files:**
- Modify: `apps/web/app/calibrate/page.tsx`

- [ ] **Step 1: Replace calibrate page contents**

Replace the entire contents of `apps/web/app/calibrate/page.tsx` with:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { CalibrateScreen } from '@chiaro/officials-ui'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { addressInputSchema } from '@chiaro/location'

export default function CalibratePage(): React.JSX.Element {
  const router = useRouter()

  async function handleSubmit(address: string) {
    const parsed = addressInputSchema.safeParse({ address })
    if (!parsed.success) throw new Error('Enter a complete address (street, city, state, ZIP).')

    const supabase = createSupabaseBrowserClient()
    const { error: invokeErr } = await supabase.functions.invoke('calibrate-location', {
      body: { address: parsed.data.address },
    })
    if (invokeErr) {
      const status = (invokeErr as { context?: { status?: number } }).context?.status
      if (status === 400) throw new Error("We couldn't find that address. Double-check spelling.")
      if (status === 422) throw new Error("We can't resolve districts for that location yet.")
      if (status === 502) throw new Error("Address lookup is temporarily unavailable. Try again.")
      throw new Error("Something went wrong saving your location. Try again.")
    }
    router.push('/')
    router.refresh()
  }

  function handleSkip() {
    document.cookie = 'chiaro_skip_calibrate=1; path=/'
    router.push('/')
  }

  return <CalibrateScreen onSubmit={handleSubmit} onSkip={handleSkip} />
}
```

- [ ] **Step 2: Verify typecheck + build**

Run: `pnpm --filter @chiaro/web typecheck`
Expected: PASS.

Run: `pnpm --filter @chiaro/web build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/calibrate/page.tsx
git commit -m "feat(web): replace calibrate page with CalibrateScreen composition

Slice 39 task 8. /calibrate becomes a thin shell around the slice 39
CalibrateScreen component. All existing logic preserved: validation
via addressInputSchema, Edge Function invocation with same status →
message mapping, skip cookie flow.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Mobile settings page rewrite

**Files:**
- Modify: `apps/mobile/app/(app)/settings/index.tsx`

The implementer should first verify whether `apps/mobile/app/(app)/calibrate.tsx` exists or whether mobile uses an `(auth)`-flow calibrate. If a parallel mobile calibrate route exists, also refactor it as a follow-up step within this task; if not, skip the mobile calibrate refactor (per spec §11 risk).

- [ ] **Step 1: Replace mobile settings page contents**

Replace the entire contents of `apps/mobile/app/(app)/settings/index.tsx` with:

```tsx
import { useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  BrandModeThemeRow,
  SettingsActionRow,
  SettingsComingSoonRow,
  SettingsNavRow,
  SettingsScreen,
  SettingsSection,
  SettingsToggleRow,
  SettingsValueRow,
} from '@chiaro/officials-ui'
import { supabase } from '@/lib/supabase'

const APP_VERSION = process.env.EXPO_PUBLIC_APP_VERSION ?? 'dev'

export default function SettingsIndex() {
  const router = useRouter()

  async function handleSignOut() {
    await AsyncStorage.removeItem('chiaro_skip_calibrate')
    await supabase.auth.signOut()
    router.replace('/sign-in')
  }

  return (
    <SettingsScreen>
      <SettingsSection title="Account">
        <SettingsNavRow
          label="Home address"
          onPress={() => router.push('/settings/address')}
        />
        <SettingsActionRow label="Sign out" danger onPress={handleSignOut} />
      </SettingsSection>

      <SettingsSection title="Appearance">
        <BrandModeThemeRow />
      </SettingsSection>

      <SettingsSection title="Notifications" description="Coming soon">
        <SettingsToggleRow label="Push notifications" value={false} disabled onChange={() => {}} />
        <SettingsToggleRow label="Email digest" value={false} disabled onChange={() => {}} />
      </SettingsSection>

      <SettingsSection title="Profile">
        <SettingsComingSoonRow label="Display name" />
        <SettingsComingSoonRow label="Avatar" />
      </SettingsSection>

      <SettingsSection title="About">
        <SettingsValueRow label="Version" value={APP_VERSION} />
        <SettingsNavRow label="Privacy policy" onPress={() => router.push('/legal/privacy')} />
        <SettingsNavRow label="Terms of service" onPress={() => router.push('/legal/terms')} />
      </SettingsSection>
    </SettingsScreen>
  )
}
```

Notes for the implementer:
- Mobile `SettingsNavRow` calls omit `href` (web-only metadata; no effect on native).
- `expo-router`'s `useRouter` `push()` accepts string paths declared in the typed routes manifest. Paths used here (`/settings/address`, `/sign-in`, `/legal/privacy`, `/legal/terms`) may not all exist; if typecheck fails on a path, cast the argument with `as never` per existing convention in `apps/mobile/`.

- [ ] **Step 2: Check for mobile calibrate route**

Check whether `apps/mobile/app/(app)/calibrate.tsx` or any other mobile calibrate route exists:

Run: `pnpm exec ls -la apps/mobile/app/\\(app\\)/calibrate.tsx 2>&1 || echo NOT_FOUND`

If found, refactor that file to use `CalibrateScreen` from `@chiaro/officials-ui` mirroring Task 8 with `expo-router` instead of `next/navigation`. If `NOT_FOUND`, skip — mobile calibrate is a follow-up.

- [ ] **Step 3: Verify mobile typecheck**

Run: `pnpm --filter @chiaro/mobile typecheck`
Expected: PASS. If typecheck fails on `router.push('/legal/privacy')` etc., cast the argument: `router.push('/legal/privacy' as never)`.

- [ ] **Step 4: Commit**

```bash
git add "apps/mobile/app/(app)/settings/index.tsx"
# also stage apps/mobile/app/(app)/calibrate.tsx if Step 2 found+modified it
git commit -m "feat(mobile): replace settings page with declarative composition

Slice 39 task 9. Mobile settings mirrors the web composition with
expo-router's useRouter for nav callbacks. Same 5 sections, same
component tree, different nav glue.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Final verification + CLAUDE.md + mobile DoD

**Files:**
- Modify: `CLAUDE.md` — slice 39 entry in "Slices delivered"
- Modify: `docs/superpowers/mobile-dod-checklist.md` — slice 39 section

- [ ] **Step 1: Run full workspace typecheck**

Run: `pnpm -r typecheck`
Expected: PASS across all 11 workspace projects.

- [ ] **Step 2: Run full workspace tests**

Run: `pnpm test`
Expected: PASS for officials-ui (~30 new cases pass). Integration tests requiring Supabase env vars may fail; those are pre-existing per CLAUDE.md "Testing" section and Gotcha #1 — not slice 39 regressions.

- [ ] **Step 3: Run web build**

Run: `pnpm --filter @chiaro/web build`
Expected: PASS. Capture `/settings` and `/calibrate` route sizes for the closeout commit.

- [ ] **Step 4: Manual web smoke (Chrome)**

Walk through:
- `/settings`: 5 sections render in order (Account, Appearance, Notifications, Profile, About). Sign-out row uses red text. Toggle theme via Theme row — entire page repaints (rows + section headers + card backgrounds).
- `/settings` Home address NavRow: left-click navigates to `/settings/address`. Middle-click opens new tab (smart-anchor).
- `/settings` Notifications toggles: disabled, clicking has no effect.
- `/settings` Profile ComingSoon rows: non-interactive.
- `/settings` About: shows version string. Privacy/Terms nav rows attempt navigation (may 404 — acceptable for v1).
- `/calibrate`: centered card with title, description, address input, Calibrate CTA, Skip link. Try submitting an obviously bad address → error shows in card. Try Skip → routes to `/`.
- Both pages in dark mode: full repaint.

Record any visual bugs.

- [ ] **Step 5: Update CLAUDE.md**

Open `CLAUDE.md`, find the "Slices delivered" section (after the slice 38 follow-up entry), append at the end of the list (before "Specs live in..."):

```markdown
- **Slice 39 — Settings architecture + Calibrate refactor** (2026-05-28): Mega-Slice (~24 files). Replaces slice-1-era raw-HTML `/settings` and `/calibrate` with declarative cross-platform components in `@chiaro/officials-ui`. New `inputs/BrandTextInput` (extracted from slice 31 AuthInput; auth re-exports for back-compat), `calibrate/CalibrateScreen` (parallel to AuthScreen), and `settings/` family: `SettingsScreen` + `SettingsSection` + `SettingsRow` base + 5 variants (`Nav`, `Action`, `Toggle`, `Value`, `ComingSoon`). Settings becomes 5 sections (Account / Appearance / Notifications / Profile / About). Notifications + Profile ship as disabled / coming-soon placeholders; About surfaces version + legal-page nav destinations (the `/legal/*` routes themselves are follow-up scope). Calibrate page logic (addressInputSchema validation + Edge Function invocation + status → message mapping) preserved; only the shell changes. ~30 new vitest cases across 8 test files. No schema work; pgTAP unchanged at 428 plans.
```

- [ ] **Step 6: Update mobile DoD checklist**

Open `docs/superpowers/mobile-dod-checklist.md` and append:

```markdown
## Slice 39 — Settings architecture + Calibrate refactor

- [ ] Settings page shows 5 sections in order: Account, Appearance, Notifications, Profile, About.
- [ ] Sign-out row in Account section uses destructive (red) text.
- [ ] Tapping Home address navigates to /settings/address.
- [ ] Tapping Sign out signs out and routes to /sign-in.
- [ ] Theme row in Appearance section toggles brand mode; entire page repaints.
- [ ] Notifications toggles are disabled and don't respond to taps.
- [ ] Profile rows show "Coming soon" badge.
- [ ] About section shows version string.
- [ ] Privacy policy / Terms of service nav rows navigate (may 404 — acceptable for v1).
- [ ] /calibrate (if mobile route exists) shows centered card; Calibrate + Skip flows work.
- [ ] All Settings + Calibrate surfaces fully repaint in dark mode.
```

- [ ] **Step 7: Final commit**

```bash
git add CLAUDE.md docs/superpowers/mobile-dod-checklist.md
git commit -m "docs(slice-39): record slice 39 closeout

Slice 39 task 10. CLAUDE.md gets the Slices delivered entry; mobile
DoD checklist gains the slice 39 smoke section.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 8: Final summary to user**

Report:
- Commits on branch `slice-39-settings-architecture`: 1 (spec) + 1 (plan) + 10 (task commits) = 12 total.
- Files changed: 10 new components + 8 new tests + 5 edited + 1 renamed = 24.
- Test delta: ~+30 vitest cases.
- Bundle: web `/settings` + `/calibrate` route sizes pre/post.
- Smoke status: web verified, mobile deferred.

---

## Self-review notes

**Spec coverage:**
- §5 architecture (file structure) — Tasks 1-6 build the 10 components in the layout defined. ✅
- §6 component contracts — every component's props match the spec; Task 1 BrandTextInput preserves slice 31 surface; Tasks 2-6 use exact prop types. ✅
- §7 composition + data flow — Tasks 7-9 implement the declarative composition; calibrate logic preserved verbatim. ✅
- §8 cross-platform — `Platform.OS === 'web'` viewport-fill + smart-anchor pattern present in SettingsScreen, CalibrateScreen, SettingsNavRow. ✅
- §9 testing — 8 test files distributed across Tasks 1-6 with total ~30 cases. ✅
- §10 file count — 10 new components + 8 new tests + 5 edited + 1 renamed = 24, matches spec. ✅
- §11 risks acknowledged in Task 9 Step 2 (mobile calibrate existence check) and Task 9 Step 3 (typed routes cast). ✅
- §12 closeout criteria — Task 10 walks all of them. ✅

**Placeholder scan:** none. Every step has runnable code or exact commands.

**Type consistency:**
- `BrandTextInputProps` (Task 1) consumed by Task 6 `CalibrateScreen`. ✅
- `useBrandTokens()` `semantic.bg.app`, `text.primary`, `text.muted`, `bg.card`, `bg.subtle`, `bg.elevated`, `border.default`, `accent.primary`, `alert.danger.fg`, `text.onAccent` used consistently across tasks; all exist in `packages/ui-tokens/src/brand/semantic.ts`. ✅
- `SettingsRow`'s `accessibilityRole` defaults to `'button'` (Task 2); `SettingsNavRow` passes `'link'` explicitly (Task 3). ✅
- `BrandModeOverrideContext` (slice 33) used as test wrapper in every settings test file — same canonical pattern. ✅

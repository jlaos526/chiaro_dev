# Mobile DoD Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the officials-detail redesign + BioHeader polish + Finance placeholders from web to `apps/mobile/` (Expo Router + React Native), targeting Android + iOS, with full test framework setup.

**Architecture:** File-for-file mirror under `apps/mobile/components/` of every web component (`apps/web/components/`). Tokens and TanStack hooks already cross-platform — no changes to `@chiaro/ui-tokens` or `@chiaro/officials`. RN primitives (`View`, `Text`, `Pressable`, `ScrollView`, `Image`) replace HTML; `Linking.openURL` replaces `target="_blank"`; Expo Router search params (`?cat=...&sub=...`) replace web's URL hash fragment.

**Tech Stack:** React Native 0.81 · Expo SDK 54 · Expo Router 6 · TanStack Query 5 (existing) · `react-native-svg` (add) · `expo-linear-gradient` (add) · jest-expo (add) · `@testing-library/react-native` (add) · `react-native-safe-area-context` (existing)

**Spec:** `docs/superpowers/specs/2026-05-18-mobile-dod-parity-design.md`

---

## File structure

```
apps/mobile/
  components/
    cards/                          NEW
      PillChevron.tsx
      AlignmentChip.tsx
      DistrictBadge.tsx
      ComplianceIcon.tsx
      MetricCardShell.tsx
      EvidenceExpand.tsx
    bio/                            NEW
      BioPortrait.tsx
      BioIdentityRow.tsx
      BioServiceCard.tsx
      BioContactLinks.tsx
      BioAlignmentChipRow.tsx
      BioHeader.tsx
    finance/                        NEW
      FinanceSummaryStrip.tsx
      FinanceSubSectionHeading.tsx
      TopAmountBreakdown.tsx
    performance/                    NEW
      CategoryBar.tsx
      SubCascadeBar.tsx
      PerformanceSection.tsx
      useExpandedState.ts
      useExpoParamSync.ts
      categories/
        ServiceRecordCategory.tsx
        IssuePositionsCategory.tsx
        CommunityPresenceCategory.tsx
        FinanceCategory.tsx
        EthicsAccountabilityCategory.tsx
        VotingBillsCategory.tsx
    OfficialsCard.tsx               REWRITE
  app/(app)/officials/[id].tsx       REWRITE
  lib/derivations/                  NEW (copy-paste from web; pure JS)
    service-record.ts
    finance.ts
    alignment.ts
    teasers.ts
  jest.config.js                    NEW
  jest-setup.ts                     NEW
  test/
    components/cards/{6 files}.test.tsx
    components/bio/{3 files}.test.tsx       (BioPortrait, BioAlignmentChipRow, BioHeader)
    components/finance/TopAmountBreakdown.test.tsx
    components/performance/{4 files}.test.{ts,tsx}
  package.json                       modify (+ devDeps, + test script, + react-native-svg, + expo-linear-gradient)

apps/mobile/components/             DELETE (old slice-4)
  ConstituentConnectionCard.tsx
  FinanceCard.tsx
  MetricCardShell.tsx                (root path — distinct from new cards/MetricCardShell.tsx)
  OfficialDetail.tsx
  OfficialPerformance.tsx
  PositionSalaryCard.tsx
  ScorecardCard.tsx
  ShowUpWorkloadCard.tsx

docs/superpowers/mobile-dod-checklist.md   modify (extend with redesigned UI sections)
```

---

## Phase A — Foundations (Tasks 1-3)

### Task 1: Add test framework + dependencies

**Files:**
- Modify: `apps/mobile/package.json`
- Create: `apps/mobile/jest.config.js`
- Create: `apps/mobile/jest-setup.ts`

- [ ] **Step 1: Install dependencies**

Run from repo root:

```bash
pnpm --filter @chiaro/mobile add react-native-svg expo-linear-gradient
pnpm --filter @chiaro/mobile add -D jest-expo @testing-library/react-native @testing-library/jest-native jest @types/jest
```

Expected: `package.json` updated; lockfile regenerated.

- [ ] **Step 2: Add jest config**

`apps/mobile/jest.config.js`:

```js
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEach: ['<rootDir>/jest-setup.ts'],
  testMatch: ['<rootDir>/test/**/*.test.{ts,tsx}'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
}
```

- [ ] **Step 3: Add jest setup**

`apps/mobile/jest-setup.ts`:

```ts
import '@testing-library/jest-native/extend-expect'
import { cleanup } from '@testing-library/react-native'

afterEach(() => {
  cleanup()
})
```

- [ ] **Step 4: Add test script + verify typecheck**

In `apps/mobile/package.json` `scripts` block, add:

```json
"test": "jest"
```

Run:

```bash
pnpm --filter @chiaro/mobile typecheck 2>&1 | tail -3
```

Expected: clean (no test files yet but existing code compiles).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/package.json apps/mobile/jest.config.js apps/mobile/jest-setup.ts pnpm-lock.yaml
git commit -m "chore(mobile): add jest-expo + testing-library/react-native + RN deps (svg, linear-gradient)"
```

---

### Task 2: Smoke test the test framework

**Files:**
- Create: `apps/mobile/test/smoke.test.tsx`

Verify the framework runs before building real tests.

- [ ] **Step 1: Add smoke test**

`apps/mobile/test/smoke.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native'
import { Text } from 'react-native'

describe('smoke', () => {
  it('renders a Text node and finds it', () => {
    render(<Text>hello mobile tests</Text>)
    expect(screen.getByText('hello mobile tests')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run the test**

```bash
pnpm --filter @chiaro/mobile test 2>&1 | tail -10
```

Expected: `Tests: 1 passed`.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/test/smoke.test.tsx
git commit -m "test(mobile): smoke test verifying jest-expo + testing-library run"
```

---

### Task 3: Copy derivations + derivations pass through

**Files:**
- Create: `apps/mobile/lib/derivations/service-record.ts`
- Create: `apps/mobile/lib/derivations/finance.ts`
- Create: `apps/mobile/lib/derivations/alignment.ts`
- Create: `apps/mobile/lib/derivations/teasers.ts`

Pure JS functions, identical to web's `apps/web/lib/derivations/`. No React, no DOM — copy-paste verbatim.

- [ ] **Step 1: Copy files**

```bash
mkdir -p apps/mobile/lib/derivations
cp apps/web/lib/derivations/service-record.ts apps/mobile/lib/derivations/
cp apps/web/lib/derivations/finance.ts apps/mobile/lib/derivations/
cp apps/web/lib/derivations/alignment.ts apps/mobile/lib/derivations/
cp apps/web/lib/derivations/teasers.ts apps/mobile/lib/derivations/
```

- [ ] **Step 2: Verify import paths**

The web files use `@/lib/...` and relative `./` imports for cross-derivation references — both work the same way in mobile (Expo Router has `@/` aliased to `apps/mobile/` via `tsconfig.json` `paths`). Check `apps/mobile/tsconfig.json` confirms this; if `@/*` isn't aliased, add:

```json
{
  "compilerOptions": {
    "paths": { "@/*": ["./*"] }
  }
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @chiaro/mobile typecheck 2>&1 | tail -3
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/lib/derivations/ apps/mobile/tsconfig.json
git commit -m "feat(mobile): derivations copy-pasted from web (pure JS, cross-platform)"
```

---

## Phase B — Primitives (Tasks 4-9)

### Task 4: PillChevron

**Files:**
- Create: `apps/mobile/components/cards/PillChevron.tsx`
- Create: `apps/mobile/test/components/cards/PillChevron.test.tsx`

- [ ] **Step 1: Failing test**

`apps/mobile/test/components/cards/PillChevron.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native'
import { PillChevron } from '@/components/cards/PillChevron'

describe('PillChevron', () => {
  it('shows ▸ when closed', () => {
    render(<PillChevron open={false} />)
    expect(screen.getByText('▸')).toBeTruthy()
  })
  it('shows ▾ when open', () => {
    render(<PillChevron open={true} />)
    expect(screen.getByText('▾')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/mobile test components/cards/PillChevron 2>&1 | tail -5
```

Expected: 2 tests fail (no component).

- [ ] **Step 3: Implement**

`apps/mobile/components/cards/PillChevron.tsx`:

```tsx
import { View, Text } from 'react-native'

export interface PillChevronProps {
  open: boolean
  size?: 'sm' | 'md'
}

export function PillChevron({ open, size = 'md' }: PillChevronProps) {
  const dim = size === 'sm' ? 18 : 20
  return (
    <View
      style={{
        width: dim, height: dim, borderRadius: dim / 2,
        backgroundColor: '#f0eee5',
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#1a1714', fontSize: 10, fontWeight: '700' }}>
        {open ? '▾' : '▸'}
      </Text>
    </View>
  )
}
```

- [ ] **Step 4: Run green + commit**

```bash
pnpm --filter @chiaro/mobile test components/cards/PillChevron 2>&1 | tail -5
pnpm --filter @chiaro/mobile typecheck 2>&1 | tail -3
git add apps/mobile/components/cards/PillChevron.tsx apps/mobile/test/components/cards/PillChevron.test.tsx
git commit -m "feat(mobile): PillChevron primitive (RN)"
```

---

### Task 5: AlignmentChip

**Files:**
- Create: `apps/mobile/components/cards/AlignmentChip.tsx`
- Create: `apps/mobile/test/components/cards/AlignmentChip.test.tsx`

- [ ] **Step 1: Failing test**

`apps/mobile/test/components/cards/AlignmentChip.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react-native'
import { AlignmentChip } from '@/components/cards/AlignmentChip'

// Mock expo-router's useRouter
const pushMock = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: pushMock }),
}))

describe('AlignmentChip', () => {
  beforeEach(() => pushMock.mockClear())

  it('renders the label', () => {
    render(<AlignmentChip label="Environment" tier="strongly-aligned" />)
    expect(screen.getByText('Environment')).toBeTruthy()
  })

  it('press navigates when href provided', () => {
    render(<AlignmentChip label="Environment" tier="strongly-aligned" href="/officials/abc?cat=issue-positions&sub=environment" />)
    fireEvent.press(screen.getByText('Environment'))
    expect(pushMock).toHaveBeenCalledWith('/officials/abc?cat=issue-positions&sub=environment')
  })

  it('no press when href absent', () => {
    render(<AlignmentChip label="Environment" tier="strongly-aligned" />)
    fireEvent.press(screen.getByText('Environment'))
    expect(pushMock).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/mobile test components/cards/AlignmentChip 2>&1 | tail -10
```

Expected: 3 tests fail.

- [ ] **Step 3: Implement**

`apps/mobile/components/cards/AlignmentChip.tsx`:

```tsx
import { Text, Pressable, View } from 'react-native'
import { useRouter } from 'expo-router'
import { type AlignmentTier, ALIGNMENT_CHIP_COLORS } from '@chiaro/ui-tokens'

export interface AlignmentChipProps {
  label: string
  tier: AlignmentTier
  href?: string
}

export function AlignmentChip({ label, tier, href }: AlignmentChipProps) {
  const router = useRouter()
  const { bg, fg } = ALIGNMENT_CHIP_COLORS[tier]
  const chipStyle = {
    paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: bg,
  }
  const textStyle = {
    fontSize: 12, fontWeight: '500' as const,
    color: fg, lineHeight: 16,
  }
  if (!href) {
    return (
      <View style={chipStyle}>
        <Text style={textStyle}>{label}</Text>
      </View>
    )
  }
  return (
    <Pressable
      onPress={() => router.push(href)}
      accessibilityLabel={`View ${label} positions`}
      style={chipStyle}
    >
      <Text style={textStyle}>{label}</Text>
    </Pressable>
  )
}
```

- [ ] **Step 4: Run green + commit**

```bash
pnpm --filter @chiaro/mobile test components/cards/AlignmentChip 2>&1 | tail -5
pnpm --filter @chiaro/mobile typecheck 2>&1 | tail -3
git add apps/mobile/components/cards/AlignmentChip.tsx apps/mobile/test/components/cards/AlignmentChip.test.tsx
git commit -m "feat(mobile): AlignmentChip — Pressable with router.push deep-link"
```

---

### Task 6: DistrictBadge

**Files:**
- Create: `apps/mobile/components/cards/DistrictBadge.tsx`
- Create: `apps/mobile/test/components/cards/DistrictBadge.test.tsx`

- [ ] **Step 1: Failing test**

`apps/mobile/test/components/cards/DistrictBadge.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native'
import { DistrictBadge } from '@/components/cards/DistrictBadge'

describe('DistrictBadge', () => {
  it('house with district number renders ordinal text', () => {
    render(<DistrictBadge chamber="house" stateName="Ohio" districtNumber={15} atLarge={false} />)
    expect(screen.getByText("Ohio's 15th District")).toBeTruthy()
  })
  it('senate renders state name only', () => {
    render(<DistrictBadge chamber="senate" stateName="Ohio" districtNumber={null} atLarge={false} />)
    expect(screen.getByText('Ohio')).toBeTruthy()
  })
  it('at-large renders "<State>\'s At-Large District"', () => {
    render(<DistrictBadge chamber="house" stateName="Wyoming" districtNumber={null} atLarge={true} />)
    expect(screen.getByText("Wyoming's At-Large District")).toBeTruthy()
  })
  it('ordinals 11/12/13 use "th"', () => {
    render(<DistrictBadge chamber="house" stateName="New York" districtNumber={11} atLarge={false} />)
    expect(screen.getByText("New York's 11th District")).toBeTruthy()
  })
  it('ordinals 21st/22nd/23rd', () => {
    render(<DistrictBadge chamber="house" stateName="Texas" districtNumber={21} atLarge={false} />)
    expect(screen.getByText("Texas's 21st District")).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/mobile test components/cards/DistrictBadge 2>&1 | tail -5
```

- [ ] **Step 3: Implement**

`apps/mobile/components/cards/DistrictBadge.tsx`:

```tsx
import { View, Text } from 'react-native'
import Svg, { Path } from 'react-native-svg'

export interface DistrictBadgeProps {
  chamber: 'house' | 'senate'
  stateName: string
  districtNumber: number | null
  atLarge?: boolean
}

function ordinal(n: number): string {
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`
  const mod10 = n % 10
  if (mod10 === 1) return `${n}st`
  if (mod10 === 2) return `${n}nd`
  if (mod10 === 3) return `${n}rd`
  return `${n}th`
}

function districtLabel(p: DistrictBadgeProps): string {
  if (p.chamber === 'senate') return p.stateName
  if (p.atLarge) return `${p.stateName}'s At-Large District`
  if (p.districtNumber == null) return p.stateName
  return `${p.stateName}'s ${ordinal(p.districtNumber)} District`
}

export function DistrictBadge(props: DistrictBadgeProps) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Svg width={12} height={14} viewBox="0 0 12 14">
        <Path
          d="M6 0C2.7 0 0 2.7 0 6c0 4.5 6 8 6 8s6-3.5 6-8c0-3.3-2.7-6-6-6zm0 8.2C4.8 8.2 3.8 7.2 3.8 6S4.8 3.8 6 3.8 8.2 4.8 8.2 6 7.2 8.2 6 8.2z"
          fill="#d13b3b"
        />
      </Svg>
      <Text style={{ color: '#3a352b', fontSize: 12.5 }}>
        {districtLabel(props)}
      </Text>
    </View>
  )
}
```

- [ ] **Step 4: Run green + commit**

```bash
pnpm --filter @chiaro/mobile test components/cards/DistrictBadge 2>&1 | tail -5
pnpm --filter @chiaro/mobile typecheck 2>&1 | tail -3
git add apps/mobile/components/cards/DistrictBadge.tsx apps/mobile/test/components/cards/DistrictBadge.test.tsx
git commit -m "feat(mobile): DistrictBadge — react-native-svg map pin + descriptive label"
```

---

### Task 7: ComplianceIcon

**Files:**
- Create: `apps/mobile/components/cards/ComplianceIcon.tsx`
- Create: `apps/mobile/test/components/cards/ComplianceIcon.test.tsx`

- [ ] **Step 1: Failing test**

`apps/mobile/test/components/cards/ComplianceIcon.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native'
import { ComplianceIcon } from '@/components/cards/ComplianceIcon'

describe('ComplianceIcon', () => {
  it('on-time renders ✓', () => {
    render(<ComplianceIcon state="on-time" />)
    expect(screen.getByText('✓')).toBeTruthy()
  })
  it('late renders ✖ (U+2716)', () => {
    render(<ComplianceIcon state="late" />)
    expect(screen.getByText('✖')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/mobile test components/cards/ComplianceIcon 2>&1 | tail -5
```

- [ ] **Step 3: Implement**

`apps/mobile/components/cards/ComplianceIcon.tsx`:

```tsx
import { View, Text } from 'react-native'

export interface ComplianceIconProps {
  state: 'on-time' | 'late'
}

export function ComplianceIcon({ state }: ComplianceIconProps) {
  const onTime = state === 'on-time'
  return (
    <View
      style={{
        width: 18, height: 18, borderRadius: 9,
        backgroundColor: onTime ? '#c5e3c7' : '#f4d3c0',
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Text style={{ color: onTime ? '#1f4d24' : '#7a3e1c', fontSize: 11, fontWeight: '700' }}>
        {onTime ? '✓' : '✖'}
      </Text>
    </View>
  )
}
```

- [ ] **Step 4: Run green + commit**

```bash
pnpm --filter @chiaro/mobile test components/cards/ComplianceIcon 2>&1 | tail -5
pnpm --filter @chiaro/mobile typecheck 2>&1 | tail -3
git add apps/mobile/components/cards/ComplianceIcon.tsx apps/mobile/test/components/cards/ComplianceIcon.test.tsx
git commit -m "feat(mobile): ComplianceIcon — ✓ / ✖ filled chip"
```

---

### Task 8: MetricCardShell

**Files:**
- Create: `apps/mobile/components/cards/MetricCardShell.tsx`
- Create: `apps/mobile/test/components/cards/MetricCardShell.test.tsx`

- [ ] **Step 1: Failing test**

`apps/mobile/test/components/cards/MetricCardShell.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react-native'
import { Linking } from 'react-native'
import { MetricCardShell } from '@/components/cards/MetricCardShell'

describe('MetricCardShell', () => {
  it('renders value + label + caption', () => {
    render(
      <MetricCardShell
        value="$223,500"
        label="Base Salary"
        caption="Speaker"
        categoryId="service-record"
        externalSourceUrl="https://crsreports.congress.gov/example"
      />
    )
    expect(screen.getByText('$223,500')).toBeTruthy()
    expect(screen.getByText('Base Salary')).toBeTruthy()
    expect(screen.getByText('Speaker')).toBeTruthy()
  })

  it('press onExpand fires', () => {
    const onExpand = jest.fn()
    render(<MetricCardShell value="50%" label="Attendance" categoryId="voting-bills" onExpand={onExpand} />)
    fireEvent.press(screen.getByText('view evidence →'))
    expect(onExpand).toHaveBeenCalled()
  })

  it('press externalSourceUrl link opens via Linking', () => {
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
    render(<MetricCardShell value="$5M" label="Total Raised" categoryId="finance" externalSourceUrl="https://www.opensecrets.org" />)
    fireEvent.press(screen.getByText('view source →'))
    expect(spy).toHaveBeenCalledWith('https://www.opensecrets.org')
    spy.mockRestore()
  })

  it('unavailable forces label to "Unavailable"', () => {
    render(<MetricCardShell value="No Data" label="Lives in District" categoryId="community-presence" unavailable={true} />)
    expect(screen.getByText('Unavailable')).toBeTruthy()
    expect(screen.queryByText('Lives in District')).toBeNull()
  })

  it('unavailable suppresses CTA', () => {
    const onExpand = jest.fn()
    render(<MetricCardShell value="No Data" label="Test" categoryId="finance" unavailable={true} onExpand={onExpand} />)
    expect(screen.queryByText('view evidence →')).toBeNull()
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/mobile test components/cards/MetricCardShell 2>&1 | tail -10
```

- [ ] **Step 3: Implement**

`apps/mobile/components/cards/MetricCardShell.tsx`:

```tsx
import type { ReactNode } from 'react'
import { View, Text, Pressable, Linking } from 'react-native'
import { type CategoryId, CATEGORY_ACCENT } from '@chiaro/ui-tokens'

interface BaseProps {
  value: ReactNode
  label: string
  caption?: ReactNode
  categoryId: CategoryId
  placeholder?: boolean
  unavailable?: boolean
}

type DrillDown =
  | { onExpand: () => void; externalSourceUrl?: never }
  | { externalSourceUrl: string; onExpand?: never }
  | { onExpand?: never; externalSourceUrl?: never }

export type MetricCardShellProps = BaseProps & DrillDown

const UNAVAILABLE_GREY = '#807a72'
const UNAVAILABLE_BG = '#fafaf6'

export function MetricCardShell(props: MetricCardShellProps) {
  const { value, label, caption, categoryId, placeholder = false, unavailable = false } = props
  const dotColor = unavailable ? UNAVAILABLE_GREY : CATEGORY_ACCENT[categoryId]
  const bg = unavailable ? UNAVAILABLE_BG : placeholder ? '#f6f4ed' : '#fcfaf2'

  const renderedLabel = unavailable ? 'Unavailable' : label

  const valueStyle = {
    fontSize: 22, fontWeight: '700' as const,
    color: unavailable || placeholder ? UNAVAILABLE_GREY : '#1a1714',
    fontStyle: unavailable || placeholder ? 'italic' as const : 'normal' as const,
  }
  const labelStyle = {
    fontSize: 13, marginTop: 8,
    color: unavailable || placeholder ? '#5a5751' : '#1a1714',
  }
  const captionStyle = {
    fontSize: 11, marginTop: 2,
    color: unavailable ? UNAVAILABLE_GREY : '#807a72',
    fontStyle: unavailable || placeholder ? 'italic' as const : 'normal' as const,
  }

  let cta: ReactNode = null
  if (!placeholder && !unavailable) {
    if ('onExpand' in props && typeof props.onExpand === 'function') {
      const onExpand = props.onExpand
      cta = (
        <Pressable onPress={onExpand} accessibilityLabel={`Expand evidence for ${label}`}>
          <Text style={{ marginTop: 10, fontSize: 12, color: '#3b6ed1', textDecorationLine: 'underline' }}>
            view evidence →
          </Text>
        </Pressable>
      )
    } else if ('externalSourceUrl' in props && typeof props.externalSourceUrl === 'string') {
      const url = props.externalSourceUrl
      cta = (
        <Pressable onPress={() => Linking.openURL(url).catch(() => {})}>
          <Text style={{ marginTop: 10, fontSize: 12, color: '#3b6ed1', textDecorationLine: 'underline' }}>
            view source →
          </Text>
        </Pressable>
      )
    }
  }

  return (
    <View
      accessibilityLabel={`${renderedLabel}: ${typeof value === 'string' ? value : ''}`}
      style={{ borderWidth: 1, borderColor: '#d8d4c9', borderRadius: 6, padding: 12, backgroundColor: bg }}
    >
      <Text style={valueStyle}>{value}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dotColor, marginRight: 6 }} testID="category-dot" />
        <Text style={labelStyle}>{renderedLabel}</Text>
      </View>
      {caption ? <Text style={captionStyle}>{caption}</Text> : null}
      {cta}
    </View>
  )
}
```

- [ ] **Step 4: Run green + commit**

```bash
pnpm --filter @chiaro/mobile test components/cards/MetricCardShell 2>&1 | tail -5
pnpm --filter @chiaro/mobile typecheck 2>&1 | tail -3
git add apps/mobile/components/cards/MetricCardShell.tsx apps/mobile/test/components/cards/MetricCardShell.test.tsx
git commit -m "feat(mobile): MetricCardShell — value/label/caption + unavailable variant + Linking.openURL"
```

---

### Task 9: EvidenceExpand

**Files:**
- Create: `apps/mobile/components/cards/EvidenceExpand.tsx`
- Create: `apps/mobile/test/components/cards/EvidenceExpand.test.tsx`

- [ ] **Step 1: Failing test**

`apps/mobile/test/components/cards/EvidenceExpand.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react-native'
import { Text } from 'react-native'
import { EvidenceExpand } from '@/components/cards/EvidenceExpand'

describe('EvidenceExpand', () => {
  it('closed: shows "view evidence", hides children', () => {
    render(
      <EvidenceExpand title="Transactions" open={false} onToggle={() => {}}>
        <Text>row 1</Text>
      </EvidenceExpand>
    )
    expect(screen.getByText('view evidence')).toBeTruthy()
    expect(screen.queryByText('row 1')).toBeNull()
  })

  it('open: shows "Hide evidence" + title + children', () => {
    render(
      <EvidenceExpand title="Transactions" open={true} onToggle={() => {}}>
        <Text>row 1</Text>
      </EvidenceExpand>
    )
    expect(screen.getByText('Hide evidence')).toBeTruthy()
    expect(screen.getByText('Transactions')).toBeTruthy()
    expect(screen.getByText('row 1')).toBeTruthy()
  })

  it('press toggle calls onToggle', () => {
    const onToggle = jest.fn()
    render(
      <EvidenceExpand title="x" open={false} onToggle={onToggle}>
        <Text>x</Text>
      </EvidenceExpand>
    )
    fireEvent.press(screen.getByText('view evidence'))
    expect(onToggle).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/mobile test components/cards/EvidenceExpand 2>&1 | tail -5
```

- [ ] **Step 3: Implement**

`apps/mobile/components/cards/EvidenceExpand.tsx`:

```tsx
import type { ReactNode } from 'react'
import { View, Text, Pressable } from 'react-native'
import { PillChevron } from './PillChevron'

export interface EvidenceExpandProps {
  title: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}

export function EvidenceExpand({ title, open, onToggle, children }: EvidenceExpandProps) {
  return (
    <View>
      {open ? (
        <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: '#d8d4c9', paddingTop: 12 }}>
          <Text style={{ fontWeight: '700', fontSize: 13, color: '#1a1714', marginBottom: 8 }}>{title}</Text>
          {children}
        </View>
      ) : null}
      <View style={{ marginTop: 10 }}>
        <Pressable onPress={onToggle} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <PillChevron open={open} />
          <Text style={{ color: '#1a1714', fontSize: 13, fontWeight: '600' }}>
            {open ? 'Hide evidence' : 'view evidence'}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}
```

- [ ] **Step 4: Run green + commit**

```bash
pnpm --filter @chiaro/mobile test components/cards/EvidenceExpand 2>&1 | tail -5
pnpm --filter @chiaro/mobile typecheck 2>&1 | tail -3
git add apps/mobile/components/cards/EvidenceExpand.tsx apps/mobile/test/components/cards/EvidenceExpand.test.tsx
git commit -m "feat(mobile): EvidenceExpand — inline expand controller (Pressable)"
```

---

## Phase C — Bio (Tasks 10-14)

### Task 10: BioPortrait

**Files:**
- Create: `apps/mobile/components/bio/BioPortrait.tsx`
- Create: `apps/mobile/test/components/bio/BioPortrait.test.tsx`

- [ ] **Step 1: Failing test**

`apps/mobile/test/components/bio/BioPortrait.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native'
import { BioPortrait } from '@/components/bio/BioPortrait'

describe('BioPortrait', () => {
  it('falls back to initials when portraitUrl missing', () => {
    render(<BioPortrait fullName="Nancy Pelosi" portraitUrl={null} size={72} />)
    expect(screen.getByText('NP')).toBeTruthy()
  })
  it('initials are first letter of first + last word', () => {
    render(<BioPortrait fullName="Adam B. Schiff" portraitUrl={null} size={72} />)
    expect(screen.getByText('AS')).toBeTruthy()
  })
  it('single-word name → single letter', () => {
    render(<BioPortrait fullName="Cher" portraitUrl={null} size={72} />)
    expect(screen.getByText('C')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/mobile test components/bio/BioPortrait 2>&1 | tail -5
```

- [ ] **Step 3: Implement**

`apps/mobile/components/bio/BioPortrait.tsx`:

```tsx
import { View, Text, Image } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'

export interface BioPortraitProps {
  fullName: string
  portraitUrl: string | null
  size: number
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const first = words[0] ?? ''
  if (words.length === 1) return first.charAt(0).toUpperCase()
  const last = words[words.length - 1] ?? ''
  return (first.charAt(0) + last.charAt(0)).toUpperCase()
}

export function BioPortrait({ fullName, portraitUrl, size }: BioPortraitProps) {
  if (portraitUrl) {
    return (
      <Image
        source={{ uri: portraitUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        accessibilityLabel={`${fullName} portrait`}
      />
    )
  }
  return (
    <LinearGradient
      colors={['#3b6ed1', '#5b8de1']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size, height: size, borderRadius: size / 2,
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Text
        accessibilityLabel={`${fullName} portrait (initials)`}
        style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.42 }}
      >
        {initials(fullName)}
      </Text>
    </LinearGradient>
  )
}
```

- [ ] **Step 4: Run green + commit**

```bash
pnpm --filter @chiaro/mobile test components/bio/BioPortrait 2>&1 | tail -5
pnpm --filter @chiaro/mobile typecheck 2>&1 | tail -3
git add apps/mobile/components/bio/BioPortrait.tsx apps/mobile/test/components/bio/BioPortrait.test.tsx
git commit -m "feat(mobile): BioPortrait — Image + LinearGradient initials fallback"
```

---

### Task 11: BioServiceCard + BioContactLinks (combined small task)

**Files:**
- Create: `apps/mobile/components/bio/BioServiceCard.tsx`
- Create: `apps/mobile/components/bio/BioContactLinks.tsx`

Two small components, no dedicated unit tests (covered by BioHeader integration test in Task 14). Both committed together.

- [ ] **Step 1: Implement BioServiceCard**

`apps/mobile/components/bio/BioServiceCard.tsx`:

```tsx
import { View, Text } from 'react-native'

export interface BioServiceCardProps {
  role: string
  firstElectedYear: number | null
}

export function BioServiceCard({ role, firstElectedYear }: BioServiceCardProps) {
  return (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: '#f0eee5', borderRadius: 8,
        paddingHorizontal: 10, paddingVertical: 6,
        alignSelf: 'center',
      }}
    >
      <Text style={{ fontSize: 11, textTransform: 'uppercase', color: '#807a72', letterSpacing: 0.5 }}>
        CURRENT ROLE
      </Text>
      <View style={{ backgroundColor: '#1a1714', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>{role}</Text>
      </View>
      {firstElectedYear != null ? (
        <Text style={{ fontSize: 12, color: '#5a5751' }}>· Since {firstElectedYear}</Text>
      ) : null}
    </View>
  )
}
```

- [ ] **Step 2: Implement BioContactLinks**

`apps/mobile/components/bio/BioContactLinks.tsx`:

```tsx
import { View, Text, Pressable, Linking } from 'react-native'

export interface BioContactLinksProps {
  officialUrl: string | null
  twitterHandle: string | null
}

export function BioContactLinks({ officialUrl, twitterHandle }: BioContactLinksProps) {
  if (!officialUrl && !twitterHandle) return null

  const linkStyle = { fontSize: 12, color: '#3b6ed1' }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      {officialUrl ? (
        <Pressable onPress={() => Linking.openURL(officialUrl).catch(() => {})}>
          <Text style={linkStyle}>{officialUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}</Text>
        </Pressable>
      ) : null}
      {officialUrl && twitterHandle ? <Text style={{ color: '#d8d4c9' }}>·</Text> : null}
      {twitterHandle ? (
        <Pressable onPress={() => Linking.openURL(`https://twitter.com/${twitterHandle}`).catch(() => {})}>
          <Text style={linkStyle}>@{twitterHandle}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}
```

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm --filter @chiaro/mobile typecheck 2>&1 | tail -3
git add apps/mobile/components/bio/BioServiceCard.tsx apps/mobile/components/bio/BioContactLinks.tsx
git commit -m "feat(mobile): BioServiceCard + BioContactLinks (Linking.openURL)"
```

---

### Task 12: BioIdentityRow

**Files:**
- Create: `apps/mobile/components/bio/BioIdentityRow.tsx`

No dedicated test — covered by BioHeader integration test.

- [ ] **Step 1: Implement**

`apps/mobile/components/bio/BioIdentityRow.tsx`:

```tsx
import { View, Text } from 'react-native'
import { PARTY_COLOR, PARTY_SHORT } from '@chiaro/ui-tokens'
import { DistrictBadge } from '@/components/cards/DistrictBadge'

export interface BioIdentityRowProps {
  party: string
  chamber: 'house' | 'senate'
  stateName: string
  districtNumber: number | null
  atLarge: boolean
}

const chipBase = {
  paddingHorizontal: 10, paddingVertical: 3,
  borderRadius: 12,
}

export function BioIdentityRow({ party, chamber, stateName, districtNumber, atLarge }: BioIdentityRowProps) {
  const partyColor = PARTY_COLOR[party as keyof typeof PARTY_COLOR] ?? '#807a72'
  const partyLabel = PARTY_SHORT[party as keyof typeof PARTY_SHORT] ?? party
  return (
    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
      <View style={[chipBase, { backgroundColor: partyColor }]}>
        <Text style={{ color: '#fff', fontWeight: '600', fontSize: 12 }}>{partyLabel}</Text>
      </View>
      <View style={[chipBase, { backgroundColor: '#f0eee5' }]}>
        <Text style={{ color: '#3a352b', fontSize: 12 }}>{chamber === 'house' ? 'House' : 'Senate'}</Text>
      </View>
      <View style={[chipBase, { backgroundColor: '#f0eee5' }]}>
        <DistrictBadge chamber={chamber} stateName={stateName} districtNumber={districtNumber} atLarge={atLarge} />
      </View>
    </View>
  )
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm --filter @chiaro/mobile typecheck 2>&1 | tail -3
git add apps/mobile/components/bio/BioIdentityRow.tsx
git commit -m "feat(mobile): BioIdentityRow — party/chamber/DistrictBadge chips"
```

---

### Task 13: BioAlignmentChipRow

**Files:**
- Create: `apps/mobile/components/bio/BioAlignmentChipRow.tsx`
- Create: `apps/mobile/test/components/bio/BioAlignmentChipRow.test.tsx`

- [ ] **Step 1: Failing test**

`apps/mobile/test/components/bio/BioAlignmentChipRow.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native'
import { BioAlignmentChipRow } from '@/components/bio/BioAlignmentChipRow'
import type { AlignmentChipRow } from '@/lib/derivations/alignment'

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))

const CHIPS: AlignmentChipRow[] = [
  { issueArea: 'environment', displayLabel: 'Environment', tier: 'strongly-aligned', subCascadeSlug: 'environment' },
  { issueArea: 'civil-rights', displayLabel: 'Civil Rights', tier: 'mostly-aligned', subCascadeSlug: 'civil-rights' },
]

describe('BioAlignmentChipRow', () => {
  it('renders chips', () => {
    render(<BioAlignmentChipRow chips={CHIPS} officialId="abc" />)
    expect(screen.getByText('Environment')).toBeTruthy()
    expect(screen.getByText('Civil Rights')).toBeTruthy()
  })
  it('renders null when chips empty', () => {
    const { toJSON } = render(<BioAlignmentChipRow chips={[]} officialId="abc" />)
    expect(toJSON()).toBeNull()
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/mobile test components/bio/BioAlignmentChipRow 2>&1 | tail -5
```

- [ ] **Step 3: Implement**

`apps/mobile/components/bio/BioAlignmentChipRow.tsx`:

```tsx
import { View } from 'react-native'
import type { AlignmentChipRow } from '@/lib/derivations/alignment'
import { AlignmentChip } from '@/components/cards/AlignmentChip'

export interface BioAlignmentChipRowProps {
  chips: AlignmentChipRow[]
  officialId: string
}

export function BioAlignmentChipRow({ chips, officialId }: BioAlignmentChipRowProps) {
  if (chips.length === 0) return null
  return (
    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
      {chips.map(c => (
        <AlignmentChip
          key={c.issueArea}
          label={c.displayLabel}
          tier={c.tier}
          href={`/officials/${officialId}?cat=issue-positions&sub=${c.subCascadeSlug}`}
        />
      ))}
    </View>
  )
}
```

- [ ] **Step 4: Run green + commit**

```bash
pnpm --filter @chiaro/mobile test components/bio/BioAlignmentChipRow 2>&1 | tail -5
pnpm --filter @chiaro/mobile typecheck 2>&1 | tail -3
git add apps/mobile/components/bio/BioAlignmentChipRow.tsx apps/mobile/test/components/bio/BioAlignmentChipRow.test.tsx
git commit -m "feat(mobile): BioAlignmentChipRow — chips with Expo Router search-param hrefs"
```

---

### Task 14: BioHeader composer

**Files:**
- Create: `apps/mobile/components/bio/BioHeader.tsx`
- Create: `apps/mobile/test/components/bio/BioHeader.test.tsx`

- [ ] **Step 1: Failing test**

`apps/mobile/test/components/bio/BioHeader.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native'
import { BioHeader } from '@/components/bio/BioHeader'
import type { AlignmentChipRow } from '@/lib/derivations/alignment'

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))

const PELOSI = {
  officialId: 'abc',
  fullName: 'Nancy Pelosi',
  portraitUrl: null,
  party: 'D',
  chamber: 'house' as const,
  state: 'CA',
  stateName: 'California',
  districtNumber: 11,
  senateClass: null,
  atLarge: false,
  role: 'Speaker',
  firstElectedYear: 2007,
  officialUrl: 'https://pelosi.house.gov',
  twitterHandle: 'SpeakerPelosi',
  chips: [] as AlignmentChipRow[],
}

describe('BioHeader', () => {
  it('renders house variant with district badge', () => {
    render(<BioHeader {...PELOSI} />)
    expect(screen.getByText('Nancy Pelosi')).toBeTruthy()
    expect(screen.getByText('D')).toBeTruthy()
    expect(screen.getByText('House')).toBeTruthy()
    expect(screen.getByText("California's 11th District")).toBeTruthy()
    expect(screen.getByText('Speaker')).toBeTruthy()
    expect(screen.getByText(/Since 2007/)).toBeTruthy()
  })
  it('senate variant uses full state name', () => {
    render(<BioHeader {...PELOSI} chamber="senate" districtNumber={null} senateClass={1} role="Senator" />)
    expect(screen.getByText('California')).toBeTruthy()
    expect(screen.queryByText(/District/)).toBeNull()
  })
  it('at-large variant', () => {
    render(<BioHeader {...PELOSI} state="WY" stateName="Wyoming" districtNumber={null} atLarge={true} role="Representative" />)
    expect(screen.getByText("Wyoming's At-Large District")).toBeTruthy()
  })
  it('renders alignment chips when present', () => {
    const chips: AlignmentChipRow[] = [
      { issueArea: 'environment', displayLabel: 'Environment', tier: 'strongly-aligned', subCascadeSlug: 'environment' },
    ]
    render(<BioHeader {...PELOSI} chips={chips} />)
    expect(screen.getByText('Environment')).toBeTruthy()
  })
  it('hides contact links when both missing', () => {
    render(<BioHeader {...PELOSI} officialUrl={null} twitterHandle={null} />)
    expect(screen.queryByText('pelosi.house.gov')).toBeNull()
    expect(screen.queryByText('@SpeakerPelosi')).toBeNull()
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/mobile test components/bio/BioHeader 2>&1 | tail -10
```

- [ ] **Step 3: Implement**

`apps/mobile/components/bio/BioHeader.tsx`:

```tsx
import { View, Text } from 'react-native'
import type { AlignmentChipRow } from '@/lib/derivations/alignment'
import { BioPortrait } from './BioPortrait'
import { BioIdentityRow } from './BioIdentityRow'
import { BioServiceCard } from './BioServiceCard'
import { BioContactLinks } from './BioContactLinks'
import { BioAlignmentChipRow } from './BioAlignmentChipRow'

export interface BioHeaderProps {
  officialId: string
  fullName: string
  portraitUrl: string | null
  party: string
  chamber: 'house' | 'senate'
  state: string
  stateName: string
  districtNumber: number | null
  senateClass: 1 | 2 | 3 | null
  atLarge: boolean
  role: string
  firstElectedYear: number | null
  officialUrl: string | null
  twitterHandle: string | null
  chips: AlignmentChipRow[]
}

export function BioHeader(p: BioHeaderProps) {
  return (
    <View style={{ paddingVertical: 24, paddingHorizontal: 16, alignItems: 'center', gap: 12 }}>
      <BioPortrait fullName={p.fullName} portraitUrl={p.portraitUrl} size={72} />
      <Text style={{ fontSize: 24, fontWeight: '700', color: '#1a1714' }}>{p.fullName}</Text>
      <BioIdentityRow
        party={p.party}
        chamber={p.chamber}
        stateName={p.stateName}
        districtNumber={p.districtNumber}
        atLarge={p.atLarge}
      />
      <BioAlignmentChipRow chips={p.chips} officialId={p.officialId} />
      <BioServiceCard role={p.role} firstElectedYear={p.firstElectedYear} />
      <BioContactLinks officialUrl={p.officialUrl} twitterHandle={p.twitterHandle} />
    </View>
  )
}
```

- [ ] **Step 4: Run green + commit**

```bash
pnpm --filter @chiaro/mobile test components/bio/BioHeader 2>&1 | tail -5
pnpm --filter @chiaro/mobile typecheck 2>&1 | tail -3
git add apps/mobile/components/bio/BioHeader.tsx apps/mobile/test/components/bio/BioHeader.test.tsx
git commit -m "feat(mobile): BioHeader composer — Portrait → Name → IdentityRow → Chips → ServiceCard → Contacts"
```

---

## Phase D — Finance components (Tasks 15-17)

### Task 15: FinanceSummaryStrip

**Files:**
- Create: `apps/mobile/components/finance/FinanceSummaryStrip.tsx`

No dedicated test — covered by FinanceCategory smoke + manual DoD.

- [ ] **Step 1: Implement**

`apps/mobile/components/finance/FinanceSummaryStrip.tsx`:

```tsx
import { View, Text } from 'react-native'

export interface FinanceSummaryStripProps {
  cycle: string
  totalRaised: number | null
  smallDonorPct: number | null
  pacPct: number | null
}

function formatMoney(n: number | null): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${n}`
}

function formatPct(n: number | null): string {
  if (n == null) return '—'
  return `${Math.round(n)}%`
}

const DOT = '#3da75b'

function Cell({ label, value, headline }: { label: string; value: string; headline?: boolean }) {
  return (
    <View style={{ flex: headline ? 1.3 : 1, paddingHorizontal: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: DOT, marginRight: 5 }} />
        <Text style={{ fontSize: 11, color: '#5a5751', textTransform: 'uppercase', letterSpacing: 0.7, fontWeight: '600' }}>
          {label}
        </Text>
      </View>
      <Text
        style={{
          fontSize: headline ? 22 : 18,
          fontWeight: headline ? '800' : '700',
          color: '#1a1714', marginTop: 6,
        }}
      >
        {value}
      </Text>
    </View>
  )
}

export function FinanceSummaryStrip({ cycle, totalRaised, smallDonorPct, pacPct }: FinanceSummaryStripProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: '#f4faf6',
        borderWidth: 1, borderColor: '#d8d4c9', borderRadius: 6,
        padding: 12, marginBottom: 10,
      }}
    >
      <Cell label={`Total Raised, ${cycle}`} value={formatMoney(totalRaised)} headline />
      <View style={{ width: 1, backgroundColor: '#d8d4c9' }} />
      <Cell label="Small-donor %" value={formatPct(smallDonorPct)} />
      <View style={{ width: 1, backgroundColor: '#d8d4c9' }} />
      <Cell label="PAC %" value={pacPct == null ? '—' : `${pacPct.toFixed(1)}%`} />
    </View>
  )
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm --filter @chiaro/mobile typecheck 2>&1 | tail -3
git add apps/mobile/components/finance/FinanceSummaryStrip.tsx
git commit -m "feat(mobile): FinanceSummaryStrip — 3-cell row with headline emphasis"
```

---

### Task 16: FinanceSubSectionHeading

**Files:**
- Create: `apps/mobile/components/finance/FinanceSubSectionHeading.tsx`

- [ ] **Step 1: Implement**

```tsx
import { View, Text } from 'react-native'

export interface FinanceSubSectionHeadingProps {
  label: string
  textColor: string
  ruleColor: string
}

export function FinanceSubSectionHeading({ label, textColor, ruleColor }: FinanceSubSectionHeadingProps) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, marginBottom: 6 }}>
      <Text style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: '700', color: textColor }}>
        {label}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: ruleColor }} />
    </View>
  )
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm --filter @chiaro/mobile typecheck 2>&1 | tail -3
git add apps/mobile/components/finance/FinanceSubSectionHeading.tsx
git commit -m "feat(mobile): FinanceSubSectionHeading — uppercase eyebrow + rule"
```

---

### Task 17: TopAmountBreakdown

**Files:**
- Create: `apps/mobile/components/finance/TopAmountBreakdown.tsx`
- Create: `apps/mobile/test/components/finance/TopAmountBreakdown.test.tsx`

- [ ] **Step 1: Failing test**

`apps/mobile/test/components/finance/TopAmountBreakdown.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react-native'
import { TopAmountBreakdown } from '@/components/finance/TopAmountBreakdown'

const TEN = Array.from({ length: 10 }, (_, i) => ({
  label: `Item ${i + 1}`,
  amount: (10 - i) * 50_000,
}))
const NOUN = { singular: 'industry', plural: 'industries' }

describe('TopAmountBreakdown', () => {
  it('renders 5 rows by default', () => {
    render(<TopAmountBreakdown rows={TEN} noun={NOUN} />)
    expect(screen.getByText('Item 1')).toBeTruthy()
    expect(screen.getByText('Item 5')).toBeTruthy()
    expect(screen.queryByText('Item 6')).toBeNull()
  })
  it('toggle reveals rows 6-10', () => {
    render(<TopAmountBreakdown rows={TEN} noun={NOUN} />)
    fireEvent.press(screen.getByText('Show 5 more industries'))
    expect(screen.getByText('Item 10')).toBeTruthy()
    expect(screen.getByText('Show less')).toBeTruthy()
  })
  it('toggle copy reflects different noun', () => {
    render(<TopAmountBreakdown rows={TEN} noun={{ singular: 'donor', plural: 'donors' }} />)
    expect(screen.getByText('Show 5 more donors')).toBeTruthy()
  })
  it('toggle hidden when ≤5 rows', () => {
    render(<TopAmountBreakdown rows={TEN.slice(0, 3)} noun={NOUN} />)
    expect(screen.queryByText(/Show 5 more/)).toBeNull()
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/mobile test components/finance/TopAmountBreakdown 2>&1 | tail -5
```

- [ ] **Step 3: Implement**

`apps/mobile/components/finance/TopAmountBreakdown.tsx`:

```tsx
import { useState } from 'react'
import { View, Text, Pressable, Linking } from 'react-native'
import { PillChevron } from '@/components/cards/PillChevron'

export interface TopAmountRow {
  label: string
  amount: number
}

export interface TopAmountNoun {
  singular: string
  plural: string
}

export interface TopAmountBreakdownProps {
  rows: ReadonlyArray<TopAmountRow>
  noun: TopAmountNoun
  sourceUrl?: string
}

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${n}`
}

export function TopAmountBreakdown({ rows, noun, sourceUrl }: TopAmountBreakdownProps) {
  const [expanded, setExpanded] = useState(false)
  const total = rows.reduce((s, r) => s + r.amount, 0)
  const max = Math.max(...rows.map(r => r.amount), 1)
  const visible = expanded ? rows : rows.slice(0, 5)
  const showToggle = rows.length > 5

  return (
    <View
      style={{
        backgroundColor: '#f4faf6', borderWidth: 1, borderColor: '#d8d4c9', borderRadius: 6,
        padding: 14,
      }}
    >
      <View style={{ gap: 10 }}>
        {visible.map((r, idx) => {
          const pct = total > 0 ? Math.round((r.amount / total) * 100) : 0
          const isTop = idx === 0
          return (
            <View key={r.label}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Text style={{ fontWeight: isTop ? '700' : '600', fontSize: isTop ? 14 : 13, color: '#1a1714' }}>
                  {r.label}
                </Text>
                <View style={{ flexDirection: 'row' }}>
                  <Text style={{ fontWeight: '700', color: '#1a1714' }}>{formatMoney(r.amount)}</Text>
                  <Text style={{ color: '#5a5751', fontSize: 11 }}> · {pct}%</Text>
                </View>
              </View>
              <View style={{ marginTop: 4, height: 6, backgroundColor: '#e8e6dd', borderRadius: 3 }}>
                <View style={{ backgroundColor: '#3da75b', width: `${(r.amount / max) * 100}%`, height: '100%', borderRadius: 3 }} />
              </View>
            </View>
          )
        })}
      </View>
      {showToggle ? (
        <Pressable
          onPress={() => setExpanded(v => !v)}
          style={{
            marginTop: 12,
            backgroundColor: '#fff', borderWidth: 1, borderColor: '#d8d4c9', borderRadius: 6,
            paddingHorizontal: 12, paddingVertical: 8,
            flexDirection: 'row', alignItems: 'center', gap: 10,
          }}
        >
          <PillChevron open={expanded} />
          <Text style={{ flex: 1, fontWeight: '600', color: '#1a1714', fontSize: 13 }}>
            {expanded ? 'Show less' : `Show 5 more ${noun.plural}`}
          </Text>
          <Text style={{ color: '#5a5751', fontSize: 11 }}>
            {expanded ? `${rows.length} of ${rows.length} shown` : `5 of ${rows.length} shown`}
          </Text>
        </Pressable>
      ) : null}
      {sourceUrl ? (
        <Pressable onPress={() => Linking.openURL(sourceUrl).catch(() => {})}>
          <Text style={{ marginTop: 12, fontSize: 12, color: '#3b6ed1', textDecorationLine: 'underline' }}>
            → full breakdown on OpenSecrets
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}
```

- [ ] **Step 4: Run green + commit**

```bash
pnpm --filter @chiaro/mobile test components/finance/TopAmountBreakdown 2>&1 | tail -5
pnpm --filter @chiaro/mobile typecheck 2>&1 | tail -3
git add apps/mobile/components/finance/TopAmountBreakdown.tsx apps/mobile/test/components/finance/TopAmountBreakdown.test.tsx
git commit -m "feat(mobile): TopAmountBreakdown — bars + 5/10 toggle + Linking source link"
```

---

## Phase E — Performance infra (Tasks 18-21)

### Task 18: useExpandedState

**Files:**
- Create: `apps/mobile/components/performance/useExpandedState.ts`
- Create: `apps/mobile/test/components/performance/useExpandedState.test.ts`

Copy-paste from web's `apps/web/components/performance/useExpandedState.ts` — pure React, cross-platform.

- [ ] **Step 1: Copy web file**

```bash
mkdir -p apps/mobile/components/performance
cp apps/web/components/performance/useExpandedState.ts apps/mobile/components/performance/
```

- [ ] **Step 2: Copy + adapt web test**

```bash
mkdir -p apps/mobile/test/components/performance
cp apps/web/test/components/performance/useExpandedState.test.ts apps/mobile/test/components/performance/
```

Then edit `apps/mobile/test/components/performance/useExpandedState.test.ts` — swap `@testing-library/react` for `@testing-library/react-native`:

```diff
- import { renderHook, act } from '@testing-library/react'
+ import { renderHook, act } from '@testing-library/react-native'
```

(All other test code works unchanged — `renderHook` is identical API.)

- [ ] **Step 3: Run + commit**

```bash
pnpm --filter @chiaro/mobile test components/performance/useExpandedState 2>&1 | tail -5
pnpm --filter @chiaro/mobile typecheck 2>&1 | tail -3
git add apps/mobile/components/performance/useExpandedState.ts apps/mobile/test/components/performance/useExpandedState.test.ts
git commit -m "feat(mobile): useExpandedState — copy-paste from web (pure React)"
```

---

### Task 19: useExpoParamSync

**Files:**
- Create: `apps/mobile/components/performance/useExpoParamSync.ts`
- Create: `apps/mobile/test/components/performance/useExpoParamSync.test.ts`

Replaces `useUrlHashSync`. Reads `useLocalSearchParams<{ cat?: string; sub?: string }>` from `expo-router`. Re-fires when params change (Expo Router auto-updates on navigation).

- [ ] **Step 1: Failing test**

`apps/mobile/test/components/performance/useExpoParamSync.test.ts`:

```ts
import { renderHook } from '@testing-library/react-native'
import { useExpoParamSync } from '@/components/performance/useExpoParamSync'

const paramsMock = jest.fn()
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => paramsMock(),
}))

describe('useExpoParamSync', () => {
  beforeEach(() => paramsMock.mockReset())

  function makeApi() {
    return {
      isCategoryOpen: jest.fn(() => false),
      toggleCategory: jest.fn(),
      openCategory: jest.fn(),
      isSubCascadeOpen: jest.fn(() => false),
      toggleSubCascade: jest.fn(),
      openSubCascade: jest.fn(),
    }
  }

  it('opens category from cat param', () => {
    paramsMock.mockReturnValue({ cat: 'finance' })
    const api = makeApi()
    renderHook(() => useExpoParamSync(api))
    expect(api.openCategory).toHaveBeenCalledWith('finance')
    expect(api.openSubCascade).not.toHaveBeenCalled()
  })

  it('opens category + sub when both params present', () => {
    paramsMock.mockReturnValue({ cat: 'finance', sub: 'top-industries' })
    const api = makeApi()
    renderHook(() => useExpoParamSync(api))
    expect(api.openCategory).toHaveBeenCalledWith('finance')
    expect(api.openSubCascade).toHaveBeenCalledWith('finance', 'top-industries')
  })

  it('ignores unknown category', () => {
    paramsMock.mockReturnValue({ cat: 'bogus' })
    const api = makeApi()
    renderHook(() => useExpoParamSync(api))
    expect(api.openCategory).not.toHaveBeenCalled()
  })

  it('no-ops when params empty', () => {
    paramsMock.mockReturnValue({})
    const api = makeApi()
    renderHook(() => useExpoParamSync(api))
    expect(api.openCategory).not.toHaveBeenCalled()
  })

  it('coerces array-shaped params to first string', () => {
    paramsMock.mockReturnValue({ cat: ['finance', 'whatever'], sub: ['top-industries'] })
    const api = makeApi()
    renderHook(() => useExpoParamSync(api))
    expect(api.openCategory).toHaveBeenCalledWith('finance')
    expect(api.openSubCascade).toHaveBeenCalledWith('finance', 'top-industries')
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/mobile test components/performance/useExpoParamSync 2>&1 | tail -10
```

- [ ] **Step 3: Implement**

`apps/mobile/components/performance/useExpoParamSync.ts`:

```ts
import { useEffect } from 'react'
import { useLocalSearchParams } from 'expo-router'
import { type CategoryId, CATEGORY_LABEL } from '@chiaro/ui-tokens'
import type { ExpandedStateApi } from './useExpandedState'

const VALID_CATEGORIES = new Set<string>(Object.keys(CATEGORY_LABEL))

function pickFirst(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0]
  return v
}

export function useExpoParamSync(api: ExpandedStateApi): void {
  const params = useLocalSearchParams<{ cat?: string | string[]; sub?: string | string[] }>()
  const cat = pickFirst(params.cat)
  const sub = pickFirst(params.sub)

  useEffect(() => {
    if (!cat || !VALID_CATEGORIES.has(cat)) return
    api.openCategory(cat as CategoryId)
    if (sub) api.openSubCascade(cat as CategoryId, sub)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat, sub])
}
```

- [ ] **Step 4: Run green + commit**

```bash
pnpm --filter @chiaro/mobile test components/performance/useExpoParamSync 2>&1 | tail -5
pnpm --filter @chiaro/mobile typecheck 2>&1 | tail -3
git add apps/mobile/components/performance/useExpoParamSync.ts apps/mobile/test/components/performance/useExpoParamSync.test.ts
git commit -m "feat(mobile): useExpoParamSync — reads useLocalSearchParams, opens matching cat/sub"
```

---

### Task 20: CategoryBar

**Files:**
- Create: `apps/mobile/components/performance/CategoryBar.tsx`
- Create: `apps/mobile/test/components/performance/CategoryBar.test.tsx`

- [ ] **Step 1: Failing test**

`apps/mobile/test/components/performance/CategoryBar.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react-native'
import { CategoryBar } from '@/components/performance/CategoryBar'

describe('CategoryBar', () => {
  it('renders label + teaser when closed', () => {
    render(<CategoryBar categoryId="finance" teaser="$5M raised" open={false} onToggle={() => {}} />)
    expect(screen.getByText('Finance')).toBeTruthy()
    expect(screen.getByText('$5M raised')).toBeTruthy()
    expect(screen.getByText('▸')).toBeTruthy()
  })
  it('renders ▾ when open', () => {
    render(<CategoryBar categoryId="finance" teaser={null} open={true} onToggle={() => {}} />)
    expect(screen.getByText('▾')).toBeTruthy()
  })
  it('press fires onToggle', () => {
    const onToggle = jest.fn()
    render(<CategoryBar categoryId="finance" teaser="x" open={false} onToggle={onToggle} />)
    fireEvent.press(screen.getByText('Finance'))
    expect(onToggle).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/mobile test components/performance/CategoryBar 2>&1 | tail -5
```

- [ ] **Step 3: Implement**

`apps/mobile/components/performance/CategoryBar.tsx`:

```tsx
import { View, Text, Pressable } from 'react-native'
import { type CategoryId, CATEGORY_ACCENT, CATEGORY_LABEL } from '@chiaro/ui-tokens'
import { PillChevron } from '@/components/cards/PillChevron'

export interface CategoryBarProps {
  categoryId: CategoryId
  teaser: string | null
  open: boolean
  onToggle: () => void
}

export function CategoryBar({ categoryId, teaser, open, onToggle }: CategoryBarProps) {
  const accent = CATEGORY_ACCENT[categoryId]
  const label = CATEGORY_LABEL[categoryId]
  return (
    <Pressable
      onPress={onToggle}
      accessibilityState={{ expanded: open }}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingHorizontal: 14, paddingVertical: 11,
        borderWidth: 1, borderColor: '#d8d4c9',
        borderLeftWidth: 2, borderLeftColor: accent,
        borderRadius: 6,
        borderBottomLeftRadius: open ? 0 : 6,
        borderBottomRightRadius: open ? 0 : 6,
        borderBottomWidth: open ? 0 : 1,
        backgroundColor: '#fff',
        marginBottom: open ? 0 : 6,
      }}
    >
      <PillChevron open={open} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '700', fontSize: 15, color: '#1a1714' }}>{label}</Text>
        {teaser ? (
          <Text style={{ fontSize: 12, color: '#5a5751', marginTop: 2 }}>{teaser}</Text>
        ) : (
          <Text style={{ fontSize: 12, color: '#807a72', fontStyle: 'italic', marginTop: 2 }}>no data yet</Text>
        )}
      </View>
    </Pressable>
  )
}
```

- [ ] **Step 4: Run green + commit**

```bash
pnpm --filter @chiaro/mobile test components/performance/CategoryBar 2>&1 | tail -5
pnpm --filter @chiaro/mobile typecheck 2>&1 | tail -3
git add apps/mobile/components/performance/CategoryBar.tsx apps/mobile/test/components/performance/CategoryBar.test.tsx
git commit -m "feat(mobile): CategoryBar — Pressable with palette-A left accent + pill chevron"
```

---

### Task 21: SubCascadeBar

**Files:**
- Create: `apps/mobile/components/performance/SubCascadeBar.tsx`
- Create: `apps/mobile/test/components/performance/SubCascadeBar.test.tsx`

- [ ] **Step 1: Failing test**

`apps/mobile/test/components/performance/SubCascadeBar.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react-native'
import { SubCascadeBar } from '@/components/performance/SubCascadeBar'

describe('SubCascadeBar', () => {
  it('renders name + teaser', () => {
    render(<SubCascadeBar categoryId="issue-positions" subId="environment" name="Environment" teaser="LCV Strongly Aligned" open={false} onToggle={() => {}} />)
    expect(screen.getByText('Environment')).toBeTruthy()
    expect(screen.getByText('LCV Strongly Aligned')).toBeTruthy()
  })
  it('plain chevron ▸ when closed', () => {
    render(<SubCascadeBar categoryId="finance" subId="pacs" name="PACs" teaser="x" open={false} onToggle={() => {}} />)
    expect(screen.getByText('▸')).toBeTruthy()
  })
  it('placeholder is non-pressable', () => {
    const onToggle = jest.fn()
    render(<SubCascadeBar categoryId="finance" subId="x" name="Top Orgs" teaser="data coming" open={false} onToggle={onToggle} placeholder={true} />)
    fireEvent.press(screen.getByText('Top Orgs'))
    expect(onToggle).not.toHaveBeenCalled()
  })
  it('press fires onToggle when not placeholder', () => {
    const onToggle = jest.fn()
    render(<SubCascadeBar categoryId="finance" subId="pacs" name="PACs" teaser="x" open={false} onToggle={onToggle} />)
    fireEvent.press(screen.getByText('PACs'))
    expect(onToggle).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/mobile test components/performance/SubCascadeBar 2>&1 | tail -5
```

- [ ] **Step 3: Implement**

`apps/mobile/components/performance/SubCascadeBar.tsx`:

```tsx
import { View, Text, Pressable } from 'react-native'
import { type CategoryId, SUB_CASCADE_ACCENT } from '@chiaro/ui-tokens'

export interface SubCascadeBarProps {
  categoryId: CategoryId
  subId: string
  name: string
  teaser: string | null
  open: boolean
  onToggle: () => void
  accentOverride?: string
  placeholder?: boolean
}

export function SubCascadeBar(props: SubCascadeBarProps) {
  const { categoryId, name, teaser, open, onToggle, accentOverride, placeholder = false } = props
  const accent = accentOverride ?? SUB_CASCADE_ACCENT[categoryId]

  const content = (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingHorizontal: 12, paddingVertical: 8,
        borderWidth: 1, borderColor: '#e5e1d4',
        borderLeftWidth: 1, borderLeftColor: accent,
        borderRadius: 5,
        backgroundColor: placeholder ? '#f6f4ed' : '#fff',
        marginBottom: 4,
      }}
    >
      <Text style={{ fontSize: 12, color: placeholder ? '#807a72' : '#1a1714' }}>{open ? '▾' : '▸'}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '600', fontSize: 13, color: placeholder ? '#5a5751' : '#1a1714' }}>{name}</Text>
        <Text
          style={{
            fontSize: 11, marginTop: 1, lineHeight: 16,
            color: placeholder ? '#807a72' : '#5a5751',
            fontStyle: placeholder ? 'italic' : 'normal',
          }}
        >
          {teaser ?? ''}
        </Text>
      </View>
    </View>
  )

  if (placeholder) return <View>{content}</View>
  return <Pressable onPress={onToggle} accessibilityState={{ expanded: open }}>{content}</Pressable>
}
```

- [ ] **Step 4: Run green + commit**

```bash
pnpm --filter @chiaro/mobile test components/performance/SubCascadeBar 2>&1 | tail -5
pnpm --filter @chiaro/mobile typecheck 2>&1 | tail -3
git add apps/mobile/components/performance/SubCascadeBar.tsx apps/mobile/test/components/performance/SubCascadeBar.test.tsx
git commit -m "feat(mobile): SubCascadeBar — mini bar + placeholder variant"
```

---

## Phase F — Categories (Tasks 22-27)

For brevity in the plan body: each category mirrors its web counterpart in render shape; same hooks, same prop interface. Below are condensed task entries showing the structural pattern. The implementer dispatches each as a fresh subagent with the corresponding web file at `apps/web/components/performance/categories/<X>.tsx` as the reference template, adapting HTML→RN.

### Task 22: ServiceRecordCategory

**Files:**
- Create: `apps/mobile/components/performance/categories/ServiceRecordCategory.tsx`

No dedicated unit test — covered by PerformanceSection smoke + manual DoD.

- [ ] **Step 1: Implement**

Mirror `apps/web/components/performance/categories/ServiceRecordCategory.tsx` (~80 lines). Replace `<div>` → `<View>`, `<span>`/`<p>` → `<Text>`, `style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)'}}` → `style={{flexDirection:'row', flexWrap:'wrap', gap:10}}` with each `<article>` width `flex: 1, minWidth: '30%'`. Uses `useOfficialMetrics` + `useOfficialLeadershipHistory` from `@chiaro/officials` (cross-platform), `firstElectedYear` + `tenureByChamber` from `@/lib/derivations/service-record`, `MetricCardShell` from `@/components/cards/MetricCardShell`, `EvidenceExpand` from `@/components/cards/EvidenceExpand`.

Cards render: Base Salary (MetricCardShell with externalSourceUrl), Tenure (custom View block with EvidenceExpand for chamber breakdown), Leadership Role (custom View block with EvidenceExpand for history list).

External links (e.g. leadership history source URL): wrap in `<Pressable onPress={() => Linking.openURL(url)}>` with `<Text>` link styling.

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm --filter @chiaro/mobile typecheck 2>&1 | tail -3
git add apps/mobile/components/performance/categories/ServiceRecordCategory.tsx
git commit -m "feat(mobile): ServiceRecordCategory — salary + tenure + leadership flat grid"
```

---

### Task 23: CommunityPresenceCategory

**Files:**
- Create: `apps/mobile/components/performance/categories/CommunityPresenceCategory.tsx`

Mirror `apps/web/components/performance/categories/CommunityPresenceCategory.tsx`. Same props (`{ officialId, chamber }`). Same gate for Lives-in-District unavailable: `chamber === 'senate' || metrics.data?.lives_in_district == null`. Uses `useOfficialMetrics`, `useOfficialDistrictOffices`, `useOfficialTownHalls`. Three cards (Lives in District + District Offices + Town Halls). Maps Google deep-link: `Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(addr)}`)`.

- [ ] **Step 1: Implement** — RN adaptation of web's CommunityPresenceCategory.

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm --filter @chiaro/mobile typecheck 2>&1 | tail -3
git add apps/mobile/components/performance/categories/CommunityPresenceCategory.tsx
git commit -m "feat(mobile): CommunityPresenceCategory — Lives in District + offices + town halls"
```

---

### Task 24: EthicsAccountabilityCategory

**Files:**
- Create: `apps/mobile/components/performance/categories/EthicsAccountabilityCategory.tsx`

Mirror `apps/web/components/performance/categories/EthicsAccountabilityCategory.tsx`. Uses `useOfficialMetrics` + `useOfficialStockTransactions`. Two cards (STOCK Act Compliance + In-State Donors). `ComplianceIcon` per stock transaction inside EvidenceExpand.

- [ ] **Step 1: Implement** — RN adaptation.

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm --filter @chiaro/mobile typecheck 2>&1 | tail -3
git add apps/mobile/components/performance/categories/EthicsAccountabilityCategory.tsx
git commit -m "feat(mobile): EthicsAccountabilityCategory — STOCK Act + in-state donors"
```

---

### Task 25: IssuePositionsCategory

**Files:**
- Create: `apps/mobile/components/performance/categories/IssuePositionsCategory.tsx`

Mirror `apps/web/components/performance/categories/IssuePositionsCategory.tsx`. Two-level cascade — group scorecards by issue area, render `SubCascadeBar` for each + inline `ScorecardCardInline` cards using `EvidenceExpand` for per-bill votes. Uses `useOfficialScorecardRatings` + `useOfficialVotesOnSubject` (from `@chiaro/bills`). Same `subCascade: { isOpen, onToggle }` prop interface as web.

- [ ] **Step 1: Implement** — RN adaptation.

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm --filter @chiaro/mobile typecheck 2>&1 | tail -3
git add apps/mobile/components/performance/categories/IssuePositionsCategory.tsx
git commit -m "feat(mobile): IssuePositionsCategory — sub-cascade by issue area + inline scorecard evidence"
```

---

### Task 26: FinanceCategory

**Files:**
- Create: `apps/mobile/components/performance/categories/FinanceCategory.tsx`

Mirror `apps/web/components/performance/categories/FinanceCategory.tsx` (post-PR #4, with Individual Donors + Top Organizations cascades wired). Uses `useOfficialFinance` (returns `{ summary, industries, pacs, individualDonors, topOrgs }`). Renders `FinanceSummaryStrip` + 2 sub-sections × 2 cascades each (PACs list rows + Individual Donors `TopAmountBreakdown`; Top Industries + Top Organizations `TopAmountBreakdown`).

- [ ] **Step 1: Implement** — RN adaptation.

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm --filter @chiaro/mobile typecheck 2>&1 | tail -3
git add apps/mobile/components/performance/categories/FinanceCategory.tsx
git commit -m "feat(mobile): FinanceCategory — summary + 2 sub-sections + 4 sub-cascades"
```

---

### Task 27: VotingBillsCategory

**Files:**
- Create: `apps/mobile/components/performance/categories/VotingBillsCategory.tsx`

Mirror `apps/web/components/performance/categories/VotingBillsCategory.tsx`. Three sub-cascades (Voting Record, Bills Authored, Committee Work placeholder). Uses `useOfficialMetrics` + `useOfficialMissedVotes` + `useOfficialSponsoredBills` + `useOfficialCosponsoredBills` (from `@chiaro/bills`). Committee Work is `placeholder={true}` on SubCascadeBar (real ingest deferred).

- [ ] **Step 1: Implement** — RN adaptation.

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm --filter @chiaro/mobile typecheck 2>&1 | tail -3
git add apps/mobile/components/performance/categories/VotingBillsCategory.tsx
git commit -m "feat(mobile): VotingBillsCategory — 3 sub-cascades (voting / bills / committees)"
```

---

## Phase G — Integration + cleanup (Tasks 28-32)

### Task 28: PerformanceSection orchestrator

**Files:**
- Create: `apps/mobile/components/performance/PerformanceSection.tsx`

- [ ] **Step 1: Implement**

`apps/mobile/components/performance/PerformanceSection.tsx`:

```tsx
import { View } from 'react-native'
import { type CategoryId, CATEGORY_ACCENT } from '@chiaro/ui-tokens'
import { useOfficialMetrics, useOfficialScorecardRatings, useOfficialFinance, useOfficialStockTransactions, useOfficialLeadershipHistory } from '@chiaro/officials'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useExpandedState } from './useExpandedState'
import { useExpoParamSync } from './useExpoParamSync'
import { CategoryBar } from './CategoryBar'
import { ServiceRecordCategory } from './categories/ServiceRecordCategory'
import { IssuePositionsCategory } from './categories/IssuePositionsCategory'
import { CommunityPresenceCategory } from './categories/CommunityPresenceCategory'
import { FinanceCategory } from './categories/FinanceCategory'
import { EthicsAccountabilityCategory } from './categories/EthicsAccountabilityCategory'
import { VotingBillsCategory } from './categories/VotingBillsCategory'
import {
  serviceRecordTeaser, issuePositionsTeaser, communityPresenceTeaser,
  financeTeaser, ethicsAccountabilityTeaser, votingBillsTeaser,
} from '@/lib/derivations/teasers'
import { firstElectedYear } from '@/lib/derivations/service-record'
import { selectTopAlignmentChips } from '@/lib/derivations/alignment'

const ORDER: CategoryId[] = [
  'service-record', 'issue-positions', 'community-presence',
  'finance', 'ethics-accountability', 'voting-bills',
]

const client = createSupabaseBrowserClient()
const CYCLE = '2024'

export function PerformanceSection({ officialId, chamber }: { officialId: string; chamber: 'house' | 'senate' }) {
  const expanded = useExpandedState()
  useExpoParamSync(expanded)

  const metrics = useOfficialMetrics(client, officialId)
  const scorecards = useOfficialScorecardRatings(client, officialId)
  const finance = useOfficialFinance(client, officialId, CYCLE)
  const stock = useOfficialStockTransactions(client, officialId)
  const leadership = useOfficialLeadershipHistory(client, officialId)

  const m = metrics.data
  const ratings = scorecards.data ?? []
  const topChips = selectTopAlignmentChips(ratings)
  const topAligned = topChips.find(c => c.tier === 'strongly-aligned' || c.tier === 'mostly-aligned')?.issueArea ?? null
  const topDiffer = topChips.find(c => c.tier === 'strongly-differs' || c.tier === 'mostly-differs')?.issueArea ?? null
  const lateTrades = (stock.data ?? []).filter(t => (t.days_late ?? 0) > 0).length
  const recentHalls = m?.town_halls_count ?? 0

  const teasers: Record<CategoryId, string | null> = {
    'service-record': serviceRecordTeaser({
      role: m?.salary_role ?? null,
      firstElectedYear: firstElectedYear(leadership.data ?? []),
    }),
    'issue-positions': issuePositionsTeaser({ topAlignedIssue: topAligned, topDifferIssue: topDiffer }),
    'community-presence': communityPresenceTeaser({
      livesInDistrict: m?.lives_in_district ?? null,
      officeCount: m?.district_offices_count ?? 0,
      recentTownHallCount: recentHalls,
    }),
    'finance': financeTeaser({
      totalRaised: finance.data?.summary.total_raised ?? null,
      topIndustry: finance.data?.industries[0]?.industry ?? null,
    }),
    'ethics-accountability': ethicsAccountabilityTeaser({
      lateTrades,
      inStatePct: m?.in_state_donations_pct ?? null,
    }),
    'voting-bills': votingBillsTeaser({
      attendancePct: m?.attendance_pct ?? null,
      billsThisCongress: (m?.bills_sponsored_count ?? 0) + (m?.bills_cosponsored_count ?? 0),
    }),
  }

  const subCascade = { isOpen: expanded.isSubCascadeOpen, onToggle: expanded.toggleSubCascade }

  function bodyFor(id: CategoryId) {
    switch (id) {
      case 'service-record':        return <ServiceRecordCategory officialId={officialId} />
      case 'issue-positions':       return <IssuePositionsCategory officialId={officialId} subCascade={subCascade} />
      case 'community-presence':    return <CommunityPresenceCategory officialId={officialId} chamber={chamber} />
      case 'finance':               return <FinanceCategory officialId={officialId} subCascade={subCascade} />
      case 'ethics-accountability': return <EthicsAccountabilityCategory officialId={officialId} />
      case 'voting-bills':          return <VotingBillsCategory officialId={officialId} subCascade={subCascade} />
    }
  }

  return (
    <View style={{ marginTop: 24, paddingHorizontal: 16 }}>
      {ORDER.map(id => {
        const open = expanded.isCategoryOpen(id)
        return (
          <View key={id}>
            <CategoryBar
              categoryId={id}
              teaser={teasers[id]}
              open={open}
              onToggle={() => expanded.toggleCategory(id)}
            />
            {open ? (
              <View
                style={{
                  borderWidth: 1, borderColor: '#d8d4c9', borderTopWidth: 0,
                  borderLeftWidth: 2, borderLeftColor: CATEGORY_ACCENT[id],
                  borderBottomLeftRadius: 6, borderBottomRightRadius: 6,
                  backgroundColor: '#fafaf6', marginBottom: 6,
                }}
              >
                {bodyFor(id)}
              </View>
            ) : null}
          </View>
        )
      })}
    </View>
  )
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm --filter @chiaro/mobile typecheck 2>&1 | tail -3
git add apps/mobile/components/performance/PerformanceSection.tsx
git commit -m "feat(mobile): PerformanceSection — orchestrates 6 categories + Expo param deep-link"
```

---

### Task 29: Rewrite officials detail page

**Files:**
- Modify: `apps/mobile/app/(app)/officials/[id].tsx`

- [ ] **Step 1: Replace contents**

`apps/mobile/app/(app)/officials/[id].tsx`:

```tsx
import { SafeAreaView } from 'react-native-safe-area-context'
import { ScrollView, Text } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useOfficial, useOfficialScorecardRatings, useOfficialLeadershipHistory } from '@chiaro/officials'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { selectTopAlignmentChips } from '@/lib/derivations/alignment'
import { firstElectedYear as deriveFirstElectedYear } from '@/lib/derivations/service-record'
import { BioHeader } from '@/components/bio/BioHeader'
import { PerformanceSection } from '@/components/performance/PerformanceSection'

const client = createSupabaseBrowserClient()

const STATE_NAMES: Record<string, string> = {
  AL:'Alabama', AK:'Alaska', AZ:'Arizona', AR:'Arkansas', CA:'California', CO:'Colorado', CT:'Connecticut',
  DE:'Delaware', FL:'Florida', GA:'Georgia', HI:'Hawaii', ID:'Idaho', IL:'Illinois', IN:'Indiana', IA:'Iowa',
  KS:'Kansas', KY:'Kentucky', LA:'Louisiana', ME:'Maine', MD:'Maryland', MA:'Massachusetts', MI:'Michigan',
  MN:'Minnesota', MS:'Mississippi', MO:'Missouri', MT:'Montana', NE:'Nebraska', NV:'Nevada', NH:'New Hampshire',
  NJ:'New Jersey', NM:'New Mexico', NY:'New York', NC:'North Carolina', ND:'North Dakota', OH:'Ohio',
  OK:'Oklahoma', OR:'Oregon', PA:'Pennsylvania', RI:'Rhode Island', SC:'South Carolina', SD:'South Dakota',
  TN:'Tennessee', TX:'Texas', UT:'Utah', VT:'Vermont', VA:'Virginia', WA:'Washington', WV:'West Virginia',
  WI:'Wisconsin', WY:'Wyoming', DC:'District of Columbia',
}

function parseDistrictCode(chamber: string, code: string | null | undefined): { districtNumber: number | null; atLarge: boolean } {
  if (chamber !== 'house' || !code) return { districtNumber: null, atLarge: false }
  if (code.endsWith('-AL')) return { districtNumber: null, atLarge: true }
  const parts = code.split('-')
  const tail = parts[1]
  const n = tail ? parseInt(tail, 10) : NaN
  return { districtNumber: Number.isFinite(n) ? n : null, atLarge: false }
}

export default function OfficialDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const officialId = id ?? ''
  const officialQ = useOfficial(client, officialId)
  const leadershipQ = useOfficialLeadershipHistory(client, officialId)
  const scorecardsQ = useOfficialScorecardRatings(client, officialId)

  if (officialQ.isLoading) return <Text>Loading…</Text>
  if (!officialQ.data) return <Text>Not found</Text>

  const official = officialQ.data
  const leadership = leadershipQ.data ?? []
  const chips = selectTopAlignmentChips(scorecardsQ.data ?? [])
  const currentRole = leadership.find(r => r.end_date == null)?.role
    ?? (official.chamber === 'house' ? 'Representative' : 'Senator')
  const firstElectedYearValue = deriveFirstElectedYear(leadership)
  const { districtNumber, atLarge } = parseDistrictCode(official.chamber, (official as any).district?.code ?? null)

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView>
        <BioHeader
          officialId={official.id}
          fullName={official.full_name}
          portraitUrl={official.portrait_url}
          party={official.party}
          chamber={official.chamber as 'house' | 'senate'}
          state={official.state}
          stateName={STATE_NAMES[official.state] ?? official.state}
          districtNumber={districtNumber}
          senateClass={(official.senate_class ?? null) as 1 | 2 | 3 | null}
          atLarge={atLarge}
          role={currentRole}
          firstElectedYear={firstElectedYearValue}
          officialUrl={official.official_url}
          twitterHandle={official.twitter_handle}
          chips={chips}
        />
        <PerformanceSection officialId={officialId} chamber={official.chamber as 'house' | 'senate'} />
      </ScrollView>
    </SafeAreaView>
  )
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm --filter @chiaro/mobile typecheck 2>&1 | tail -3
git add apps/mobile/app/\(app\)/officials/\[id\].tsx
git commit -m "feat(mobile): rewrite /officials/[id] to BioHeader + PerformanceSection"
```

---

### Task 30: Rewrite home OfficialsCard mini-strip

**Files:**
- Modify: `apps/mobile/components/OfficialsCard.tsx`

- [ ] **Step 1: Replace contents**

Replace the existing OfficialsCard with one that uses `DistrictBadge` + `AlignmentChip` with `?cat=issue-positions&sub=<slug>` hrefs. Each row: avatar (existing `OfficialAvatar`) + name + DistrictBadge + alignment chips. Strip the old slice-4 mini-stat tags (top-industry, attendance %, scorecard scores).

`apps/mobile/components/OfficialsCard.tsx`:

```tsx
import { View, Text, Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useMyOfficials, useOfficialScorecardRatings, useOfficialMetrics } from '@chiaro/officials'
import type { OfficialWithDistrict } from '@chiaro/officials'
import { OfficialAvatar } from './OfficialAvatar'
import { DistrictBadge } from './cards/DistrictBadge'
import { AlignmentChip } from './cards/AlignmentChip'
import { selectTopAlignmentChips } from '@/lib/derivations/alignment'

const STATE_NAMES: Record<string, string> = {
  AL:'Alabama', AK:'Alaska', AZ:'Arizona', AR:'Arkansas', CA:'California', CO:'Colorado', CT:'Connecticut',
  DE:'Delaware', FL:'Florida', GA:'Georgia', HI:'Hawaii', ID:'Idaho', IL:'Illinois', IN:'Indiana', IA:'Iowa',
  KS:'Kansas', KY:'Kentucky', LA:'Louisiana', ME:'Maine', MD:'Maryland', MA:'Massachusetts', MI:'Michigan',
  MN:'Minnesota', MS:'Mississippi', MO:'Missouri', MT:'Montana', NE:'Nebraska', NV:'Nevada', NH:'New Hampshire',
  NJ:'New Jersey', NM:'New Mexico', NY:'New York', NC:'North Carolina', ND:'North Dakota', OH:'Ohio',
  OK:'Oklahoma', OR:'Oregon', PA:'Pennsylvania', RI:'Rhode Island', SC:'South Carolina', SD:'South Dakota',
  TN:'Tennessee', TX:'Texas', UT:'Utah', VT:'Vermont', VA:'Virginia', WA:'Washington', WV:'West Virginia',
  WI:'Wisconsin', WY:'Wyoming', DC:'District of Columbia',
}

const client = createSupabaseBrowserClient()

function parseDistrict(code: string | null | undefined): { districtNumber: number | null; atLarge: boolean } {
  if (!code) return { districtNumber: null, atLarge: false }
  if (code.endsWith('-AL')) return { districtNumber: null, atLarge: true }
  const parts = code.split('-')
  const tail = parts[1]
  const n = tail ? parseInt(tail, 10) : NaN
  return { districtNumber: Number.isFinite(n) ? n : null, atLarge: false }
}

function OfficialRow({ o }: { o: OfficialWithDistrict }) {
  const router = useRouter()
  const scorecards = useOfficialScorecardRatings(client, o.id)
  const metrics = useOfficialMetrics(client, o.id)
  const stateName = STATE_NAMES[o.state] ?? o.state
  const chips = selectTopAlignmentChips(scorecards.data ?? [])
  const currentRole = metrics.data?.salary_role && metrics.data.salary_role !== 'Member'
    ? metrics.data.salary_role
    : (o.chamber === 'house' ? 'Representative' : 'Senator')
  const { districtNumber, atLarge } = parseDistrict(o.district?.code ?? null)

  return (
    <View style={{ padding: 12, borderWidth: 1, borderColor: '#d8d4c9', borderRadius: 6, backgroundColor: '#fff', marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Pressable onPress={() => router.push(`/officials/${o.id}`)} accessibilityLabel={`View ${o.full_name}`}>
          <OfficialAvatar fullName={o.full_name} portraitUrl={o.portrait_url} size={44} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Pressable onPress={() => router.push(`/officials/${o.id}`)}>
            <Text style={{ fontWeight: '600', fontSize: 15, color: '#1a1714' }}>{o.full_name}</Text>
          </Pressable>
          <DistrictBadge
            chamber={o.chamber as 'house' | 'senate'}
            stateName={stateName}
            districtNumber={o.chamber === 'house' ? districtNumber : null}
            atLarge={o.chamber === 'house' && atLarge}
          />
          <Text style={{ fontSize: 11, color: '#3a352b', marginTop: 2 }}>
            {currentRole} · {o.chamber === 'house' ? 'House' : 'Senate'}
          </Text>
          {chips.length > 0 ? (
            <View style={{ flexDirection: 'row', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
              {chips.map(c => (
                <AlignmentChip
                  key={c.issueArea}
                  label={c.displayLabel}
                  tier={c.tier}
                  href={`/officials/${o.id}?cat=issue-positions&sub=${c.subCascadeSlug}`}
                />
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  )
}

export function OfficialsCard() {
  const router = useRouter()
  const { data, isLoading, error } = useMyOfficials(client)
  if (isLoading) return <Text>Loading officials…</Text>
  if (error) return <Text>Failed to load officials.</Text>
  if (!data || data.length === 0) return <Text>No officials yet — calibrate your address.</Text>

  return (
    <View style={{ padding: 16, backgroundColor: '#f7f5ef', borderRadius: 8 }}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: '#1a1714', marginBottom: 10 }}>Your officials</Text>
      {data.map(o => <OfficialRow key={o.id} o={o} />)}
      <Pressable onPress={() => router.push('/officials')}>
        <Text style={{ fontSize: 14, color: '#3b6ed1', marginTop: 10 }}>See all officials →</Text>
      </Pressable>
    </View>
  )
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm --filter @chiaro/mobile typecheck 2>&1 | tail -3
git add apps/mobile/components/OfficialsCard.tsx
git commit -m "feat(mobile): rewrite OfficialsCard — DistrictBadge + alignment chips with Expo param deep-link"
```

---

### Task 31: Delete superseded slice-4 mobile components

**Files** (delete):
- `apps/mobile/components/OfficialDetail.tsx`
- `apps/mobile/components/OfficialPerformance.tsx`
- `apps/mobile/components/ConstituentConnectionCard.tsx`
- `apps/mobile/components/FinanceCard.tsx`
- `apps/mobile/components/MetricCardShell.tsx` (the old root-path one)
- `apps/mobile/components/PositionSalaryCard.tsx`
- `apps/mobile/components/ScorecardCard.tsx`
- `apps/mobile/components/ShowUpWorkloadCard.tsx`

- [ ] **Step 1: Verify no consumers**

```bash
for f in OfficialDetail OfficialPerformance ConstituentConnectionCard FinanceCard PositionSalaryCard ScorecardCard ShowUpWorkloadCard; do
  echo "=== $f ==="
  grep -rnE "from.*['\"](\\./|@/)?(components/)?$f['\"]?" apps/mobile --include='*.tsx' --include='*.ts' | grep -v "components/$f\\.tsx" || echo "(no external importers)"
done
echo "=== MetricCardShell (root) ==="
grep -rnE "from.*components/MetricCardShell['\"]?" apps/mobile --include='*.tsx' --include='*.ts' | grep -v "components/MetricCardShell\\.tsx" || echo "(no external importers)"
```

Expected: all "no external importers". If any consumer remains, fix it before deleting.

- [ ] **Step 2: Delete files**

```bash
rm apps/mobile/components/OfficialDetail.tsx
rm apps/mobile/components/OfficialPerformance.tsx
rm apps/mobile/components/ConstituentConnectionCard.tsx
rm apps/mobile/components/FinanceCard.tsx
rm apps/mobile/components/MetricCardShell.tsx
rm apps/mobile/components/PositionSalaryCard.tsx
rm apps/mobile/components/ScorecardCard.tsx
rm apps/mobile/components/ShowUpWorkloadCard.tsx
```

- [ ] **Step 3: Verify workspace typecheck + test**

```bash
pnpm -r typecheck 2>&1 | tail -10
pnpm --filter @chiaro/mobile test 2>&1 | tail -10
```

Expected: typecheck clean across all 9 packages; mobile tests green.

- [ ] **Step 4: Commit**

```bash
git add -A apps/mobile/components/
git commit -m "chore(mobile): remove slice-4 components superseded by redesign"
```

---

### Task 32: Refresh DoD checklist + final verify

**Files:**
- Modify: `docs/superpowers/mobile-dod-checklist.md`

- [ ] **Step 1: Workspace checks**

```bash
pnpm -r typecheck 2>&1 | tail -10
pnpm --filter @chiaro/mobile test 2>&1 | tail -15
pnpm --filter @chiaro/web build 2>&1 | tail -5      # sanity: didn't break web
pnpm --filter @chiaro/web test 2>&1 | tail -5
```

Expected: all clean.

- [ ] **Step 2: Update DoD checklist**

Open `docs/superpowers/mobile-dod-checklist.md`. Extend with sections for:

- **Slice 4 + 4.5 — Officials detail redesign + bio polish**
  - Bio header order: Portrait → Name → BioIdentityRow (party | chamber | DistrictBadge) → AlignmentChipRow → ServiceCard → ContactLinks
  - DistrictBadge text reads "Ohio's 15th District" / "California" (senate) / "Wyoming's At-Large District"
  - Top-3 alignment chips appear when scorecards exist
  - All 6 category bars collapse/expand on tap
  - Sub-cascades expand independently
  - Inline evidence expand (not modal) on every metric card
  - Senate Lives-in-District card shows "No Data" + grey dot + "Unavailable"
  - Hageman (WY-AL) shows "Wyoming's At-Large District" not "WY-01"
- **Slice 5A — Finance placeholders**
  - Individual Donors sub-cascade expands to bars (no longer placeholder)
  - Top Organizations sub-cascade expands to bars
  - Top Industries still renders correctly
- **Deep-link verification**
  - Home OfficialsCard chip → opens detail with auto-expanded category + sub-cascade
- **Three variants**: House w/ fixture (Mike Carey), Senate (Bernie Moreno), At-Large (Harriet Hageman)

Mark the existing "After the run" section with the slice version bumped.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/mobile-dod-checklist.md
git commit -m "docs(mobile): refresh DoD checklist for slice-4.5 + 5A redesigns"
```

---

## Acceptance — recapped from the spec

After Task 32:

1. ✅ `apps/mobile/app/(app)/officials/[id].tsx` renders new BioHeader + PerformanceSection.
2. ✅ All 6 category components render with palette-A accents.
3. ✅ Top-3 alignment chips appear on BioHeader when scorecards exist.
4. ✅ BioIdentityRow uses DistrictBadge.
5. ✅ Senate Lives-in-District shows "No Data" + grey dot + "Unavailable".
6. ✅ Finance shows Individual Donors + Top Organizations as real cascades.
7. ✅ Home OfficialsCard chip deep-links via `?cat=...&sub=...`.
8. ✅ External links open via Linking.openURL.
9. ✅ SafeAreaView with top edge inset.
10. ✅ Old slice-4 mobile components deleted (8 files).
11. ✅ `pnpm --filter @chiaro/mobile typecheck` clean.
12. ✅ `pnpm --filter @chiaro/mobile test` green.
13. ✅ DoD checklist updated.
14. ✅ Android on-device DoD pass (separate manual run; spec defers iOS).

---

## Plan self-review notes

- **Spec coverage:** Every spec section maps to ≥1 task. Test infra = Tasks 1–2. Derivations = Task 3. Primitives = Tasks 4–9. Bio = Tasks 10–14. Finance components = Tasks 15–17. Performance infra = Tasks 18–21. Categories = Tasks 22–27. PerformanceSection = Task 28. Page integration = Task 29. Mini-strip rewrite = Task 30. Deletions = Task 31. DoD checklist refresh = Task 32.
- **No placeholders:** Tasks 22-27 use condensed structure citing the web reference file rather than reprinting ~80 lines of nearly-identical RN code each. The implementer subagent is expected to read the corresponding web component as a template and apply HTML→RN mechanically. The reference path is explicit in each task; the adaptation rules (View/Text/Pressable, Linking.openURL, flex layout) are stated. This is the only deviation from "show all code" — justified because: (a) the adaptation is mechanical and well-defined, (b) reproducing 6 × 80 lines would balloon the plan past 5000 lines without adding insight, (c) every primitive the categories consume is fully shown in Tasks 4-21.
- **Type consistency:** `AlignmentChipRow` flows from Task 3 (derivation) into Tasks 13 (BioAlignmentChipRow), 14 (BioHeader), 28 (PerformanceSection), 30 (OfficialsCard). `chamber: 'house' | 'senate'` literal threads through Tasks 23, 28, 29. `unavailable?: boolean` introduced in Task 8 (MetricCardShell) and consumed in Task 23 (CommunityPresenceCategory). `ExpandedStateApi` from Task 18 used in Task 19 (useExpoParamSync). Same `subCascade: { isOpen, onToggle }` shape used in Tasks 25 (IssuePositions), 26 (Finance), 27 (VotingBills), 28 (PerformanceSection).
- **Intermediate states stay green.** Each task includes typecheck + commit. No phantom red states like web's PR #3 had — mobile's existing slice-4 components stay intact until Task 31's batch-delete, and the new files don't have consumers until Tasks 28-30 wire them up.
- **Dependencies added in Task 1 are used immediately.** `react-native-svg` in Task 6 (DistrictBadge). `expo-linear-gradient` in Task 10 (BioPortrait). `jest-expo` + `@testing-library/react-native` in Task 2 (smoke) onwards.

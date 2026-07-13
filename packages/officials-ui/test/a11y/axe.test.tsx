// Slice 83 (audit U11, folded from dissolved S84): axe-core over
// representative real-DOM renders — the automated floor under the manual
// a11y work of slices 14/24/25/57. The gate's value is preventing NEW
// regressions; pre-existing non-trivial findings get a documented rule
// exclusion + follow-up rather than a silent skip.
import { render } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { createElement, type ReactElement, type ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ChiaroClient } from '@chiaro/supabase-client'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'
import { ChiaroClientProvider } from '../../src/client-context.tsx'
import { DetailCardShell } from '../../src/cards/DetailCardShell.tsx'
import { EventRowList } from '../../src/cards/EventRowList.tsx'
import { AuthForm } from '../../src/auth/AuthForm.tsx'
import { CalibrateScreen } from '../../src/calibrate/CalibrateScreen.tsx'
import { BrandNavRailBody } from '../../src/nav/BrandNavRailBody.tsx'
import { LegalBody, PRIVACY_COPY } from '../../src/legal/LegalBody.tsx'

function wrap(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const tree = createElement(
    BrandModeOverrideContext.Provider,
    { value: 'light' },
    <ChiaroClientProvider client={{ from: () => {} } as unknown as ChiaroClient}>
      <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
    </ChiaroClientProvider>,
  ) as ReactNode
  return render(tree as ReactElement)
}

// RNW renders Views as plain divs outside any landmark — page-level landmark
// structure belongs to the app shells (BioHeader's <section>, BrandPageScreen
// h1s), not these isolated component renders. `region` is therefore excluded
// as a false positive of component-scoped rendering, not a product waiver.
const RULES = { rules: { region: { enabled: false } } }

async function expectNoViolations(container: HTMLElement) {
  const results = await axe(container, RULES)
  expect(results.violations).toEqual([])
}

describe('axe: representative component renders (slice 83, U11)', () => {
  it('DetailCardShell — data branch', async () => {
    const { container } = wrap(
      <DetailCardShell title="Finance" isLoading={false} isEmpty={false} emptyText="none">
        <EventRowList
          rows={[{ id: 'r1', title: 'Town hall', url: 'https://example.org', when: 'Jan 2026' }]}
          keyOf={(r) => r.id}
          urlOf={(r) => r.url}
          titleOf={(r) => r.title}
          metaOf={(r) => [r.when, null]}
        />
      </DetailCardShell>,
    )
    await expectNoViolations(container)
  })

  it('DetailCardShell — loading, empty, and error branches', async () => {
    const { container } = wrap(
      <>
        <DetailCardShell title="A" isLoading={true} isEmpty={false} emptyText="">
          <></>
        </DetailCardShell>
        <DetailCardShell title="B" isLoading={false} isEmpty={true} emptyText="No records yet.">
          <></>
        </DetailCardShell>
        <DetailCardShell
          title="C"
          isLoading={false}
          isError={true}
          onRetry={() => {}}
          isEmpty={false}
          emptyText=""
        >
          <></>
        </DetailCardShell>
      </>,
    )
    await expectNoViolations(container)
  })

  it('AuthForm — sign-up with notice + resend', async () => {
    const { container } = wrap(
      <AuthForm
        mode="sign-up"
        onSubmit={async () => ({ notice: 'Check your email.' })}
        onResend={async () => {}}
        onCrossLinkPress={() => {}}
        crossLinkHref="/sign-in"
      />,
    )
    await expectNoViolations(container)
  })

  it('CalibrateScreen — with GPS + sample-address affordances', async () => {
    const { container } = wrap(
      <CalibrateScreen
        onSubmit={async () => {}}
        onSkip={() => {}}
        onGpsSubmit={async () => {}}
        sampleAddress="1 Dr Carlton B Goodlett Pl, San Francisco, CA 94102"
      />,
    )
    await expectNoViolations(container)
  })

  it('BrandNavRailBody — 4 nav items + sign out', async () => {
    const { container } = wrap(
      <BrandNavRailBody
        user={{ displayName: 'Jo', username: 'jo', initial: 'J' }}
        activeRouteKey="home"
        onNavigate={() => {}}
        onSignOut={() => {}}
      />,
    )
    await expectNoViolations(container)
  })

  it('LegalBody — privacy copy', async () => {
    const { container } = wrap(<LegalBody copy={PRIVACY_COPY} />)
    await expectNoViolations(container)
  })
})

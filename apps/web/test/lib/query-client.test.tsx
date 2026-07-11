import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

// Stub the rail mount so we can assert it renders without exercising its full
// surface. Slice 70 (audit C2) switched query-client.tsx to DEEP imports so
// the root layout stops pulling the whole officials-ui barrel — the mock must
// target the deep module path, not the barrel.
vi.mock('@chiaro/officials-ui/src/nav/BrandNavRailMount.tsx', () => ({
  BrandNavRailMount: () => <div data-testid="rail-mount-stub">RAIL</div>,
}))

// Stub the browser supabase client factory
vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: null } })), signOut: vi.fn() },
  }),
}))

import { QueryProvider } from '../../lib/query-client'

describe('QueryProvider', () => {
  it('renders BrandNavRailMount as sibling of children', () => {
    const { getByTestId, getByText } = render(
      <QueryProvider>
        <div>page-body</div>
      </QueryProvider>,
    )
    expect(getByTestId('rail-mount-stub')).toBeTruthy()
    expect(getByText('page-body')).toBeTruthy()
  })
})

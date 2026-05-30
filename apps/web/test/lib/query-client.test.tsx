import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

// Stub the rail mount so we can assert it renders without exercising its full surface
vi.mock('@chiaro/officials-ui', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>
  return {
    ...actual,
    BrandNavRailMount: () => <div data-testid="rail-mount-stub">RAIL</div>,
  }
})

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

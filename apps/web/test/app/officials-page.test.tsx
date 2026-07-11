import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

const redirectMock = vi.fn()
vi.mock('next/navigation', () => ({ redirect: redirectMock }))

let mockUser: { id: string } | null = { id: 'u1' }
vi.mock('@/lib/supabase/server', () => {
  const stub = () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: mockUser } })) },
  })
  return {
    createSupabaseServerClient: vi.fn(async () => stub()),
    getAuthenticatedUser: vi.fn(async () => ({ supabase: stub(), user: mockUser })),
  }
})

vi.mock('../../app/officials/OfficialsListClient', () => ({
  OfficialsListClient: () => <div data-testid="officials-list">officials list</div>,
}))

describe('Officials page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUser = { id: 'u1' }
  })

  it('renders title "Your officials" as h1 via BrandPageScreen', async () => {
    const { default: OfficialsPage } = await import('../../app/officials/page')
    const el = await OfficialsPage()
    const { container } = render(el)
    const h1 = container.querySelector('h1')
    expect(h1?.textContent).toBe('Your officials')
  })

  it('redirects to /sign-in when no user', async () => {
    mockUser = null
    const { default: OfficialsPage } = await import('../../app/officials/page')
    await OfficialsPage()
    expect(redirectMock).toHaveBeenCalledWith('/sign-in')
  })
})

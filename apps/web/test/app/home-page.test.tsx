import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

const { redirectMock } = vi.hoisted(() => ({ redirectMock: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: redirectMock }))

let mockUser: { id: string } | null = { id: 'u1' }
let mockProfile: { display_name: string | null; username: string | null; completed: boolean } | null = {
  display_name: 'Sarah', username: 'sarah', completed: true,
}

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: mockUser } })) },
  })),
}))
vi.mock('@chiaro/profile', () => ({
  getMyProfile: vi.fn(async () => mockProfile),
}))
vi.mock('@/components/DistrictPanel', () => ({
  DistrictPanel: () => <div data-testid="district-panel">district</div>,
}))
vi.mock('../../app/OfficialsCardClient', () => ({
  OfficialsCardClient: () => <div data-testid="officials-card">officials</div>,
}))
vi.mock('../../app/MyIssuesCardClient', () => ({
  MyIssuesCardClient: () => <div data-testid="my-issues-card">my-issues</div>,
}))

import Home from '../../app/page'

describe('Home page', () => {
  it('redirects to /sign-in when no user', async () => {
    mockUser = null
    await Home()
    expect(redirectMock).toHaveBeenCalledWith('/sign-in')
    mockUser = { id: 'u1' }
  })

  it('renders Logo lockup + Welcome heading with profile name', async () => {
    mockProfile = { display_name: 'Sarah', username: 'sarah', completed: true }
    const el = await Home()
    const { container } = render(el)
    const h1 = container.querySelector('h1')
    expect(h1?.textContent).toBe('Welcome, Sarah')
    const wordmark = Array.from(container.querySelectorAll('*'))
      .find(el => el.textContent === 'CHIARO')
    expect(wordmark).toBeTruthy()
  })

  it('renders profile-completion BrandAlert when profile incomplete', async () => {
    mockProfile = { display_name: null, username: null, completed: false }
    const el = await Home()
    const { container, getByText } = render(el)
    expect(getByText('Complete your profile')).toBeTruthy()
    expect(container.querySelector('a[href="/profile/edit"]')).toBeTruthy()
  })

  it('does not render an inline sign-out form (moved to nav rail)', async () => {
    mockProfile = { display_name: 'Sarah', username: 'sarah', completed: true }
    const el = await Home()
    const { container } = render(el)
    expect(container.querySelector('form[action="/sign-out"]')).toBeNull()
  })
})

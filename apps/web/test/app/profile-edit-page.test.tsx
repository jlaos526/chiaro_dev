import { describe, expect, it, vi } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'

const { pushMock, refreshMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}))

const { updateMyProfile } = vi.hoisted(() => ({ updateMyProfile: vi.fn() }))
vi.mock('@chiaro/profile', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>
  return {
    ...actual,
    updateMyProfile: (...args: unknown[]) => updateMyProfile(...args),
    ProfileError: class ProfileError extends Error {},
  }
})

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({}),
}))

import ProfileEditPage from '../../app/profile/edit/page'

describe('ProfileEditPage', () => {
  it('renders BrandFormScreen with title "Complete your profile"', () => {
    const { container } = render(<ProfileEditPage />)
    const h1 = container.querySelector('h1')
    expect(h1?.textContent).toBe('Complete your profile')
  })

  it('submits the form and routes to / on success', async () => {
    updateMyProfile.mockResolvedValueOnce({})
    const { container, getByText } = render(<ProfileEditPage />)
    const inputs = container.querySelectorAll('input')
    fireEvent.change(inputs[0]!, { target: { value: 'Sarah' } })
    fireEvent.change(inputs[1]!, { target: { value: 'sarah' } })
    fireEvent.click(getByText('Save'))
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/'))
    expect(refreshMock).toHaveBeenCalled()
  })

  it('renders BrandAlert with danger severity on submission error', async () => {
    updateMyProfile.mockRejectedValueOnce(new Error('Username taken'))
    const { container, getByText, findByText } = render(<ProfileEditPage />)
    const inputs = container.querySelectorAll('input')
    fireEvent.change(inputs[0]!, { target: { value: 'Sarah' } })
    fireEvent.change(inputs[1]!, { target: { value: 'sarah' } })
    fireEvent.click(getByText('Save'))
    await findByText(/username taken/i)
  })
})

import { describe, expect, it, vi } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'

const { pushMock, refreshMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}))

const { getMyLocation } = vi.hoisted(() => ({ getMyLocation: vi.fn() }))
vi.mock('@chiaro/location', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    getMyLocation: (...args: unknown[]) => getMyLocation(...args),
  }
})

const { functionsInvoke } = vi.hoisted(() => ({ functionsInvoke: vi.fn() }))
vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    functions: { invoke: (...args: unknown[]) => functionsInvoke(...args) },
  }),
}))

import EditAddressPage from '../../app/settings/address/page'

describe('EditAddressPage', () => {
  it('renders bootstrap state with title "Home address"', async () => {
    getMyLocation.mockResolvedValueOnce(null)
    const { container } = render(<EditAddressPage />)
    await waitFor(() => {
      const h1 = container.querySelector('h1')
      expect(h1?.textContent).toBe('Home address')
    })
  })

  it('bootstraps from existing location into the input', async () => {
    getMyLocation.mockResolvedValueOnce({
      home_address_text: '123 Main St',
      calibrated_at: '2026-05-30T12:00:00Z',
    })
    const { container } = render(<EditAddressPage />)
    await waitFor(() => {
      const input = container.querySelector('input') as HTMLInputElement | null
      expect(input?.value).toBe('123 Main St')
    })
  })

  it('renders last-updated subtitle when calibratedAt present', async () => {
    getMyLocation.mockResolvedValueOnce({
      home_address_text: '123 Main St',
      calibrated_at: '2026-05-30T12:00:00Z',
    })
    const { findByText } = render(<EditAddressPage />)
    await findByText(/last updated/i)
  })

  it('submits + routes to /settings on success', async () => {
    getMyLocation.mockResolvedValueOnce({
      home_address_text: '123 Main St, Springfield IL 62701',
      calibrated_at: null,
    })
    functionsInvoke.mockResolvedValueOnce({ error: null })
    const { container, getByText } = render(<EditAddressPage />)
    await waitFor(() =>
      expect(container.querySelector('input')?.value).toBe('123 Main St, Springfield IL 62701'),
    )
    fireEvent.click(getByText('Save'))
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/settings'))
  })

  it('renders BrandAlert with danger severity on error', async () => {
    getMyLocation.mockResolvedValueOnce({
      home_address_text: '123 Main St, Springfield IL 62701',
      calibrated_at: null,
    })
    functionsInvoke.mockResolvedValueOnce({ error: { context: { status: 400 } } })
    const { container, getByText, findByText } = render(<EditAddressPage />)
    await waitFor(() =>
      expect(container.querySelector('input')?.value).toBe('123 Main St, Springfield IL 62701'),
    )
    fireEvent.click(getByText('Save'))
    await findByText(/couldn'?t find that address/i)
  })
})

import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

// `/settings` is a 'use client' shell — no server-side auth guard. Mock the
// @chiaro/officials-ui settings primitives as plain DOM so we can assert the
// page's section/row wiring (nav hrefs, sign-out action) without RNW.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({}),
}))

const { signOut } = vi.hoisted(() => ({ signOut: vi.fn() }))
vi.mock('@chiaro/officials-ui', () => ({
  signOut: (...a: unknown[]) => signOut(...a),
  BrandModeThemeRow: () => <div data-testid="brand-mode-theme-row" />,
  SettingsScreen: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="settings-screen">{children}</div>
  ),
  SettingsSection: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section data-section={title}>{children}</section>
  ),
  SettingsNavRow: ({ label, href }: { label: string; href: string }) => (
    <a data-row="nav" data-label={label} href={href}>
      {label}
    </a>
  ),
  SettingsActionRow: ({ label, onPress }: { label: string; onPress: () => void }) => (
    <button data-row="action" data-label={label} onClick={onPress}>
      {label}
    </button>
  ),
  SettingsToggleRow: ({ label }: { label: string }) => <div data-row="toggle" data-label={label} />,
  SettingsComingSoonRow: ({ label }: { label: string }) => (
    <div data-row="coming-soon" data-label={label} />
  ),
  SettingsValueRow: ({ label, value }: { label: string; value: string }) => (
    <div data-row="value" data-label={label} data-value={value} />
  ),
}))

import SettingsIndex from '../../app/settings/page'

describe('settings page', () => {
  it('mounts the SettingsScreen with all five sections', () => {
    const { container } = render(<SettingsIndex />)
    expect(container.querySelector('[data-testid="settings-screen"]')).toBeTruthy()
    const sections = Array.from(container.querySelectorAll('section')).map((s) =>
      s.getAttribute('data-section'),
    )
    expect(sections).toEqual(['Account', 'Appearance', 'Notifications', 'Profile', 'About'])
  })

  it('wires the Issue priorities nav row to /issues', () => {
    const { container } = render(<SettingsIndex />)
    const row = container.querySelector('a[data-label="Issue priorities"]')
    expect(row?.getAttribute('href')).toBe('/issues')
  })

  it('invokes signOut when the Sign out action row is pressed', () => {
    const { getByText } = render(<SettingsIndex />)
    getByText('Sign out').click()
    expect(signOut).toHaveBeenCalled()
  })
})

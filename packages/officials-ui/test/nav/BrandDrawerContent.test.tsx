import { describe, expect, it, vi } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'
import { ChiaroClientProvider, type ChiaroClientProviderProps } from '../../src/client-context.tsx'
import type { DrawerContentComponentProps } from '@react-navigation/drawer'

const { routerMock } = vi.hoisted(() => ({
  routerMock: { push: vi.fn(), refresh: vi.fn(), back: vi.fn() },
}))
vi.mock('expo-router', () => ({
  useRouter: () => routerMock,
}))

let mockProfile: { display_name: string | null; username: string | null } | null = {
  display_name: 'Sarah', username: 'sarah',
}
vi.mock('@chiaro/profile', () => ({
  getMyProfile: vi.fn(async () => mockProfile),
}))

// Stub DrawerContentScrollView from @react-navigation/drawer so we don't pull
// the whole drawer machinery into vitest.
vi.mock('@react-navigation/drawer', () => ({
  DrawerContentScrollView: ({ children }: { children: ReactNode }) =>
    createElement('div', { 'data-testid': 'drawer-scroll-view' }, children),
}))

const fakeClient = {
  auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'u1' } } })), signOut: vi.fn(async () => ({})) },
} as never

function wrap(mode: 'light' | 'dark' = 'light') {
  return ({ children }: { children: ReactNode }) =>
    createElement(
      ChiaroClientProvider,
      { client: fakeClient } as unknown as ChiaroClientProviderProps,
      createElement(BrandModeOverrideContext.Provider, { value: mode }, children),
    )
}

import { BrandDrawerContent } from '../../src/nav/BrandDrawerContent.tsx'

function makeDrawerProps(activeRouteName: string) {
  return {
    state: {
      routes: [{ key: 'r1', name: activeRouteName }],
      index: 0,
    },
    navigation: {
      navigate: vi.fn(),
      closeDrawer: vi.fn(),
    },
    descriptors: {},
  } as unknown as DrawerContentComponentProps
}

describe('BrandDrawerContent', () => {
  it('renders BrandNavRailBody with profile data', async () => {
    mockProfile = { display_name: 'Sarah', username: 'sarah' }
    const props = makeDrawerProps('index')
    const { findByText } = render(<BrandDrawerContent {...props} />, { wrapper: wrap() })
    expect(await findByText('Sarah')).toBeTruthy()
    expect(await findByText('@sarah')).toBeTruthy()
  })

  it('falls back to "Welcome" + "?" on null profile', async () => {
    mockProfile = null
    const props = makeDrawerProps('index')
    const { findByText } = render(<BrandDrawerContent {...props} />, { wrapper: wrap() })
    expect(await findByText('Welcome')).toBeTruthy()
    expect(await findByText('?')).toBeTruthy()
  })

  it('marks Home active when route name is "index"', async () => {
    mockProfile = { display_name: 'Sarah', username: 'sarah' }
    const props = makeDrawerProps('index')
    const { container, findByText } = render(<BrandDrawerContent {...props} />, { wrapper: wrap() })
    await findByText('Sarah')
    const homeActive = Array.from(container.querySelectorAll('[data-active="true"]'))
      .find(el => el.textContent?.includes('Home'))
    expect(homeActive).toBeTruthy()
  })

  it('marks Officials active when route name is "officials/index"', async () => {
    mockProfile = { display_name: 'Sarah', username: 'sarah' }
    const props = makeDrawerProps('officials/index')
    const { container, findByText } = render(<BrandDrawerContent {...props} />, { wrapper: wrap() })
    await findByText('Sarah')
    const officialsActive = Array.from(container.querySelectorAll('[data-active="true"]'))
      .find(el => el.textContent?.includes('Officials'))
    expect(officialsActive).toBeTruthy()
  })

  it('invokes signOut helper + closes drawer when Sign out is pressed', async () => {
    mockProfile = { display_name: 'Sarah', username: 'sarah' }
    const props = makeDrawerProps('index')
    const { findByText } = render(<BrandDrawerContent {...props} />, { wrapper: wrap() })
    await findByText('Sarah')
    fireEvent.click(await findByText('Sign out'))
    await waitFor(() => expect(fakeClient.auth.signOut).toHaveBeenCalled())
    expect(props.navigation.closeDrawer).toHaveBeenCalled()
  })
})

import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

// Stub expo-router/drawer's Drawer export so we can inspect screenOptions
// without pulling the whole React Navigation runtime.
const drawerSpy = vi.fn()
vi.mock('expo-router/drawer', () => ({
  Drawer: (props: Record<string, unknown>) => {
    drawerSpy(props)
    return createElement('div', { 'data-testid': 'drawer-stub' })
  },
}))

// BrandDrawerContent is invoked by drawerContent — stub it to avoid pulling
// getMyProfile / ChiaroClientProvider into this test.
vi.mock('../../src/nav/BrandDrawerContent.tsx', () => ({
  BrandDrawerContent: () => createElement('div', { 'data-testid': 'drawer-content-stub' }),
}))

import { BrandDrawer } from '../../src/nav/BrandDrawer.tsx'

function withMode(mode: 'light' | 'dark') {
  return ({ children }: { children: ReactNode }) =>
    createElement(BrandModeOverrideContext.Provider, { value: mode }, children)
}

describe('BrandDrawer', () => {
  it('renders Expo Router Drawer with brand-themed screenOptions', () => {
    drawerSpy.mockClear()
    render(<BrandDrawer />, { wrapper: withMode('light') })
    expect(drawerSpy).toHaveBeenCalled()
    const props = drawerSpy.mock.calls[0]![0]
    expect(props.screenOptions.drawerType).toBe('front')
    expect(props.screenOptions.drawerStyle.width).toBe('78%')
    expect(props.screenOptions.headerStyle.backgroundColor).toBeDefined()
    expect(props.screenOptions.drawerStyle.backgroundColor).toBeDefined()
    expect(props.screenOptions.overlayColor).toBe('rgba(0,0,0,0.4)')
  })

  it('passes drawerContent that renders BrandDrawerContent', () => {
    drawerSpy.mockClear()
    render(<BrandDrawer />, { wrapper: withMode('light') })
    const props = drawerSpy.mock.calls[0]![0]
    expect(typeof props.drawerContent).toBe('function')
    const rendered = props.drawerContent({ state: {}, navigation: {}, descriptors: {} })
    expect(rendered).toBeDefined()
  })

  it('applies screenOptionsOverride on top of brand defaults', () => {
    drawerSpy.mockClear()
    render(<BrandDrawer screenOptionsOverride={{ headerShown: false }} />, { wrapper: withMode('light') })
    const props = drawerSpy.mock.calls[0]![0]
    expect(props.screenOptions.headerShown).toBe(false)
    expect(props.screenOptions.drawerType).toBe('front') // base still applies
  })
})

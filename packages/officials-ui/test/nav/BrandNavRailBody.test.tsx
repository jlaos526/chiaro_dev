import { describe, expect, it, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'
import { BrandNavRailBody } from '../../src/nav/BrandNavRailBody.tsx'

function withMode(mode: 'light' | 'dark') {
  return ({ children }: { children: ReactNode }) =>
    createElement(BrandModeOverrideContext.Provider, { value: mode }, children)
}

const user = { displayName: 'Sarah', username: 'sarah', initial: 'S' }

describe('BrandNavRailBody', () => {
  it('renders avatar + name + handle from user prop', () => {
    const { getByText } = render(
      <BrandNavRailBody
        user={user}
        activeRouteKey="home"
        onNavigate={() => {}}
        onSignOut={() => {}}
      />,
      { wrapper: withMode('light') },
    )
    expect(getByText('Sarah')).toBeTruthy()
    expect(getByText('@sarah')).toBeTruthy()
    expect(getByText('S')).toBeTruthy()
  })

  it('renders 4 nav items (Home / Officials / Issue priorities / Settings) + Sign out', () => {
    const { getByText } = render(
      <BrandNavRailBody
        user={user}
        activeRouteKey="home"
        onNavigate={() => {}}
        onSignOut={() => {}}
      />,
      { wrapper: withMode('light') },
    )
    expect(getByText('Home')).toBeTruthy()
    expect(getByText('Officials')).toBeTruthy()
    // Slice 79.5 (audit U4): the issues flow finally has a nav entry.
    expect(getByText('Issue priorities')).toBeTruthy()
    expect(getByText('Settings')).toBeTruthy()
    expect(getByText('Sign out')).toBeTruthy()
  })

  it('marks the active item via data-active="true"', () => {
    const { container } = render(
      <BrandNavRailBody
        user={user}
        activeRouteKey="officials"
        onNavigate={() => {}}
        onSignOut={() => {}}
      />,
      { wrapper: withMode('light') },
    )
    const officialsActive = Array.from(container.querySelectorAll('[data-active="true"]')).find(
      (el) => el.textContent?.includes('Officials'),
    )
    expect(officialsActive).toBeTruthy()
  })

  it('does not mark any item active when activeRouteKey is null', () => {
    const { container } = render(
      <BrandNavRailBody
        user={user}
        activeRouteKey={null}
        onNavigate={() => {}}
        onSignOut={() => {}}
      />,
      { wrapper: withMode('light') },
    )
    const anyActive = container.querySelectorAll('[data-active="true"]')
    expect(anyActive.length).toBe(0)
  })

  it('invokes onNavigate with the correct key', () => {
    const onNavigate = vi.fn()
    const { getByText } = render(
      <BrandNavRailBody
        user={user}
        activeRouteKey="home"
        onNavigate={onNavigate}
        onSignOut={() => {}}
      />,
      { wrapper: withMode('light') },
    )
    fireEvent.click(getByText('Officials'))
    expect(onNavigate).toHaveBeenCalledWith('officials')
    fireEvent.click(getByText('Issue priorities'))
    expect(onNavigate).toHaveBeenCalledWith('issues')
  })

  it('invokes onSignOut on Sign out press', () => {
    const onSignOut = vi.fn()
    const { getByText } = render(
      <BrandNavRailBody
        user={user}
        activeRouteKey="home"
        onNavigate={() => {}}
        onSignOut={onSignOut}
      />,
      { wrapper: withMode('light') },
    )
    fireEvent.click(getByText('Sign out'))
    expect(onSignOut).toHaveBeenCalled()
  })

  it('falls back to "Welcome" when displayName + username are both null', () => {
    const { getByText } = render(
      <BrandNavRailBody
        user={{ displayName: null, username: null, initial: '?' }}
        activeRouteKey={null}
        onNavigate={() => {}}
        onSignOut={() => {}}
      />,
      { wrapper: withMode('light') },
    )
    expect(getByText('Welcome')).toBeTruthy()
  })
})

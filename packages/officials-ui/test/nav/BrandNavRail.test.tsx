import { describe, expect, it, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'
import { BrandNavRail } from '../../src/nav/BrandNavRail.tsx'

function withMode(mode: 'light' | 'dark') {
  return ({ children }: { children: ReactNode }) =>
    createElement(BrandModeOverrideContext.Provider, { value: mode }, children)
}

const user = { displayName: 'Sarah', username: 'sarah', initial: 'S' }

describe('BrandNavRail desktop variant', () => {
  it('renders avatar block with name + @handle', () => {
    const { getByText } = render(
      <BrandNavRail
        variant="desktop"
        user={user}
        pathname="/"
        onNavigate={() => {}}
        onSignOut={() => {}}
      />,
      { wrapper: withMode('light') },
    )
    expect(getByText('Sarah')).toBeTruthy()
    expect(getByText('@sarah')).toBeTruthy()
    expect(getByText('S')).toBeTruthy()
  })

  it('renders 3 nav items (Home / Officials / Settings)', () => {
    const { getByText } = render(
      <BrandNavRail
        variant="desktop"
        user={user}
        pathname="/"
        onNavigate={() => {}}
        onSignOut={() => {}}
      />,
      { wrapper: withMode('light') },
    )
    expect(getByText('Home')).toBeTruthy()
    expect(getByText('Officials')).toBeTruthy()
    expect(getByText('Settings')).toBeTruthy()
  })

  it('marks the active item with data-active="true"', () => {
    const { container } = render(
      <BrandNavRail
        variant="desktop"
        user={user}
        pathname="/officials"
        onNavigate={() => {}}
        onSignOut={() => {}}
      />,
      { wrapper: withMode('light') },
    )
    // Find any element with data-active="true" whose text descendant is "Officials"
    const officialsActive = Array.from(container.querySelectorAll('[data-active="true"]')).find(
      (el) => el.textContent?.includes('Officials'),
    )
    expect(officialsActive).toBeTruthy()
  })

  it('renders Sign out at bottom', () => {
    const { getByText } = render(
      <BrandNavRail
        variant="desktop"
        user={user}
        pathname="/"
        onNavigate={() => {}}
        onSignOut={() => {}}
      />,
      { wrapper: withMode('light') },
    )
    expect(getByText('Sign out')).toBeTruthy()
  })

  it('invokes onNavigate when a nav item is pressed', () => {
    const onNavigate = vi.fn()
    const { getByText } = render(
      <BrandNavRail
        variant="desktop"
        user={user}
        pathname="/"
        onNavigate={onNavigate}
        onSignOut={() => {}}
      />,
      { wrapper: withMode('light') },
    )
    fireEvent.click(getByText('Officials'))
    expect(onNavigate).toHaveBeenCalledWith('/officials')
  })

  it('invokes onSignOut when Sign out is pressed', () => {
    const onSignOut = vi.fn()
    const { getByText } = render(
      <BrandNavRail
        variant="desktop"
        user={user}
        pathname="/"
        onNavigate={() => {}}
        onSignOut={onSignOut}
      />,
      { wrapper: withMode('light') },
    )
    fireEvent.click(getByText('Sign out'))
    expect(onSignOut).toHaveBeenCalled()
  })

  it('handles user without display_name (falls back to username initial)', () => {
    const { getByText } = render(
      <BrandNavRail
        variant="desktop"
        user={{ displayName: null, username: 'alice', initial: 'A' }}
        pathname="/"
        onNavigate={() => {}}
        onSignOut={() => {}}
      />,
      { wrapper: withMode('light') },
    )
    expect(getByText('alice')).toBeTruthy()
    expect(getByText('A')).toBeTruthy()
  })
})

describe('BrandNavRail mobile variant', () => {
  it('renders hamburger + avatar top bar when closed', () => {
    const { container, getByText } = render(
      <BrandNavRail
        variant="mobile"
        open={false}
        onOpenChange={() => {}}
        user={user}
        pathname="/"
        onNavigate={() => {}}
        onSignOut={() => {}}
      />,
      { wrapper: withMode('light') },
    )
    expect(container.querySelector('[aria-label="Open menu"]')).toBeTruthy()
    expect(getByText('S')).toBeTruthy()
  })

  it('does not render Navigate items when closed', () => {
    const { queryByText } = render(
      <BrandNavRail
        variant="mobile"
        open={false}
        onOpenChange={() => {}}
        user={user}
        pathname="/"
        onNavigate={() => {}}
        onSignOut={() => {}}
      />,
      { wrapper: withMode('light') },
    )
    expect(queryByText('Officials')).toBeNull()
    expect(queryByText('Sign out')).toBeNull()
  })

  it('renders overlay rail + scrim when open', () => {
    const { container, getByText } = render(
      <BrandNavRail
        variant="mobile"
        open={true}
        onOpenChange={() => {}}
        user={user}
        pathname="/"
        onNavigate={() => {}}
        onSignOut={() => {}}
      />,
      { wrapper: withMode('light') },
    )
    expect(getByText('Officials')).toBeTruthy()
    expect(getByText('Sign out')).toBeTruthy()
    expect(container.querySelector('[data-chiaro-rail-scrim="true"]')).toBeTruthy()
  })

  it('calls onOpenChange(true) when hamburger is pressed (closed)', () => {
    const onOpenChange = vi.fn()
    const { container } = render(
      <BrandNavRail
        variant="mobile"
        open={false}
        onOpenChange={onOpenChange}
        user={user}
        pathname="/"
        onNavigate={() => {}}
        onSignOut={() => {}}
      />,
      { wrapper: withMode('light') },
    )
    const hamburger = container.querySelector('[aria-label="Open menu"]') as HTMLElement
    fireEvent.click(hamburger)
    expect(onOpenChange).toHaveBeenCalledWith(true)
  })

  it('calls onOpenChange(false) when scrim is pressed', () => {
    const onOpenChange = vi.fn()
    const { container } = render(
      <BrandNavRail
        variant="mobile"
        open={true}
        onOpenChange={onOpenChange}
        user={user}
        pathname="/"
        onNavigate={() => {}}
        onSignOut={() => {}}
      />,
      { wrapper: withMode('light') },
    )
    const scrim = container.querySelector('[data-chiaro-rail-scrim="true"]') as HTMLElement
    fireEvent.click(scrim)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('calls onOpenChange(false) when a nav item is pressed', () => {
    const onOpenChange = vi.fn()
    const { getByText } = render(
      <BrandNavRail
        variant="mobile"
        open={true}
        onOpenChange={onOpenChange}
        user={user}
        pathname="/"
        onNavigate={() => {}}
        onSignOut={() => {}}
      />,
      { wrapper: withMode('light') },
    )
    fireEvent.click(getByText('Officials'))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('aria-expanded on hamburger reflects open state', () => {
    const { container, rerender } = render(
      <BrandNavRail
        variant="mobile"
        open={false}
        onOpenChange={() => {}}
        user={user}
        pathname="/"
        onNavigate={() => {}}
        onSignOut={() => {}}
      />,
      { wrapper: withMode('light') },
    )
    expect(container.querySelector('[aria-label="Open menu"]')?.getAttribute('aria-expanded')).toBe(
      'false',
    )
    rerender(
      <BrandNavRail
        variant="mobile"
        open={true}
        onOpenChange={() => {}}
        user={user}
        pathname="/"
        onNavigate={() => {}}
        onSignOut={() => {}}
      />,
    )
    expect(container.querySelector('[aria-label="Open menu"]')?.getAttribute('aria-expanded')).toBe(
      'true',
    )
  })

  it('mobile top bar uses position: fixed on web', () => {
    const { container } = render(
      <BrandNavRail
        variant="mobile"
        open={false}
        onOpenChange={() => {}}
        user={user}
        pathname="/"
        onNavigate={() => {}}
        onSignOut={() => {}}
      />,
      { wrapper: withMode('light') },
    )
    const topBar = container.firstChild as HTMLElement
    expect(topBar?.getAttribute('style')).toMatch(/position:\s*fixed/i)
  })
})

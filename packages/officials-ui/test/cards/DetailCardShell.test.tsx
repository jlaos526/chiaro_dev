import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { Text } from 'react-native'
import { BRAND_SEMANTIC } from '@chiaro/ui-tokens'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'
import { DetailCardShell } from '../../src/cards/DetailCardShell.tsx'

function withMode(mode: 'light' | 'dark') {
  return ({ children }: { children: ReactNode }) =>
    createElement(BrandModeOverrideContext.Provider, { value: mode }, children)
}

// RNW StyleSheet normalizes hex colors to rgb(R, G, B) form in inline styles
// (see Gotcha #19 / slice 39 RNW pattern findings). Accept either form.
function hexToRgb(hex: string): string {
  const cleaned = hex.replace('#', '')
  const r = parseInt(cleaned.slice(0, 2), 16)
  const g = parseInt(cleaned.slice(2, 4), 16)
  const b = parseInt(cleaned.slice(4, 6), 16)
  return `rgb(${r}, ${g}, ${b})`
}

function styleContainsColor(style: string, hex: string): boolean {
  return style.includes(hex) || style.includes(hexToRgb(hex))
}

const BASE = {
  title: 'Community Presence',
  isLoading: false,
  isEmpty: false,
  emptyText: 'No data available for this legislator yet.',
}

describe('DetailCardShell — branch precedence (error > loading > empty > data)', () => {
  it('error wins over loading (and empty)', () => {
    render(
      <DetailCardShell {...BASE} isError isLoading isEmpty>
        <Text>data-child</Text>
      </DetailCardShell>,
    )
    expect(screen.getByText(/Couldn't load this section\./)).toBeTruthy()
    expect(screen.queryByText('Loading…')).toBeNull()
    expect(screen.queryByText(BASE.emptyText)).toBeNull()
    expect(screen.queryByText('data-child')).toBeNull()
  })

  it('loading wins over empty', () => {
    render(
      <DetailCardShell {...BASE} isLoading isEmpty>
        <Text>data-child</Text>
      </DetailCardShell>,
    )
    expect(screen.getByText('Loading…')).toBeTruthy()
    expect(screen.queryByText(BASE.emptyText)).toBeNull()
    expect(screen.queryByText('data-child')).toBeNull()
  })

  it('empty branch renders emptyText', () => {
    render(
      <DetailCardShell {...BASE} isEmpty>
        <Text>data-child</Text>
      </DetailCardShell>,
    )
    expect(screen.getByText(BASE.emptyText)).toBeTruthy()
    expect(screen.queryByText('data-child')).toBeNull()
  })

  it('data branch renders children when not error/loading/empty', () => {
    render(
      <DetailCardShell {...BASE}>
        <Text>data-child</Text>
      </DetailCardShell>,
    )
    expect(screen.getByText('data-child')).toBeTruthy()
    expect(screen.queryByText('Loading…')).toBeNull()
    expect(screen.queryByText(BASE.emptyText)).toBeNull()
    expect(screen.queryByText(/Couldn't load this section\./)).toBeNull()
  })
})

describe('DetailCardShell — error branch (U2)', () => {
  it('renders no Retry affordance without onRetry', () => {
    render(
      <DetailCardShell {...BASE} isError>
        <Text>data-child</Text>
      </DetailCardShell>,
    )
    expect(screen.getByText(/Couldn't load this section\./)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Retry/i })).toBeNull()
    expect(screen.queryByText('Retry')).toBeNull()
  })

  it('renders Retry with onRetry and fires it on press', () => {
    const onRetry = vi.fn()
    render(
      <DetailCardShell {...BASE} isError onRetry={onRetry}>
        <Text>data-child</Text>
      </DetailCardShell>,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})

describe('DetailCardShell — heading contract (slice 57 C1)', () => {
  it('title renders as role="heading" with aria-level="2" in every branch', () => {
    // RNW translates accessibilityRole="header" + accessibilityLevel={2} to
    // <div role="heading" aria-level="2"> (Gotcha #22-style DOM assertion).
    const branches = [
      { isLoading: true, isEmpty: false, isError: false },
      { isLoading: false, isEmpty: true, isError: false },
      { isLoading: false, isEmpty: false, isError: true },
      { isLoading: false, isEmpty: false, isError: false },
    ]
    for (const branch of branches) {
      const { unmount } = render(
        <DetailCardShell {...BASE} {...branch}>
          <Text>data-child</Text>
        </DetailCardShell>,
      )
      const title = screen.getByText(BASE.title)
      expect(title.getAttribute('role')).toBe('heading')
      expect(title.getAttribute('aria-level')).toBe('2')
      unmount()
    }
  })
})

describe('DetailCardShell — bg scheme (spec D1: shell = bg.elevated)', () => {
  it('card container carries semantic.bg.elevated in light and dark', () => {
    const light = render(
      <DetailCardShell {...BASE} testID="shell">
        <Text>data-child</Text>
      </DetailCardShell>,
      { wrapper: withMode('light') },
    )
    const lightStyle = light.getByTestId('shell').getAttribute('style') ?? ''
    expect(styleContainsColor(lightStyle, BRAND_SEMANTIC.light.bg.elevated)).toBe(true)
    light.unmount()

    const dark = render(
      <DetailCardShell {...BASE} testID="shell">
        <Text>data-child</Text>
      </DetailCardShell>,
      { wrapper: withMode('dark') },
    )
    const darkStyle = dark.getByTestId('shell').getAttribute('style') ?? ''
    expect(styleContainsColor(darkStyle, BRAND_SEMANTIC.dark.bg.elevated)).toBe(true)
  })
})

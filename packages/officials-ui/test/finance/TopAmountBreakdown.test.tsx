import { createElement, type ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Linking } from 'react-native'
import { TopAmountBreakdown } from '../../src/finance/TopAmountBreakdown.tsx'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

const lightWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
const darkWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)

const TEN = Array.from({ length: 10 }, (_, i) => ({
  label: `Industry ${i + 1}`,
  amount: (10 - i) * 50_000,
}))

const NOUN_INDUSTRY = { singular: 'industry', plural: 'industries' }
const NOUN_DONOR = { singular: 'donor', plural: 'donors' }

describe('TopAmountBreakdown', () => {
  it('renders 5 rows by default', () => {
    render(<TopAmountBreakdown rows={TEN} noun={NOUN_INDUSTRY} />)
    expect(screen.getByText('Industry 1')).toBeTruthy()
    expect(screen.getByText('Industry 5')).toBeTruthy()
    expect(screen.queryByText('Industry 6')).toBeNull()
  })

  it('toggle reads "Show 5 more <noun.plural>"', () => {
    render(<TopAmountBreakdown rows={TEN} noun={NOUN_INDUSTRY} />)
    expect(screen.getByText('Show 5 more industries')).toBeTruthy()
    expect(screen.getByText('5 of 10 shown')).toBeTruthy()
  })

  it('toggle copy reflects a different noun', () => {
    render(<TopAmountBreakdown rows={TEN} noun={NOUN_DONOR} />)
    expect(screen.getByText('Show 5 more donors')).toBeTruthy()
  })

  it('clicking the toggle expands to all rows', () => {
    render(<TopAmountBreakdown rows={TEN} noun={NOUN_INDUSTRY} />)
    fireEvent.click(screen.getByText('Show 5 more industries'))
    expect(screen.getByText('Industry 6')).toBeTruthy()
    expect(screen.getByText('Industry 10')).toBeTruthy()
    expect(screen.getByText('Show less')).toBeTruthy()
    expect(screen.getByText('10 of 10 shown')).toBeTruthy()
  })

  it('hides toggle when <=5 rows', () => {
    render(<TopAmountBreakdown rows={TEN.slice(0, 3)} noun={NOUN_INDUSTRY} />)
    expect(screen.queryByText(/Show 5 more/)).toBeNull()
  })

  it('renders source-URL link + opens via Linking.openURL', () => {
    const spy = vi.spyOn(Linking, 'openURL').mockResolvedValue(true)
    render(<TopAmountBreakdown rows={TEN} noun={NOUN_INDUSTRY} sourceUrl="https://www.opensecrets.org/example" />)
    fireEvent.click(screen.getByText(/full breakdown on OpenSecrets/))
    expect(spy).toHaveBeenCalledWith('https://www.opensecrets.org/example')
  })

  it('renders source-URL link as real <a href> on web (smart-anchor)', () => {
    const { container } = render(
      <TopAmountBreakdown
        rows={TEN}
        noun={NOUN_INDUSTRY}
        sourceUrl="https://www.opensecrets.org/example"
      />,
    )
    const anchor = container.querySelector('a[href="https://www.opensecrets.org/example"]')
    expect(anchor).not.toBeNull()
  })

  it('plain left-click on source-URL anchor calls preventDefault + invokes openURL', () => {
    const spy = vi.spyOn(Linking, 'openURL').mockResolvedValue(true)
    const { container } = render(
      <TopAmountBreakdown
        rows={TEN}
        noun={NOUN_INDUSTRY}
        sourceUrl="https://www.opensecrets.org/example"
      />,
    )
    const anchor = container.querySelector('a[href="https://www.opensecrets.org/example"]')!
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    const notPrevented = anchor.dispatchEvent(event)
    expect(notPrevented).toBe(false)
    expect(spy).toHaveBeenCalledWith('https://www.opensecrets.org/example')
  })

  it('cmd-click on source-URL anchor falls through to browser default', () => {
    const spy = vi.spyOn(Linking, 'openURL').mockResolvedValue(true)
    const { container } = render(
      <TopAmountBreakdown
        rows={TEN}
        noun={NOUN_INDUSTRY}
        sourceUrl="https://www.opensecrets.org/example"
      />,
    )
    const anchor = container.querySelector('a[href="https://www.opensecrets.org/example"]')!
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, metaKey: true })
    const notPrevented = anchor.dispatchEvent(event)
    expect(notPrevented).toBe(true)
    expect(spy).not.toHaveBeenCalled()
  })

  it('renders percent next to dollar value', () => {
    render(<TopAmountBreakdown rows={[{ label: 'A', amount: 500 }, { label: 'B', amount: 500 }]} noun={NOUN_INDUSTRY} />)
    const pcts = screen.getAllByText(/50%/)
    expect(pcts.length).toBe(2)
  })

  it('applies the finance category gradient on web', () => {
    const { container } = render(<TopAmountBreakdown rows={TEN} noun={NOUN_INDUSTRY} />)
    // Outer wrapper is the raw <div> that carries the CSS gradient.
    const outer = container.firstElementChild as HTMLElement | null
    expect(outer).not.toBeNull()
    const bg = outer?.getAttribute('style') ?? ''
    expect(bg).toMatch(/linear-gradient\(180deg, #f4faf6 0%, #fff 100%\)/)
  })

  it('toggle button reports aria-expanded reflecting state', () => {
    const { container } = render(<TopAmountBreakdown rows={TEN} noun={NOUN_INDUSTRY} />)
    const toggle = container.querySelector('[role="button"][aria-expanded]')
    expect(toggle).not.toBeNull()
    expect(toggle?.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(toggle!)
    expect(toggle?.getAttribute('aria-expanded')).toBe('true')
  })

  it('toggle button has accessibilityLabel describing the action target', () => {
    const { container } = render(<TopAmountBreakdown rows={TEN} noun={NOUN_INDUSTRY} />)
    const toggle = container.querySelector('[role="button"]')
    expect(toggle?.getAttribute('aria-label')).toBe('Expand top industries')
    fireEvent.click(toggle!)
    expect(toggle?.getAttribute('aria-label')).toBe('Collapse top industries')
  })
})

describe('TopAmountBreakdown — mode awareness', () => {
  it('renders under both light and dark wrappers without throwing', () => {
    expect(() =>
      render(<TopAmountBreakdown rows={TEN} noun={NOUN_INDUSTRY} />, { wrapper: lightWrapper }),
    ).not.toThrow()
    expect(() =>
      render(<TopAmountBreakdown rows={TEN} noun={NOUN_INDUSTRY} />, { wrapper: darkWrapper }),
    ).not.toThrow()
  })
})

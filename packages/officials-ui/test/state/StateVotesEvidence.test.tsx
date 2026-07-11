import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Linking } from 'react-native'
import { StateVotesEvidence } from '../../src/state/StateVotesEvidence.tsx'

function makeVote(
  id: string,
  position: 'yes' | 'no' | 'not_voting' = 'yes',
  sourceUrl: string | null = `https://x/${id}`,
): never {
  return {
    vote: {
      id,
      question: `Question ${id}`,
      vote_date: '2026-03-15',
      result: 'pass',
      party_vote_split: null,
      source_url: sourceUrl,
    },
    position,
  } as never
}

describe('StateVotesEvidence', () => {
  it('renders empty state', () => {
    const { getByText } = render(<StateVotesEvidence votes={[]} />)
    expect(getByText(/No votes this session/i)).toBeTruthy()
  })

  it('renders question + date + position chip', () => {
    const { getByText } = render(<StateVotesEvidence votes={[makeVote('v1', 'yes')]} />)
    expect(getByText(/Question v1/)).toBeTruthy()
    expect(getByText(/2026-03-15/)).toBeTruthy()
    expect(getByText(/yes/)).toBeTruthy()
  })

  it('maps not_voting position to "missed"', () => {
    const { getByText } = render(<StateVotesEvidence votes={[makeVote('v2', 'not_voting')]} />)
    expect(getByText(/missed/i)).toBeTruthy()
  })

  it('expands beyond initial 5 rows', () => {
    const votes = Array.from({ length: 7 }, (_, i) => makeVote(`v${i}`))
    const { getByText, queryByText } = render(<StateVotesEvidence votes={votes} />)
    expect(queryByText(/Question v6/)).toBeNull()
    fireEvent.click(getByText(/show more \(2 more\)/i))
    expect(getByText(/Question v6/)).toBeTruthy()
  })

  it('does not call openURL for a null source_url row, does for a valid one (B6)', () => {
    const spy = vi.spyOn(Linking, 'openURL').mockResolvedValue(true)
    const { unmount } = render(<StateVotesEvidence votes={[makeVote('nullrow', 'yes', null)]} />)
    fireEvent.click(screen.getByText(/Question nullrow/))
    expect(spy).not.toHaveBeenCalled()
    unmount()
    spy.mockClear()
    render(<StateVotesEvidence votes={[makeVote('validrow', 'yes', 'https://x')]} />)
    fireEvent.click(screen.getByText(/Question validrow/))
    expect(spy).toHaveBeenCalledWith('https://x')
    spy.mockRestore()
  })

  it('show-more toggle exposes aria-expanded that flips on press (C2)', () => {
    const votes = Array.from({ length: 7 }, (_, i) => makeVote(`v${i}`))
    render(<StateVotesEvidence votes={votes} />)
    const toggle = screen.getByText(/show more/i).closest('[aria-expanded]') as HTMLElement
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
  })
})

import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

const lightWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
const darkWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)

describe('StateVotesEvidence — mode awareness', () => {
  it('renders under both light and dark wrappers without throwing', () => {
    const votes = [makeVote('v1', 'yes')]
    expect(() =>
      render(<StateVotesEvidence votes={votes} />, { wrapper: lightWrapper }),
    ).not.toThrow()
    expect(() =>
      render(<StateVotesEvidence votes={votes} />, { wrapper: darkWrapper }),
    ).not.toThrow()
  })
})

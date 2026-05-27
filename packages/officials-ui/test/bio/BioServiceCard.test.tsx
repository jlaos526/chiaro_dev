import { createElement, type ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BioServiceCard } from '../../src/bio/BioServiceCard.tsx'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

const lightWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
const darkWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)

describe('BioServiceCard', () => {
  it('renders role label + role pill + since year', () => {
    render(<BioServiceCard role="Speaker" firstElectedYear={2007} />)
    expect(screen.getByText('CURRENT ROLE')).toBeTruthy()
    expect(screen.getByText('Speaker')).toBeTruthy()
    expect(screen.getByText('· Since 2007')).toBeTruthy()
  })

  it('hides since-year when firstElectedYear is null', () => {
    render(<BioServiceCard role="Senator" firstElectedYear={null} />)
    expect(screen.getByText('Senator')).toBeTruthy()
    expect(screen.queryByText(/Since/)).toBeNull()
  })
})

describe('BioServiceCard — mode awareness', () => {
  it('renders under both light and dark wrappers without throwing', () => {
    expect(() =>
      render(<BioServiceCard role="Speaker" firstElectedYear={2007} />, { wrapper: lightWrapper }),
    ).not.toThrow()
    expect(() =>
      render(<BioServiceCard role="Speaker" firstElectedYear={2007} />, { wrapper: darkWrapper }),
    ).not.toThrow()
  })
})

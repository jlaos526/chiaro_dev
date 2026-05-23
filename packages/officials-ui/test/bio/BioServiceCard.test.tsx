import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BioServiceCard } from '../../src/bio/BioServiceCard.tsx'

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

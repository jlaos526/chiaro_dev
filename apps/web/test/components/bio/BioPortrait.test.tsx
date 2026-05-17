import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BioPortrait } from '@/components/bio/BioPortrait'

describe('BioPortrait', () => {
  it('renders <img> when portraitUrl present', () => {
    render(<BioPortrait fullName="Nancy Pelosi" portraitUrl="https://example.org/np.jpg" size={72} />)
    const img = screen.getByRole('img') as HTMLImageElement
    expect(img.src).toBe('https://example.org/np.jpg')
    expect(img.alt).toBe('Nancy Pelosi portrait')
  })
  it('falls back to initials when portraitUrl missing', () => {
    render(<BioPortrait fullName="Nancy Pelosi" portraitUrl={null} size={72} />)
    expect(screen.getByText('NP')).toBeTruthy()
  })
  it('initials are first letter of first + last word', () => {
    render(<BioPortrait fullName="Adam B. Schiff" portraitUrl={null} size={72} />)
    expect(screen.getByText('AS')).toBeTruthy()
  })
  it('single-word name → single letter', () => {
    render(<BioPortrait fullName="Cher" portraitUrl={null} size={72} />)
    expect(screen.getByText('C')).toBeTruthy()
  })
})

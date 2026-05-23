import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Linking } from 'react-native'
import { BioContactLinks } from '../../src/bio/BioContactLinks.tsx'

describe('BioContactLinks', () => {
  it('returns null when both links absent', () => {
    const { container } = render(<BioContactLinks officialUrl={null} twitterHandle={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the official URL stripped of protocol + trailing slash', () => {
    render(<BioContactLinks officialUrl="https://pelosi.house.gov/" twitterHandle={null} />)
    expect(screen.getByText('pelosi.house.gov')).toBeTruthy()
  })

  it('renders the twitter handle with @ prefix', () => {
    render(<BioContactLinks officialUrl={null} twitterHandle="SpeakerPelosi" />)
    expect(screen.getByText('@SpeakerPelosi')).toBeTruthy()
  })

  it('clicking the official URL invokes Linking.openURL', () => {
    const spy = vi.spyOn(Linking, 'openURL').mockResolvedValue(true)
    render(<BioContactLinks officialUrl="https://pelosi.house.gov" twitterHandle={null} />)
    fireEvent.click(screen.getByText('pelosi.house.gov'))
    expect(spy).toHaveBeenCalledWith('https://pelosi.house.gov')
  })

  it('clicking the twitter handle opens twitter.com/<handle>', () => {
    const spy = vi.spyOn(Linking, 'openURL').mockResolvedValue(true)
    render(<BioContactLinks officialUrl={null} twitterHandle="SpeakerPelosi" />)
    fireEvent.click(screen.getByText('@SpeakerPelosi'))
    expect(spy).toHaveBeenCalledWith('https://twitter.com/SpeakerPelosi')
  })
})

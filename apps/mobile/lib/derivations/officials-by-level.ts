import type { OfficialWithDistrict } from '@chiaro/officials'
import { isFederalLevel, isStateLevel } from '@chiaro/officials'

const STATE_ORDER: Record<string, number> = {
  state_house:       0,
  state_senate:      1,
  state_legislature: 2,
}

const FEDERAL_ORDER: Record<string, number> = {
  federal_house:  0,
  federal_senate: 1,
}

function compareByChamber(orderMap: Record<string, number>) {
  return (a: OfficialWithDistrict, b: OfficialWithDistrict) =>
    (orderMap[a.chamber] ?? 99) - (orderMap[b.chamber] ?? 99)
}

export interface OfficialsByLevel {
  federal: OfficialWithDistrict[]
  state:   OfficialWithDistrict[]
}

export function groupOfficialsByLevel(officials: OfficialWithDistrict[]): OfficialsByLevel {
  const federal: OfficialWithDistrict[] = []
  const state:   OfficialWithDistrict[] = []
  for (const o of officials) {
    if (isFederalLevel(o.chamber)) federal.push(o)
    else if (isStateLevel(o.chamber)) state.push(o)
  }
  federal.sort(compareByChamber(FEDERAL_ORDER))
  state.sort(compareByChamber(STATE_ORDER))
  return { federal, state }
}

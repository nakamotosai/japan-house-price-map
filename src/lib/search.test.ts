import { describe, expect, it } from 'vitest'
import { STATIONS } from '../data/stations'
import { searchStations } from './search'

describe('searchStations', () => {
  it('matches station names in Chinese', () => {
    const results = searchStations('涩谷', STATIONS)
    expect(results[0]?.id).toBe('shibuya')
  })

  it('matches line names and limits result count', () => {
    const results = searchStations('山手线', STATIONS, 3)
    expect(results.length).toBeLessThanOrEqual(3)
    expect(results.some((station) => station.id === 'tokyo')).toBe(true)
  })

  it('returns no result for empty query', () => {
    expect(searchStations('', STATIONS)).toHaveLength(0)
  })
})

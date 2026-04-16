import { describe, expect, it } from 'vitest'
import { pickRuntimeManifest } from './useTokyoData'
import type { RuntimeIndex } from '../types'

const runtimeIndex = {
  generatedAt: '2026-04-16T00:00:00Z',
  stationCount: 0,
  stations: {
    basePath: '/stations.base.json',
    detailsManifestPath: '/stations/details/manifest.json',
  },
  modes: {
    schools: {
      kind: 'point',
      manifests: [
        { path: '/summary.json', minZoom: 9, maxZoom: 11.9 },
        { path: '/overview.json', minZoom: 11.9, maxZoom: 12.8 },
        { path: '/detail.json', minZoom: 12.8, maxZoom: 16.5 },
      ],
    },
    convenience: { kind: 'point', manifests: [] },
    hazard: { kind: 'area', manifests: [] },
    population: { kind: 'area', manifests: [] },
  },
  summary: {},
} as RuntimeIndex

describe('pickRuntimeManifest', () => {
  it('returns the first manifest when zoom is below the first band', () => {
    expect(pickRuntimeManifest(runtimeIndex, 'schools', 8.63)?.path).toBe('/summary.json')
  })

  it('returns the matched manifest inside the configured band', () => {
    expect(pickRuntimeManifest(runtimeIndex, 'schools', 12.1)?.path).toBe('/overview.json')
  })

  it('returns the last manifest above the configured bands', () => {
    expect(pickRuntimeManifest(runtimeIndex, 'schools', 16.6)?.path).toBe('/detail.json')
  })
})

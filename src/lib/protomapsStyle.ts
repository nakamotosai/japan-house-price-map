import { layers, namedFlavor } from '@protomaps/basemaps'
import { Protocol } from 'pmtiles'
import type { StyleSpecification } from 'maplibre-gl'
import type * as MapLibreNS from 'maplibre-gl'

const DEFAULT_PROTOMAPS_PM_TILES_URL =
  'https://data.source.coop/protomaps/openstreetmap/v4.pmtiles'

const PROTOMAPS_GLYPHS_URL =
  'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf'

const PROTOMAPS_ATTRIBUTION =
  '<a href="https://github.com/protomaps/basemaps" target="_blank" rel="noreferrer">Protomaps</a> © <a href="https://osm.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>'

const PROTOMAPS_BASEMAP_SOURCE_ID = 'protomaps'
const PROTOMAPS_PROTOCOL_ID = 'pmtiles'
const PROTOMAPS_THEME_NAME = 'white'
const PROTOMAPS_LABEL_LANGUAGE = 'en'
const PROTOMAPS_SPRITE_URL =
  `https://protomaps.github.io/basemaps-assets/sprites/v4/${PROTOMAPS_THEME_NAME}`

let protomapsProtocolRegistered = false

function getConfiguredPmtilesUrl() {
  const configuredUrl = import.meta.env.VITE_PROTOMAPS_PM_TILES_URL?.trim()
  return configuredUrl || DEFAULT_PROTOMAPS_PM_TILES_URL
}

export function ensurePmtilesProtocol(maplibre: typeof MapLibreNS) {
  if (protomapsProtocolRegistered) {
    return
  }

  const protocol = new Protocol({ metadata: true })
  maplibre.addProtocol(PROTOMAPS_PROTOCOL_ID, protocol.tile)
  protomapsProtocolRegistered = true
}

export function buildTokyoBasemapStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: PROTOMAPS_GLYPHS_URL,
    sprite: PROTOMAPS_SPRITE_URL,
    sources: {
      [PROTOMAPS_BASEMAP_SOURCE_ID]: {
        type: 'vector',
        url: `pmtiles://${getConfiguredPmtilesUrl()}`,
        attribution: PROTOMAPS_ATTRIBUTION,
      },
    },
    layers: layers(PROTOMAPS_BASEMAP_SOURCE_ID, namedFlavor(PROTOMAPS_THEME_NAME), {
      lang: PROTOMAPS_LABEL_LANGUAGE,
    }) as StyleSpecification['layers'],
  }
}

export function getTokyoBasemapSourceUrl() {
  return getConfiguredPmtilesUrl()
}

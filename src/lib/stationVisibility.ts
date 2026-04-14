import type { Bounds, ModeId, StationBase } from '../types'

type ScreenPoint = {
  x: number
  y: number
}

type StationCandidate = {
  station: StationBase
  point: ScreenPoint
}

type StationLayerBudget = {
  dots: number
  names: number
  badges: number
  dotSpacing: number
  nameSpacing: number
  badgeSpacing: number
  majorOnly: boolean
  allowMinorNames: boolean
}

export type StationRenderSelection = {
  anchorIds: Set<string>
  nameIds: Set<string>
  badgeIds: Set<string>
}

export function getVisibilityBandForZoom(zoom: number) {
  if (zoom < 10.8) {
    return 1
  }

  if (zoom < 11.6) {
    return 2
  }

  if (zoom < 12.6) {
    return 3
  }

  return 4
}

function padBounds(bounds: Bounds, degrees = 0.02): Bounds {
  return {
    west: bounds.west - degrees,
    south: bounds.south - degrees,
    east: bounds.east + degrees,
    north: bounds.north + degrees,
  }
}

function isInsideBounds(station: StationBase, bounds: Bounds) {
  return (
    station.lng >= bounds.west
    && station.lng <= bounds.east
    && station.lat >= bounds.south
    && station.lat <= bounds.north
  )
}

function squaredDistance(left: ScreenPoint, right: ScreenPoint) {
  const dx = left.x - right.x
  const dy = left.y - right.y
  return dx * dx + dy * dy
}

function getModeCoverageBoost(station: StationBase, mode: ModeId) {
  if (mode === 'price' && station.metrics.coverage.price) {
    return 360_000 + station.metrics.medianPriceMJPY * 320
  }

  if (mode === 'land' && station.metrics.coverage.land) {
    return 320_000 + station.metrics.landValueManPerSqm * 240
  }

  if (mode === 'heat' && station.metrics.coverage.ridership) {
    return 260_000 + station.metrics.heatScore * 4_000
  }

  if (mode === 'schools' && station.metrics.coverage.schools) {
    return 220_000 + station.metrics.schoolsNearby * 2_500
  }

  if (mode === 'convenience' && station.metrics.coverage.convenience) {
    return 220_000 + station.metrics.convenienceScore * 3_000
  }

  if (mode === 'hazard' && station.metrics.coverage.hazard) {
    return 180_000 + (station.metrics.hazardMaxDepthRank ?? 0) * 28_000
  }

  if (mode === 'population' && station.metrics.coverage.population) {
    return 180_000
  }

  return 0
}

export function getStationPriorityScore(station: StationBase, mode: ModeId) {
  let score = 0

  if (station.labelTier === 'major') {
    score += 850_000
  }

  score += Math.min(station.metrics.ridershipDaily, 3_000_000) / 12
  score += station.metrics.transferLines * 36_000
  score += getModeCoverageBoost(station, mode)

  return score
}

function resolveBudget(mode: ModeId, zoom: number): StationLayerBudget {
  const band = getVisibilityBandForZoom(zoom)

  if (mode === 'price') {
    if (band === 1) {
      return {
        dots: 24,
        names: 10,
        badges: 9,
        dotSpacing: 24,
        nameSpacing: 96,
        badgeSpacing: 104,
        majorOnly: false,
        allowMinorNames: false,
      }
    }

    if (band === 2) {
      return {
        dots: 42,
        names: 14,
        badges: 10,
        dotSpacing: 20,
        nameSpacing: 82,
        badgeSpacing: 94,
        majorOnly: false,
        allowMinorNames: false,
      }
    }

    if (band === 3) {
      return {
        dots: 88,
        names: 20,
        badges: 14,
        dotSpacing: 17,
        nameSpacing: 70,
        badgeSpacing: 84,
        majorOnly: false,
        allowMinorNames: false,
      }
    }

    return {
      dots: Number.POSITIVE_INFINITY,
      names: 36,
      badges: 18,
      dotSpacing: 14,
      nameSpacing: 58,
      badgeSpacing: 72,
      majorOnly: false,
      allowMinorNames: zoom >= 12.9,
    }
  }

  if (mode === 'land' || mode === 'heat') {
    if (band === 1) {
      return {
        dots: 22,
        names: 10,
        badges: 0,
        dotSpacing: 24,
        nameSpacing: 90,
        badgeSpacing: 0,
        majorOnly: false,
        allowMinorNames: false,
      }
    }

    if (band === 2) {
      return {
        dots: 38,
        names: 14,
        badges: 0,
        dotSpacing: 20,
        nameSpacing: 78,
        badgeSpacing: 0,
        majorOnly: false,
        allowMinorNames: false,
      }
    }

    if (band === 3) {
      return {
        dots: 80,
        names: 22,
        badges: 0,
        dotSpacing: 17,
        nameSpacing: 68,
        badgeSpacing: 0,
        majorOnly: false,
        allowMinorNames: false,
      }
    }

    return {
      dots: Number.POSITIVE_INFINITY,
      names: 38,
      badges: 0,
      dotSpacing: 14,
      nameSpacing: 54,
      badgeSpacing: 0,
      majorOnly: false,
      allowMinorNames: zoom >= 12.8,
    }
  }

  if (mode === 'hazard' || mode === 'population') {
    if (band === 1) {
      return {
        dots: 16,
        names: 8,
        badges: 0,
        dotSpacing: 28,
        nameSpacing: 94,
        badgeSpacing: 0,
        majorOnly: true,
        allowMinorNames: false,
      }
    }

    if (band === 2) {
      return {
        dots: 26,
        names: 10,
        badges: 0,
        dotSpacing: 22,
        nameSpacing: 82,
        badgeSpacing: 0,
        majorOnly: true,
        allowMinorNames: false,
      }
    }

    if (band === 3) {
      return {
        dots: 60,
        names: 16,
        badges: 0,
        dotSpacing: 18,
        nameSpacing: 72,
        badgeSpacing: 0,
        majorOnly: false,
        allowMinorNames: false,
      }
    }

    return {
      dots: Number.POSITIVE_INFINITY,
      names: 28,
      badges: 0,
      dotSpacing: 15,
      nameSpacing: 60,
      badgeSpacing: 0,
      majorOnly: false,
      allowMinorNames: zoom >= 12.9,
    }
  }

  if (band === 1) {
    return {
      dots: 18,
      names: 8,
      badges: 0,
      dotSpacing: 26,
      nameSpacing: 92,
      badgeSpacing: 0,
      majorOnly: true,
      allowMinorNames: false,
    }
  }

  if (band === 2) {
    return {
      dots: 28,
      names: 10,
      badges: 0,
      dotSpacing: 20,
      nameSpacing: 78,
      badgeSpacing: 0,
      majorOnly: false,
      allowMinorNames: false,
    }
  }

  if (band === 3) {
    return {
      dots: 70,
      names: 16,
      badges: 0,
      dotSpacing: 17,
      nameSpacing: 66,
      badgeSpacing: 0,
      majorOnly: false,
      allowMinorNames: false,
    }
  }

  return {
    dots: Number.POSITIVE_INFINITY,
    names: 28,
    badges: 0,
    dotSpacing: 14,
    nameSpacing: 54,
    badgeSpacing: 0,
    majorOnly: false,
    allowMinorNames: zoom >= 12.8,
  }
}

function canShowName(station: StationBase, budget: StationLayerBudget, selectedStationId: string | null) {
  if (station.id === selectedStationId) {
    return true
  }

  if (budget.allowMinorNames) {
    return true
  }

  return station.labelTier === 'major'
}

function canShowBadge(station: StationBase, mode: ModeId) {
  return mode === 'price' && station.metrics.coverage.price
}

function filterCandidateStations(props: {
  bounds: Bounds
  budget: StationLayerBudget
  selectedStationId: string | null
  stations: StationBase[]
}) {
  const { bounds, budget, selectedStationId, stations } = props
  const paddedBounds = padBounds(bounds)

  return stations.filter((station) => {
    if (station.id === selectedStationId) {
      return true
    }

    if (!isInsideBounds(station, paddedBounds)) {
      return false
    }

    if (budget.majorOnly && station.labelTier !== 'major') {
      return false
    }

    return true
  })
}

function selectWithSpacing(
  candidates: StationCandidate[],
  limit: number,
  minDistance: number,
  selectedStationId: string | null,
) {
  const chosenIds = new Set<string>()
  const chosenPoints: ScreenPoint[] = []
  const minDistanceSquared = minDistance * minDistance

  const selectedCandidate = selectedStationId
    ? candidates.find((candidate) => candidate.station.id === selectedStationId)
    : null

  if (selectedCandidate) {
    chosenIds.add(selectedCandidate.station.id)
    chosenPoints.push(selectedCandidate.point)
  }

  for (const candidate of candidates) {
    if (chosenIds.has(candidate.station.id)) {
      continue
    }

    if (chosenIds.size >= limit) {
      break
    }

    const overlaps = chosenPoints.some(
      (point) => squaredDistance(point, candidate.point) < minDistanceSquared,
    )

    if (overlaps) {
      continue
    }

    chosenIds.add(candidate.station.id)
    chosenPoints.push(candidate.point)
  }

  return chosenIds
}

export function selectStationRenderSelection(props: {
  bounds: Bounds
  mode: ModeId
  project: (station: StationBase) => ScreenPoint
  selectedStationId: string | null
  stations: StationBase[]
  zoom: number
}): StationRenderSelection {
  const { bounds, mode, project, selectedStationId, stations, zoom } = props
  const budget = resolveBudget(mode, zoom)

  const rankedCandidates = filterCandidateStations({
    bounds,
    budget,
    selectedStationId,
    stations,
  })
    .map((station) => ({
      station,
      point: project(station),
    }))
    .sort((left, right) => {
      return (
        getStationPriorityScore(right.station, mode)
        - getStationPriorityScore(left.station, mode)
        || left.station.name.localeCompare(right.station.name)
      )
    })

  const anchorCandidates = budget.majorOnly
    ? rankedCandidates.filter(
        (candidate) =>
          candidate.station.id === selectedStationId
          || candidate.station.labelTier === 'major',
      )
    : rankedCandidates

  const anchorIds = selectWithSpacing(
    anchorCandidates,
    budget.dots,
    budget.dotSpacing,
    selectedStationId,
  )

  const nameIds = selectWithSpacing(
    anchorCandidates.filter(
      (candidate) =>
        anchorIds.has(candidate.station.id)
        && canShowName(candidate.station, budget, selectedStationId),
    ),
    budget.names,
    budget.nameSpacing,
    selectedStationId,
  )

  const badgeIds = budget.badges
    ? selectWithSpacing(
        anchorCandidates.filter(
          (candidate) =>
            anchorIds.has(candidate.station.id)
            && canShowBadge(candidate.station, mode),
        ),
        budget.badges,
        budget.badgeSpacing,
        selectedStationId,
      )
    : new Set<string>()

  if (selectedStationId) {
    anchorIds.add(selectedStationId)

    const selectedStation = stations.find((station) => station.id === selectedStationId)
    if (selectedStation && canShowName(selectedStation, budget, selectedStationId)) {
      nameIds.add(selectedStationId)
    }
    if (selectedStation && canShowBadge(selectedStation, mode)) {
      badgeIds.add(selectedStationId)
    }
  }

  return { anchorIds, nameIds, badgeIds }
}

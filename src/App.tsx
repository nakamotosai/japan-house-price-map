import { lazy, Suspense, startTransition, useDeferredValue, useEffect, useState } from 'react'
import { LeftRail } from './components/LeftRail'
import { LegendCard } from './components/LegendCard'
import { MapMenu } from './components/MapMenu'
import { ModeChips } from './components/ModeChips'
import { StationPanel } from './components/StationPanel'
import { TokyoMap } from './components/TokyoMap'
import { TopSearchBar } from './components/TopSearchBar'
import { MODES } from './data/modes'
import { TOKYO_SITE_RELEASE } from './data/siteMeta'
import { useTokyoData } from './hooks/useTokyoData'
import { formatShortDateLabel } from './lib/format'
import { searchStations } from './lib/search'
import type { MapViewport, ModeId, TokyoOverlayData } from './types'

const EMPTY_OVERLAYS: TokyoOverlayData = {
  schools: [],
  convenience: [],
  hazards: [],
  population: [],
}

const IntroOverlay = lazy(() =>
  import('./components/IntroOverlay').then((module) => ({ default: module.IntroOverlay })),
)

function getInitialCompactLayout() {
  if (typeof window === 'undefined') {
    return false
  }

  return window.matchMedia('(max-width: 820px)').matches
}

function getInitialMode() {
  if (typeof window === 'undefined') {
    return 'price' as ModeId
  }

  const mode = new URL(window.location.href).searchParams.get('mode')
  return mode && mode in MODES ? (mode as ModeId) : 'price'
}

function getInitialStationId() {
  if (typeof window === 'undefined') {
    return null
  }

  return new URL(window.location.href).searchParams.get('station')
}

function syncUrlState(activeMode: ModeId, selectedStationId: string | null) {
  if (typeof window === 'undefined') {
    return
  }

  const url = new URL(window.location.href)

  if (activeMode === 'price') {
    url.searchParams.delete('mode')
  } else {
    url.searchParams.set('mode', activeMode)
  }

  if (selectedStationId) {
    url.searchParams.set('station', selectedStationId)
  } else {
    url.searchParams.delete('station')
  }

  window.history.replaceState({}, '', url)
}

export default function App() {
  const [isCompactLayout, setIsCompactLayout] = useState(getInitialCompactLayout)
  const [activeMode, setActiveMode] = useState<ModeId>(getInitialMode)
  const [selectedStationId, setSelectedStationId] = useState<string | null>(getInitialStationId)
  const [viewport, setViewport] = useState<MapViewport | null>(null)
  const [query, setQuery] = useState('')
  const [resetToken, setResetToken] = useState(0)
  const [showIntro, setShowIntro] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [legendCollapsed, setLegendCollapsed] = useState(getInitialCompactLayout)
  const dataState = useTokyoData({ activeMode, viewport, selectedStationId })

  const stationBases = dataState.stationBases
  const effectiveSelectedStationId =
    selectedStationId && stationBases.some((station) => station.id === selectedStationId)
      ? selectedStationId
      : null
  const metadata = dataState.metadata
  const overlays = dataState.status === 'ready' ? dataState.overlays : EMPTY_OVERLAYS
  const deferredQuery = useDeferredValue(query)
  const searchResults = searchStations(deferredQuery, stationBases)
  const selectedStationBase =
    stationBases.find((station) => station.id === effectiveSelectedStationId) ?? null
  const selectedStationDetail =
    dataState.status === 'ready' ? dataState.selectedStationDetail : null
  const updatedLabel = formatShortDateLabel(
    dataState.runtimeGeneratedAt ?? metadata?.generatedAt,
  )
  const stationCount = metadata?.stationCount ?? stationBases.length

  useEffect(() => {
    document.documentElement.dataset.appMounted = 'true'

    return () => {
      delete document.documentElement.dataset.appMounted
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const media = window.matchMedia('(max-width: 820px)')
    const handleChange = (event: MediaQueryListEvent) => {
      setIsCompactLayout(event.matches)
      if (event.matches) {
        setLegendCollapsed(true)
      }
    }

    media.addEventListener('change', handleChange)

    return () => {
      media.removeEventListener('change', handleChange)
    }
  }, [])

  useEffect(() => {
    if (isCompactLayout) {
      return undefined
    }

    const timer = window.setTimeout(() => {
      setLegendCollapsed(true)
    }, 3800)

    return () => {
      window.clearTimeout(timer)
    }
  }, [activeMode, isCompactLayout])

  useEffect(() => {
    syncUrlState(activeMode, effectiveSelectedStationId)
  }, [activeMode, effectiveSelectedStationId])

  function handleSelectStation(stationId: string | null) {
    startTransition(() => {
      setSelectedStationId(stationId)
    })
    setQuery('')
    setShowMenu(false)
  }

  function handleResetView() {
    setSelectedStationId(null)
    setQuery('')
    setResetToken((value) => value + 1)
    setShowMenu(false)
  }

  function handleChangeMode(mode: ModeId) {
    setActiveMode(mode)
    setLegendCollapsed(isCompactLayout)
    setShowMenu(false)
  }

  function handleOpenIntro() {
    setShowMenu(false)
    setShowIntro(true)
  }

  function handleToggleLegend() {
    setLegendCollapsed((value) => !value)
  }

  return (
    <div className="app-shell">
      <TokyoMap
        activeMode={activeMode}
        convenience={overlays.convenience}
        hazards={overlays.hazards}
        onSelectStation={handleSelectStation}
        onViewportChange={setViewport}
        population={overlays.population}
        resetToken={resetToken}
        schools={overlays.schools}
        selectedStationId={selectedStationId}
        stations={stationBases}
      />

      <LeftRail
        activeModeLabel={MODES[activeMode].shortLabel}
        menuOpen={showMenu}
        onOpenIntro={handleOpenIntro}
        onResetView={handleResetView}
        onToggleMenu={() => setShowMenu((value) => !value)}
        releaseLabel={TOKYO_SITE_RELEASE.shortVersionLabel}
        stationCount={stationCount}
        updatedLabel={updatedLabel}
      />

      <MapMenu
        activeMode={activeMode}
        collapsedLegend={legendCollapsed}
        modes={MODES}
        onChangeMode={handleChangeMode}
        onClose={() => setShowMenu(false)}
        onOpenIntro={handleOpenIntro}
        onResetView={handleResetView}
        onToggleLegend={handleToggleLegend}
        open={showMenu}
      />

      <TopSearchBar
        onChangeQuery={setQuery}
        onPickStation={handleSelectStation}
        query={query}
        results={searchResults}
      />

      <ModeChips
        activeMode={activeMode}
        compact={isCompactLayout}
        modes={MODES}
        onChangeMode={handleChangeMode}
      />

      <StationPanel
        activeMode={activeMode}
        convenience={overlays.convenience}
        detailErrorMessage={
          dataState.status === 'ready' ? dataState.stationDetailErrorMessage : undefined
        }
        detailStatus={dataState.stationDetailStatus}
        errorMessage={dataState.status === 'error' ? dataState.message : undefined}
        hazards={overlays.hazards}
        modes={MODES}
        onClose={() => setSelectedStationId(null)}
        onOpenIntro={handleOpenIntro}
        overlayInfo={dataState.overlayInfo}
        overlayErrorMessage={
          dataState.status === 'ready' ? dataState.overlayErrorMessage : undefined
        }
        overlayStatus={dataState.overlayStatus}
        population={overlays.population}
        schools={overlays.schools}
        selectedStation={selectedStationDetail}
        selectedStationBase={selectedStationBase}
        status={dataState.status}
      />

      <LegendCard
        activeMode={MODES[activeMode]}
        collapsed={legendCollapsed}
        overlayInfo={dataState.overlayInfo}
        overlayStatus={dataState.overlayStatus}
        onCollapse={() => setLegendCollapsed(true)}
        onExpand={() => setLegendCollapsed(false)}
      />

      <Suspense fallback={null}>
        <IntroOverlay
          metadata={metadata}
          open={showIntro}
          runtimeGeneratedAt={dataState.runtimeGeneratedAt}
          onClose={() => setShowIntro(false)}
        />
      </Suspense>
    </div>
  )
}

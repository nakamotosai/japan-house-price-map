import { startTransition, useDeferredValue, useEffect, useState } from 'react'
import { IntroOverlay } from './components/IntroOverlay'
import { LeftRail } from './components/LeftRail'
import { LegendCard } from './components/LegendCard'
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

export default function App() {
  const [activeMode, setActiveMode] = useState<ModeId>('price')
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null)
  const [viewport, setViewport] = useState<MapViewport | null>(null)
  const [query, setQuery] = useState('')
  const [resetToken, setResetToken] = useState(0)
  const [showIntro, setShowIntro] = useState(false)
  const [legendCollapsed, setLegendCollapsed] = useState(false)
  const dataState = useTokyoData({ activeMode, viewport, selectedStationId })

  const stationBases = dataState.stationBases
  const metadata = dataState.metadata
  const overlays = dataState.status === 'ready' ? dataState.overlays : EMPTY_OVERLAYS
  const deferredQuery = useDeferredValue(query)
  const searchResults = searchStations(deferredQuery, stationBases)
  const selectedStationBase =
    stationBases.find((station) => station.id === selectedStationId) ?? null
  const selectedStationDetail =
    dataState.status === 'ready' ? dataState.selectedStationDetail : null
  const updatedLabel = formatShortDateLabel(
    dataState.runtimeGeneratedAt ?? metadata?.generatedAt,
  )

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLegendCollapsed(true)
    }, 3800)

    return () => {
      window.clearTimeout(timer)
    }
  }, [activeMode])

  function handleSelectStation(stationId: string | null) {
    startTransition(() => {
      setSelectedStationId(stationId)
    })
    setQuery('')
  }

  function handleResetView() {
    setSelectedStationId(null)
    setQuery('')
    setResetToken((value) => value + 1)
  }

  function handleChangeMode(mode: ModeId) {
    setActiveMode(mode)
    setLegendCollapsed(false)
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
        onOpenIntro={() => setShowIntro(true)}
        onResetView={handleResetView}
        releaseLabel={TOKYO_SITE_RELEASE.shortVersionLabel}
        stationCount={stationBases.length}
        updatedLabel={updatedLabel}
      />

      <TopSearchBar
        onChangeQuery={setQuery}
        onPickStation={handleSelectStation}
        query={query}
        results={searchResults}
      />

      <ModeChips activeMode={activeMode} modes={MODES} onChangeMode={handleChangeMode} />

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
        onOpenIntro={() => setShowIntro(true)}
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

      <IntroOverlay
        metadata={metadata}
        open={showIntro}
        runtimeGeneratedAt={dataState.runtimeGeneratedAt}
        onClose={() => setShowIntro(false)}
      />
    </div>
  )
}

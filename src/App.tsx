import { startTransition, useDeferredValue, useEffect, useState } from 'react'
import { IntroOverlay } from './components/IntroOverlay'
import { LeftRail } from './components/LeftRail'
import { LegendCard } from './components/LegendCard'
import { ModeChips } from './components/ModeChips'
import { StationPanel } from './components/StationPanel'
import { TokyoMap } from './components/TokyoMap'
import { TopSearchBar } from './components/TopSearchBar'
import { useTokyoData } from './hooks/useTokyoData'
import { MODES } from './data/modes'
import { searchStations } from './lib/search'
import type { ModeId } from './types'

export default function App() {
  const [activeMode, setActiveMode] = useState<ModeId>('price')
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [resetToken, setResetToken] = useState(0)
  const [showIntro, setShowIntro] = useState(false)
  const [legendCollapsed, setLegendCollapsed] = useState(false)
  const dataState = useTokyoData()

  const stations = dataState.status === 'ready' ? dataState.data.stations : []
  const schools = dataState.status === 'ready' ? dataState.data.schools : []
  const convenience = dataState.status === 'ready' ? dataState.data.convenience : []
  const hazards = dataState.status === 'ready' ? dataState.data.hazards : []
  const population = dataState.status === 'ready' ? dataState.data.population : []

  const deferredQuery = useDeferredValue(query)
  const searchResults = searchStations(deferredQuery, stations)
  const selectedStation =
    stations.find((station) => station.id === selectedStationId) ?? null

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

    if (stationId === null) {
      setQuery('')
    } else {
      setQuery('')
    }
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
        convenience={convenience}
        hazards={hazards}
        onSelectStation={handleSelectStation}
        population={population}
        resetToken={resetToken}
        schools={schools}
        selectedStationId={selectedStationId}
        stations={stations}
      />

      <LeftRail
        activeModeLabel={MODES[activeMode].shortLabel}
        onOpenIntro={() => setShowIntro(true)}
        onResetView={handleResetView}
        stationCount={stations.length}
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
        convenience={convenience}
        errorMessage={dataState.status === 'error' ? dataState.message : undefined}
        hazards={hazards}
        modes={MODES}
        onClose={() => setSelectedStationId(null)}
        onOpenIntro={() => setShowIntro(true)}
        population={population}
        schools={schools}
        selectedStation={selectedStation}
        status={dataState.status}
      />

      <LegendCard
        activeMode={MODES[activeMode]}
        collapsed={legendCollapsed}
        onCollapse={() => setLegendCollapsed(true)}
        onExpand={() => setLegendCollapsed(false)}
      />

      <IntroOverlay open={showIntro} onClose={() => setShowIntro(false)} />
    </div>
  )
}

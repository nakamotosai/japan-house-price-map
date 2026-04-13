import { startTransition, useDeferredValue, useState } from 'react'
import { IntroOverlay } from './components/IntroOverlay'
import { LeftRail } from './components/LeftRail'
import { LegendCard } from './components/LegendCard'
import { ModeChips } from './components/ModeChips'
import { StationPanel } from './components/StationPanel'
import { TokyoMap } from './components/TokyoMap'
import { TopSearchBar } from './components/TopSearchBar'
import { useTokyoSeedData } from './hooks/useTokyoSeedData'
import { MODES } from './data/modes'
import { searchStations } from './lib/search'
import type { ModeId } from './types'

export default function App() {
  const [activeMode, setActiveMode] = useState<ModeId>('price')
  const [selectedStationId, setSelectedStationId] = useState<string | null>('tokyo')
  const [query, setQuery] = useState('')
  const [resetToken, setResetToken] = useState(0)
  const [showIntro, setShowIntro] = useState(true)
  const dataState = useTokyoSeedData()

  const stations = dataState.status === 'ready' ? dataState.data.stations : []
  const schools = dataState.status === 'ready' ? dataState.data.schools : []
  const hazards = dataState.status === 'ready' ? dataState.data.hazards : []

  const deferredQuery = useDeferredValue(query)
  const searchResults = searchStations(deferredQuery, stations)
  const selectedStation =
    stations.find((station) => station.id === selectedStationId) ?? null

  function handleSelectStation(stationId: string) {
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

  return (
    <div className="app-shell">
      <TokyoMap
        activeMode={activeMode}
        hazards={hazards}
        onSelectStation={handleSelectStation}
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

      <ModeChips activeMode={activeMode} modes={MODES} onChangeMode={setActiveMode} />

      <StationPanel
        activeMode={activeMode}
        errorMessage={dataState.status === 'error' ? dataState.message : undefined}
        hazards={hazards}
        modes={MODES}
        onOpenIntro={() => setShowIntro(true)}
        schools={schools}
        selectedStation={selectedStation}
        status={dataState.status}
      />

      <LegendCard activeMode={MODES[activeMode]} />

      <IntroOverlay open={showIntro} onClose={() => setShowIntro(false)} />
    </div>
  )
}

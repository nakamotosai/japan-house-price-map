import { startTransition, useDeferredValue, useState } from 'react'
import { IntroOverlay } from './components/IntroOverlay'
import { LeftRail } from './components/LeftRail'
import { LegendCard } from './components/LegendCard'
import { ModeChips } from './components/ModeChips'
import { StationPanel } from './components/StationPanel'
import { TokyoMap } from './components/TokyoMap'
import { TopSearchBar } from './components/TopSearchBar'
import { MODES } from './data/modes'
import { STATIONS } from './data/stations'
import { searchStations } from './lib/search'
import type { ModeId } from './types'

export default function App() {
  const [activeMode, setActiveMode] = useState<ModeId>('price')
  const [selectedStationId, setSelectedStationId] = useState<string | null>('tokyo')
  const [query, setQuery] = useState('')
  const [resetToken, setResetToken] = useState(0)
  const [showIntro, setShowIntro] = useState(true)

  const deferredQuery = useDeferredValue(query)
  const searchResults = searchStations(deferredQuery, STATIONS)
  const selectedStation =
    STATIONS.find((station) => station.id === selectedStationId) ?? null

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
        onSelectStation={handleSelectStation}
        resetToken={resetToken}
        selectedStationId={selectedStationId}
        stations={STATIONS}
      />

      <LeftRail
        activeModeLabel={MODES[activeMode].shortLabel}
        onOpenIntro={() => setShowIntro(true)}
        onResetView={handleResetView}
        stationCount={STATIONS.length}
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
        modes={MODES}
        onOpenIntro={() => setShowIntro(true)}
        selectedStation={selectedStation}
      />

      <LegendCard activeMode={MODES[activeMode]} />

      <IntroOverlay open={showIntro} onClose={() => setShowIntro(false)} />
    </div>
  )
}

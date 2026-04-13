import type { ModeDefinition, ModeId } from '../types'

type ModeChipsProps = {
  activeMode: ModeId
  modes: Record<ModeId, ModeDefinition>
  onChangeMode: (mode: ModeId) => void
}

export function ModeChips(props: ModeChipsProps) {
  const { activeMode, modes, onChangeMode } = props

  return (
    <div className="mode-chips">
      {Object.values(modes).map((mode) => (
        <button
          className={`mode-chip ${mode.id === activeMode ? 'mode-chip--active' : ''}`}
          key={mode.id}
          onClick={() => onChangeMode(mode.id)}
          type="button"
        >
          {mode.label}
        </button>
      ))}
    </div>
  )
}

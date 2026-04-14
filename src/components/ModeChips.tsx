import type { ModeDefinition, ModeId } from '../types'

type ModeChipsProps = {
  activeMode: ModeId
  compact: boolean
  modes: Record<ModeId, ModeDefinition>
  onChangeMode: (mode: ModeId) => void
}

export function ModeChips(props: ModeChipsProps) {
  const { activeMode, compact, modes, onChangeMode } = props

  return (
    <div className={`mode-chips ${compact ? 'mode-chips--compact' : ''}`}>
      {Object.values(modes).map((mode) => (
        <button
          aria-pressed={mode.id === activeMode}
          className={`mode-chip ${mode.id === activeMode ? 'mode-chip--active' : ''}`}
          data-mode-id={mode.id}
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

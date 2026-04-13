type LeftRailProps = {
  stationCount: number
  activeModeLabel: string
  onResetView: () => void
  onOpenIntro: () => void
}

export function LeftRail(props: LeftRailProps) {
  const { stationCount, activeModeLabel, onResetView, onOpenIntro } = props

  return (
    <aside className="left-rail">
      <button className="left-rail__button left-rail__button--menu" type="button">
        三
      </button>

      <button className="left-rail__button" onClick={onResetView} type="button">
        <span className="left-rail__value">{stationCount}</span>
        <span className="left-rail__label">站点</span>
      </button>

      <div className="left-rail__button left-rail__button--status">
        <span className="left-rail__value">{activeModeLabel}</span>
        <span className="left-rail__label">模式</span>
      </div>

      <button className="left-rail__button" onClick={onOpenIntro} type="button">
        <span className="left-rail__value">i</span>
        <span className="left-rail__label">说明</span>
      </button>
    </aside>
  )
}

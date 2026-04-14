type LeftRailProps = {
  stationCount: number
  activeModeLabel: string
  releaseLabel: string
  updatedLabel: string
  menuOpen: boolean
  onToggleMenu: () => void
  onResetView: () => void
  onOpenIntro: () => void
}

export function LeftRail(props: LeftRailProps) {
  const {
    stationCount,
    activeModeLabel,
    menuOpen,
    releaseLabel,
    updatedLabel,
    onToggleMenu,
    onResetView,
    onOpenIntro,
  } = props

  return (
    <aside className="left-rail">
      <button
        aria-controls="map-menu"
        aria-expanded={menuOpen}
        aria-label="打开地图菜单"
        className="left-rail__button left-rail__button--menu"
        onClick={onToggleMenu}
        type="button"
      >
        <span className="left-rail__value">≡</span>
        <span className="left-rail__label">菜单</span>
      </button>

      <button aria-label="重置东京视角" className="left-rail__button" onClick={onResetView} type="button">
        <span className="left-rail__value">{stationCount}</span>
        <span className="left-rail__label">站点</span>
      </button>

      <div className="left-rail__button left-rail__button--status">
        <span className="left-rail__value">{activeModeLabel}</span>
        <span className="left-rail__label">模式</span>
      </div>

      <button aria-label="打开数据说明" className="left-rail__button" onClick={onOpenIntro} type="button">
        <span className="left-rail__value">i</span>
        <span className="left-rail__label">说明</span>
      </button>

      <div className="left-rail__spacer" />

      <button className="left-rail__button left-rail__button--release" onClick={onOpenIntro} type="button">
        <span className="left-rail__value">{releaseLabel}</span>
        <span className="left-rail__label">{updatedLabel}</span>
      </button>
    </aside>
  )
}

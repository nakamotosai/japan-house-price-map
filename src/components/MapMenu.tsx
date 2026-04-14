import type { ModeDefinition, ModeId } from '../types'

type MapMenuProps = {
  activeMode: ModeId
  collapsedLegend: boolean
  modes: Record<ModeId, ModeDefinition>
  open: boolean
  onChangeMode: (mode: ModeId) => void
  onClose: () => void
  onOpenIntro: () => void
  onResetView: () => void
  onToggleLegend: () => void
}

export function MapMenu(props: MapMenuProps) {
  const {
    activeMode,
    collapsedLegend,
    modes,
    open,
    onChangeMode,
    onClose,
    onOpenIntro,
    onResetView,
    onToggleLegend,
  } = props

  if (!open) {
    return null
  }

  return (
    <>
      <button
        aria-label="关闭地图菜单"
        className="map-menu__backdrop"
        onClick={onClose}
        type="button"
      />

      <section className="map-menu" id="map-menu" aria-label="地图菜单">
        <div className="map-menu__header">
          <div>
            <strong>地图菜单</strong>
            <span>高频操作和模式切换都收在这里。</span>
          </div>
          <button className="map-menu__close" onClick={onClose} type="button">
            收起
          </button>
        </div>

        <div className="map-menu__actions">
          <button className="map-menu__action" onClick={onResetView} type="button">
            重置东京视角
          </button>
          <button className="map-menu__action" onClick={onOpenIntro} type="button">
            打开数据说明
          </button>
          <button className="map-menu__action" onClick={onToggleLegend} type="button">
            {collapsedLegend ? '展开图例' : '收起图例'}
          </button>
        </div>

        <div className="map-menu__modes">
          <span className="map-menu__label">切换模式</span>
          <div className="map-menu__mode-grid">
            {Object.values(modes).map((mode) => (
              <button
                aria-pressed={mode.id === activeMode}
                className={`map-menu__mode ${mode.id === activeMode ? 'map-menu__mode--active' : ''}`}
                key={mode.id}
                onClick={() => onChangeMode(mode.id)}
                type="button"
              >
                <strong>{mode.label}</strong>
                <span>{mode.description}</span>
              </button>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}

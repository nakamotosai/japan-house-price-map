import type { ModeDefinition } from '../types'

type LegendCardProps = {
  activeMode: ModeDefinition
  collapsed: boolean
  onCollapse: () => void
  onExpand: () => void
}

export function LegendCard(props: LegendCardProps) {
  const { activeMode, collapsed, onCollapse, onExpand } = props

  if (collapsed) {
    return (
      <button className="legend-card legend-card--collapsed" onClick={onExpand} type="button">
        <span className="legend-card__mini-dot" style={{ backgroundColor: activeMode.legend[0]?.color }} />
        <strong>{activeMode.label}</strong>
        <span>展开图例</span>
      </button>
    )
  }

  return (
    <section className="legend-card">
      <div className="legend-card__header">
        <strong>{activeMode.label}</strong>
        <div className="legend-card__header-actions">
          <span>{activeMode.category === 'station' ? '站点指标模式' : '坐标覆盖模式'}</span>
          <button className="legend-card__collapse" onClick={onCollapse} type="button">
            收起
          </button>
        </div>
      </div>

      <p className="legend-card__description">{activeMode.description}</p>

      <div className="legend-card__items">
        {activeMode.legend.map((item) => (
          <div className="legend-card__item" key={`${activeMode.id}-${item.label}`}>
            <span
              className="legend-card__swatch"
              style={{ backgroundColor: item.color }}
            />
            <div>
              <strong>{item.label}</strong>
              {item.note ? <span>{item.note}</span> : null}
            </div>
          </div>
        ))}
      </div>

      <div className="legend-card__footnote">首版使用种子数据验证地图底座与切换体验。</div>
    </section>
  )
}

import type { ModeDefinition } from '../types'

type LegendCardProps = {
  activeMode: ModeDefinition
}

export function LegendCard(props: LegendCardProps) {
  const { activeMode } = props

  return (
    <section className="legend-card">
      <div className="legend-card__header">
        <strong>{activeMode.label}</strong>
        <span>{activeMode.category === 'station' ? '站点指标模式' : '坐标覆盖模式'}</span>
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

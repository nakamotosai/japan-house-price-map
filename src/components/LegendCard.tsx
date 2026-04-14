import { TOKYO_MODE_METHODS } from '../data/siteMeta'
import type { AsyncStatus, ModeDefinition, OverlayRuntimeInfo } from '../types'

type LegendCardProps = {
  activeMode: ModeDefinition
  collapsed: boolean
  overlayInfo: OverlayRuntimeInfo | null
  overlayStatus: AsyncStatus
  onCollapse: () => void
  onExpand: () => void
}

export function LegendCard(props: LegendCardProps) {
  const {
    activeMode,
    collapsed,
    overlayInfo,
    overlayStatus,
    onCollapse,
    onExpand,
  } = props
  const categoryLabel =
    activeMode.category === 'station'
      ? '站点锚点模式'
      : activeMode.category === 'point'
        ? '设施点模式'
        : '区域覆盖模式'
  const layerLabel =
    overlayInfo?.level === 'summary'
      ? '摘要层'
      : overlayInfo?.level === 'overview'
        ? '总览层'
        : '细节层'
  const runtimeFootnote =
    activeMode.category === 'station'
      ? `${TOKYO_MODE_METHODS[activeMode.id].method} ${TOKYO_MODE_METHODS[activeMode.id].boundary}`
      : overlayStatus === 'loading'
        ? `当前视口正在补 ${activeMode.label}${layerLabel} 数据。`
        : overlayStatus === 'error'
          ? `当前视口 ${activeMode.label} 数据加载异常。`
          : overlayInfo
            ? `当前视图使用 ${layerLabel}，命中 ${overlayInfo.matchedChunkCount} 个 chunk。`
            : `${activeMode.label} 会跟着视口按需加载。`
  const collapsedHint =
    activeMode.category === 'station'
      ? '展开图例'
      : overlayStatus === 'loading'
        ? '加载中'
        : overlayInfo
          ? layerLabel
          : '按需加载'

  if (collapsed) {
    return (
      <button className="legend-card legend-card--collapsed" onClick={onExpand} type="button">
        <span className="legend-card__mini-dot" style={{ backgroundColor: activeMode.legend[0]?.color }} />
        <strong>{activeMode.label}</strong>
        <span>{collapsedHint}</span>
      </button>
    )
  }

  return (
    <section className="legend-card">
      <div className="legend-card__header">
        <strong>{activeMode.label}</strong>
        <div className="legend-card__header-actions">
          <span>{categoryLabel}</span>
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

      <div className="legend-card__footnote">{runtimeFootnote}</div>
    </section>
  )
}

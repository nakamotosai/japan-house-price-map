import { getHazardMatches, getSchoolMatches } from '../lib/mapLayers'
import type { HazardZone, ModeDefinition, ModeId, SchoolPoint, Station } from '../types'

type StationPanelProps = {
  activeMode: ModeId
  hazards: HazardZone[]
  modes: Record<ModeId, ModeDefinition>
  onClose: () => void
  onOpenIntro: () => void
  schools: SchoolPoint[]
  selectedStation: Station | null
  status?: 'ready' | 'loading' | 'error'
  errorMessage?: string
}

function formatMillionYen(value: number) {
  return `${value.toFixed(0)}00 万日元`
}

function formatManPerSqm(value: number) {
  return `${value.toFixed(0)} 万日元/平方米`
}

function formatDailyRidership(value: number) {
  return `${value.toLocaleString()} / 日`
}

function riskLabel(level: 'low' | 'medium' | 'high') {
  if (level === 'high') {
    return '高'
  }
  if (level === 'medium') {
    return '中'
  }
  return '低'
}

function ModeBody(props: {
  activeMode: ModeId
  hazards: HazardZone[]
  schools: SchoolPoint[]
  station: Station
}) {
  const { activeMode, hazards, schools, station } = props
  const schoolMatches = getSchoolMatches(schools, station.id)
  const hazardMatches = getHazardMatches(hazards, station.id)

  if (activeMode === 'price') {
    return (
      <div className="panel-grid">
        <article className="metric-card">
          <span>参考总价带</span>
          <strong>{formatMillionYen(station.metrics.medianPriceMJPY)}</strong>
        </article>
        <article className="metric-card">
          <span>参考单价带</span>
          <strong>{formatManPerSqm(station.metrics.medianPriceManPerSqm)}</strong>
        </article>
        <article className="metric-card metric-card--wide">
          <span>价格判断</span>
          <strong>{station.summary}</strong>
          <p>{station.metrics.note}</p>
        </article>
      </div>
    )
  }

  if (activeMode === 'land') {
    return (
      <div className="panel-grid">
        <article className="metric-card">
          <span>公示地价</span>
          <strong>{formatManPerSqm(station.metrics.landValueManPerSqm)}</strong>
        </article>
        <article className="metric-card">
          <span>区域走向</span>
          <strong>{station.metrics.populationTrend}</strong>
        </article>
        <article className="metric-card metric-card--wide">
          <span>地价说明</span>
          <p>这里显示的是站点周边官方土地基准，不直接等于住宅成交价。</p>
        </article>
      </div>
    )
  }

  if (activeMode === 'heat') {
    return (
      <div className="panel-grid">
        <article className="metric-card">
          <span>乘降客数</span>
          <strong>{formatDailyRidership(station.metrics.ridershipDaily)}</strong>
        </article>
        <article className="metric-card">
          <span>热度分数</span>
          <strong>{station.metrics.heatScore}</strong>
        </article>
        <article className="metric-card metric-card--wide">
          <span>换乘能力</span>
          <strong>{station.metrics.transferLines} 条主线路</strong>
          <p>{station.lines.join(' / ')}</p>
        </article>
      </div>
    )
  }

  if (activeMode === 'schools') {
    return (
      <div className="panel-grid">
        <article className="metric-card">
          <span>周边学校数</span>
          <strong>{station.metrics.schoolsNearby}</strong>
        </article>
        <article className="metric-card metric-card--wide">
          <span>示例学校点</span>
          <ul className="inline-list">
            {schoolMatches.length ? (
              schoolMatches.map((school) => <li key={school.id}>{school.name}</li>)
            ) : (
              <li>当前种子数据尚未挂到该站。</li>
            )}
          </ul>
        </article>
      </div>
    )
  }

  return (
    <div className="panel-grid">
      <article className="metric-card">
        <span>洪水风险</span>
        <strong>{riskLabel(station.metrics.hazard.flood)}</strong>
      </article>
      <article className="metric-card">
        <span>液化倾向</span>
        <strong>{riskLabel(station.metrics.hazard.liquefaction)}</strong>
      </article>
      <article className="metric-card metric-card--wide">
        <span>相关风险区域</span>
        <ul className="inline-list">
          {hazardMatches.length ? (
            hazardMatches.map((hazard) => <li key={hazard.id}>{hazard.name}</li>)
          ) : (
            <li>当前未命中示例风险区。</li>
          )}
        </ul>
      </article>
    </div>
  )
}

export function StationPanel(props: StationPanelProps) {
  const {
    activeMode,
    errorMessage,
    hazards,
    modes,
    onClose,
    onOpenIntro,
    schools,
    selectedStation,
    status = 'ready',
  } = props
  const activeModeMeta = modes[activeMode]

  if (!selectedStation) {
    if (status === 'ready') {
      return null
    }

    return (
      <aside className="station-panel">
        <div className="station-panel__empty">
          <span className="station-panel__eyebrow">东京地图工具</span>
          <h1>
            {status === 'loading'
              ? '正在装载东京种子数据。'
              : status === 'error'
                ? '地图骨架已打开，但数据加载失败。'
                : '打开就是地图，不做多余页面。'}
          </h1>
          <p>
            {status === 'loading'
              ? '第二轮开始改成运行时读取 public/data，后面替换成正式导入数据时就不用重写前台。'
              : status === 'error'
                ? `当前错误：${errorMessage ?? 'unknown_error'}`
                : '第一轮先证明三件事：车站能做统一锚点、模式切换足够顺、点面数据能低成本挂上地图。'}
          </p>

          <div className="station-panel__bullet-box">
            <strong>当前模式</strong>
            <p>{activeModeMeta.description}</p>
          </div>

          <div className="station-panel__bullet-box">
            <strong>怎么用</strong>
            <p>先搜站点或直接点图上的车站，再切换模式看同一站在不同维度下的表现。</p>
          </div>

          <button className="primary-button" onClick={onOpenIntro} type="button">
            查看产品说明
          </button>
        </div>
      </aside>
    )
  }

  return (
    <aside className="station-panel">
      <div className="station-panel__header">
        <div>
          <span className="station-panel__eyebrow">{selectedStation.ward}</span>
          <h2>{selectedStation.name}</h2>
          <p>
            {selectedStation.nameJa} / {selectedStation.nameEn}
          </p>
        </div>
        <button className="station-panel__close" onClick={onClose} type="button">
          收起
        </button>
      </div>

      <div className="station-panel__summary">
        <article>
          <span>运营方</span>
          <strong>{selectedStation.operator}</strong>
        </article>
        <article>
          <span>线路数</span>
          <strong>{selectedStation.metrics.transferLines}</strong>
        </article>
      </div>

      <section className="station-panel__section">
        <div className="station-panel__section-head">
          <strong>{activeModeMeta.panelTitle}</strong>
          <span>{activeModeMeta.label}</span>
        </div>
        <ModeBody
          activeMode={activeMode}
          hazards={hazards}
          schools={schools}
          station={selectedStation}
        />
      </section>

      <section className="station-panel__section">
        <div className="station-panel__section-head">
          <strong>跨模式摘要</strong>
          <span>{selectedStation.metrics.district}</span>
        </div>
        <ul className="inline-list">
          <li>热度 {selectedStation.metrics.heatScore}</li>
          <li>人口趋势 {selectedStation.metrics.populationTrend}</li>
          <li>学校 {selectedStation.metrics.schoolsNearby}</li>
        </ul>
        <p className="station-panel__note">{selectedStation.metrics.note}</p>
      </section>
    </aside>
  )
}

import { getAreaMatches, getPointMatches } from '../lib/mapLayers'
import type {
  AreaLayerFeature,
  AsyncStatus,
  ModeDefinition,
  ModeId,
  PointLayerFeature,
  RiskLevel,
  Station,
  StationBase,
} from '../types'

type StationPanelProps = {
  activeMode: ModeId
  convenience: PointLayerFeature[]
  detailErrorMessage?: string
  detailStatus: AsyncStatus
  errorMessage?: string
  hazards: AreaLayerFeature[]
  modes: Record<ModeId, ModeDefinition>
  onClose: () => void
  onOpenIntro: () => void
  overlayErrorMessage?: string
  overlayStatus: AsyncStatus
  population: AreaLayerFeature[]
  schools: PointLayerFeature[]
  selectedStation: Station | null
  selectedStationBase: StationBase | null
  status?: 'ready' | 'loading' | 'error'
}

function formatTotalPrice(value: number) {
  if (value >= 100) {
    return `约 ${(value / 100).toFixed(1).replace(/\.0$/, '')} 亿日元`
  }

  return `约 ${(value * 100).toLocaleString()} 万日元`
}

function formatManPerSqm(value: number) {
  return `${value.toFixed(0)} 万日元/平方米`
}

function formatDailyRidership(value: number) {
  return `${value.toLocaleString()} / 日`
}

function formatPercent(value: number | null) {
  if (value === null) {
    return '待补'
  }

  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}

function riskLabel(level: RiskLevel) {
  if (level === 'high') {
    return '高'
  }
  if (level === 'medium') {
    return '中'
  }
  if (level === 'unknown') {
    return '待补'
  }
  return '低'
}

function depthRankLabel(rank: number | null) {
  if (rank === null) {
    return '未落入浸水区'
  }
  if (rank >= 5) {
    return '10m+'
  }
  if (rank >= 4) {
    return '5-10m'
  }
  if (rank >= 3) {
    return '3-5m'
  }
  if (rank >= 2) {
    return '0.5-3m'
  }
  return '0-0.5m'
}

function PreviewList(props: { items: string[]; emptyText: string }) {
  const { emptyText, items } = props

  return (
    <ul className="inline-list">
      {items.length ? items.map((item) => <li key={item}>{item}</li>) : <li>{emptyText}</li>}
    </ul>
  )
}

function PendingCard(props: { title: string; body: string }) {
  const { body, title } = props

  return (
    <article className="metric-card metric-card--wide metric-card--pending">
      <span>{title}</span>
      <strong>待补</strong>
      <p>{body}</p>
    </article>
  )
}

function LoadingBody(props: {
  activeMode: ModeId
  detailErrorMessage?: string
  detailStatus: AsyncStatus
  overlayErrorMessage?: string
  overlayStatus: AsyncStatus
  station: StationBase
}) {
  const { activeMode, detailErrorMessage, detailStatus, overlayErrorMessage, overlayStatus, station } =
    props

  const detailBody =
    detailStatus === 'loading'
      ? '正在按点击站点补这一小份详情数据，地图本身已经可用。'
      : detailStatus === 'error'
        ? `站点详情加载失败：${detailErrorMessage ?? 'unknown_error'}`
        : '正在准备站点详情。'

  const overlayBody =
    overlayStatus === 'loading'
      ? '当前视口图层正在补数据，面板会沿用已经到位的结果。'
      : overlayStatus === 'error'
        ? `当前模式图层加载失败：${overlayErrorMessage ?? 'unknown_error'}`
        : '当前模式图层会跟着地图视口按需加载。'

  return (
    <div className="panel-grid">
      <article className="metric-card">
        <span>参考总价</span>
        <strong>
          {station.metrics.coverage.price ? formatTotalPrice(station.metrics.medianPriceMJPY) : '待补'}
        </strong>
      </article>
      <article className="metric-card">
        <span>公示地价</span>
        <strong>
          {station.metrics.coverage.land
            ? formatManPerSqm(station.metrics.landValueManPerSqm)
            : '待补'}
        </strong>
      </article>
      <article className="metric-card">
        <span>乘降客数</span>
        <strong>{formatDailyRidership(station.metrics.ridershipDaily)}</strong>
      </article>
      <article className="metric-card">
        <span>换乘线路</span>
        <strong>{station.metrics.transferLines} 条</strong>
      </article>
      <PendingCard title={`${activeMode} 详情`} body={detailBody} />
      <article className="metric-card metric-card--wide">
        <span>图层状态</span>
        <strong>{overlayStatus === 'error' ? '视口数据异常' : '视口数据流正常'}</strong>
        <p>{overlayBody}</p>
      </article>
    </div>
  )
}

function ModeBody(props: {
  activeMode: ModeId
  convenience: PointLayerFeature[]
  hazards: AreaLayerFeature[]
  population: AreaLayerFeature[]
  schools: PointLayerFeature[]
  station: Station
}) {
  const { activeMode, convenience, hazards, population, schools, station } = props
  const schoolMatches = getPointMatches(schools, station.id)
  const convenienceMatches = getPointMatches(convenience, station.id)
  const hazardMatches = getAreaMatches(hazards, station.id)
  const populationMatches = getAreaMatches(population, station.id)

  if (activeMode === 'price') {
    if (!station.metrics.coverage.price) {
      return (
        <div className="panel-grid">
          <PendingCard
            title="成交价覆盖"
            body="这站已经在官方车站主表里，但 2024 住宅成交样本还没有稳定挂到这里。"
          />
          <article className="metric-card">
            <span>乘降客数</span>
            <strong>{formatDailyRidership(station.metrics.ridershipDaily)}</strong>
          </article>
          <article className="metric-card">
            <span>换乘线路</span>
            <strong>{station.metrics.transferLines} 条</strong>
          </article>
        </div>
      )
    }

    return (
      <div className="panel-grid">
        <article className="metric-card">
          <span>参考总价</span>
          <strong>{formatTotalPrice(station.metrics.medianPriceMJPY)}</strong>
        </article>
        <article className="metric-card">
          <span>参考单价</span>
          <strong>{formatManPerSqm(station.metrics.medianPriceManPerSqm)}</strong>
        </article>
        <article className="metric-card">
          <span>成交样本</span>
          <strong>{station.metrics.priceSampleCount} 条</strong>
        </article>
        <article className="metric-card">
          <span>站点热度</span>
          <strong>{station.metrics.coverage.ridership ? station.metrics.heatScore : '待补'}</strong>
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
    if (!station.metrics.coverage.land) {
      return (
        <div className="panel-grid">
          <PendingCard
            title="公示地价覆盖"
            body="这站当前没有命中足够近的 2025 年官方公示地价点。"
          />
        </div>
      )
    }

    return (
      <div className="panel-grid">
        <article className="metric-card">
          <span>公示地价</span>
          <strong>{formatManPerSqm(station.metrics.landValueManPerSqm)}</strong>
        </article>
        <article className="metric-card">
          <span>地价样本</span>
          <strong>{station.metrics.landSampleCount} 点</strong>
        </article>
        <article className="metric-card">
          <span>人口趋势</span>
          <strong>{station.metrics.populationTrend}</strong>
        </article>
        <article className="metric-card metric-card--wide">
          <span>说明</span>
          <p>这里看的是土地价值底盘，不等于实际住宅成交价，但能帮你判断站点的地段强弱。</p>
        </article>
      </div>
    )
  }

  if (activeMode === 'heat') {
    if (!station.metrics.coverage.ridership) {
      return (
        <div className="panel-grid">
          <PendingCard
            title="客流覆盖"
            body="这站坐标已接入，但当前还缺正式客流数据。"
          />
        </div>
      )
    }

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
        <article className="metric-card">
          <span>换乘线路</span>
          <strong>{station.metrics.transferLines} 条</strong>
        </article>
        <article className="metric-card metric-card--wide">
          <span>主要线路</span>
          <p>{station.lines.join(' / ')}</p>
        </article>
      </div>
    )
  }

  if (activeMode === 'schools') {
    return (
      <div className="panel-grid">
        <article className="metric-card">
          <span>周边学校</span>
          <strong>{station.metrics.coverage.schools ? station.metrics.schoolsNearby : 0} 所</strong>
        </article>
        <article className="metric-card">
          <span>教育覆盖</span>
          <strong>{station.metrics.coverage.schools ? '已覆盖' : '较弱'}</strong>
        </article>
        <article className="metric-card metric-card--wide">
          <span>示例学校</span>
          <PreviewList
            emptyText="当前 1.5km 归属范围内没有学校点。"
            items={schoolMatches.slice(0, 6).map((school) => `${school.name} · ${school.categoryLabel}`)}
          />
        </article>
      </div>
    )
  }

  if (activeMode === 'convenience') {
    if (!station.metrics.coverage.convenience) {
      return (
        <div className="panel-grid">
          <PendingCard
            title="便利度覆盖"
            body="这站当前没有命中医疗或公共服务点，所以便利度代理分仍为空。"
          />
        </div>
      )
    }

    return (
      <div className="panel-grid">
        <article className="metric-card">
          <span>便利度代理分</span>
          <strong>{station.metrics.convenienceScore}</strong>
        </article>
        <article className="metric-card">
          <span>周边设施</span>
          <strong>{station.metrics.convenienceNearby} 个</strong>
        </article>
        <article className="metric-card">
          <span>医疗</span>
          <strong>{station.metrics.convenienceBreakdown.medical}</strong>
        </article>
        <article className="metric-card">
          <span>公共服务</span>
          <strong>{station.metrics.convenienceBreakdown.publicService}</strong>
        </article>
        <article className="metric-card metric-card--wide">
          <span>示例设施</span>
          <PreviewList
            emptyText="当前没有命中设施点。"
            items={convenienceMatches
              .slice(0, 6)
              .map((item) => `${item.name} · ${item.categoryLabel}`)}
          />
        </article>
      </div>
    )
  }

  if (activeMode === 'hazard') {
    return (
      <div className="panel-grid">
        <article className="metric-card">
          <span>洪水风险</span>
          <strong>{riskLabel(station.metrics.hazard.flood)}</strong>
        </article>
        <article className="metric-card">
          <span>最大浸水深</span>
          <strong>{depthRankLabel(station.metrics.hazardMaxDepthRank)}</strong>
        </article>
        <article className="metric-card">
          <span>液化</span>
          <strong>{riskLabel(station.metrics.hazard.liquefaction)}</strong>
        </article>
        <article className="metric-card">
          <span>土砂</span>
          <strong>{riskLabel(station.metrics.hazard.landslide)}</strong>
        </article>
        <article className="metric-card metric-card--wide">
          <span>命中风险区域</span>
          <PreviewList
            emptyText="当前站点不在已接入的洪水浸水区里。"
            items={hazardMatches.slice(0, 6).map((hazard) => hazard.name)}
          />
        </article>
      </div>
    )
  }

  if (!station.metrics.coverage.population) {
    return (
      <div className="panel-grid">
        <PendingCard
          title="人口趋势覆盖"
          body="这站当前没有命中 500m mesh 人口趋势结果。"
        />
      </div>
    )
  }

  return (
    <div className="panel-grid">
      <article className="metric-card">
        <span>人口趋势</span>
        <strong>{station.metrics.populationTrend}</strong>
      </article>
      <article className="metric-card">
        <span>2040 对比 2020</span>
        <strong>{formatPercent(station.metrics.populationChangeRate)}</strong>
      </article>
      <article className="metric-card">
        <span>便利度代理分</span>
        <strong>{station.metrics.coverage.convenience ? station.metrics.convenienceScore : '待补'}</strong>
      </article>
      <article className="metric-card">
        <span>公示地价</span>
        <strong>{station.metrics.coverage.land ? formatManPerSqm(station.metrics.landValueManPerSqm) : '待补'}</strong>
      </article>
      <article className="metric-card metric-card--wide">
        <span>命中人口网格</span>
        <PreviewList
          emptyText="当前没有命中人口 mesh。"
          items={populationMatches.slice(0, 4).map((item) => item.summary)}
        />
      </article>
    </div>
  )
}

function CrossModeSummary(props: { station: Station | StationBase }) {
  const { station } = props
  return (
    <ul className="inline-list">
      <li>
        房价 {station.metrics.coverage.price ? formatTotalPrice(station.metrics.medianPriceMJPY) : '待补'}
      </li>
      <li>
        地价 {station.metrics.coverage.land ? formatManPerSqm(station.metrics.landValueManPerSqm) : '待补'}
      </li>
      <li>
        热度 {station.metrics.coverage.ridership ? station.metrics.heatScore : '待补'}
      </li>
      <li>
        便利 {station.metrics.coverage.convenience ? station.metrics.convenienceScore : '待补'}
      </li>
      <li>
        人口 {'populationChangeRate' in station.metrics ? formatPercent(station.metrics.populationChangeRate) : station.metrics.populationTrend}
      </li>
    </ul>
  )
}

export function StationPanel(props: StationPanelProps) {
  const {
    activeMode,
    convenience,
    detailErrorMessage,
    detailStatus,
    errorMessage,
    hazards,
    modes,
    onClose,
    onOpenIntro,
    overlayErrorMessage,
    overlayStatus,
    population,
    schools,
    selectedStation,
    selectedStationBase,
    status = 'ready',
  } = props
  const activeModeMeta = modes[activeMode]
  const stationSnapshot = selectedStation ?? selectedStationBase

  if (!selectedStationBase) {
    if (status === 'ready') {
      return null
    }

    return (
      <aside className="station-panel">
        <div className="station-panel__empty">
          <span className="station-panel__eyebrow">东京地图工具</span>
          <h1>
            {status === 'loading'
              ? '正在装载东京地图底座。'
              : status === 'error'
                ? '地图底座已打开，但基础数据加载失败。'
                : '打开就是地图，不做多余页面。'}
          </h1>
          <p>
            {status === 'loading'
              ? '先加载车站底座，其他图层会跟着模式和视口逐步补齐。'
              : status === 'error'
                ? `当前错误：${errorMessage ?? 'unknown_error'}`
                : '现在的站点锚点、点图层和区域图层都已经按统一 schema 管理。'}
          </p>

          <div className="station-panel__bullet-box">
            <strong>当前模式</strong>
            <p>{activeModeMeta.description}</p>
          </div>

          <div className="station-panel__bullet-box">
            <strong>怎么用</strong>
            <p>直接点站，或者先搜索站点；切模式时只换图层，不换页面。</p>
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
          <span className="station-panel__eyebrow">{selectedStationBase.ward || '官方车站主表'}</span>
          <h2>{selectedStationBase.name}</h2>
          <p>
            {selectedStationBase.nameEn
              ? `${selectedStationBase.nameJa} / ${selectedStationBase.nameEn}`
              : selectedStationBase.nameJa}
          </p>
        </div>
        <button className="station-panel__close" onClick={onClose} type="button">
          收起
        </button>
      </div>

      <div className="station-panel__summary">
        <article>
          <span>运营方</span>
          <strong>{selectedStationBase.operator}</strong>
        </article>
        <article>
          <span>线路数</span>
          <strong>{selectedStationBase.metrics.transferLines}</strong>
        </article>
      </div>

      <section className="station-panel__section">
        <div className="station-panel__section-head">
          <strong>{activeModeMeta.panelTitle}</strong>
          <span>{activeModeMeta.label}</span>
        </div>

        {selectedStation ? (
          <ModeBody
            activeMode={activeMode}
            convenience={convenience}
            hazards={hazards}
            population={population}
            schools={schools}
            station={selectedStation}
          />
        ) : (
          <LoadingBody
            activeMode={activeMode}
            detailErrorMessage={detailErrorMessage}
            detailStatus={detailStatus}
            overlayErrorMessage={overlayErrorMessage}
            overlayStatus={overlayStatus}
            station={selectedStationBase}
          />
        )}
      </section>

      <section className="station-panel__section">
        <div className="station-panel__section-head">
          <strong>跨模式摘要</strong>
          <span>{stationSnapshot?.metrics.district}</span>
        </div>
        {stationSnapshot ? <CrossModeSummary station={stationSnapshot} /> : null}
        {selectedStation ? (
          <p className="station-panel__note">{selectedStation.metrics.note}</p>
        ) : (
          <p className="station-panel__note">
            这块会在站点详情 shard 到位后补样本量、便利度构成、人口变化率和说明文字。
          </p>
        )}
      </section>
    </aside>
  )
}

import { TOKYO_MODE_METHODS, TOKYO_SITE_RELEASE } from '../data/siteMeta'
import { formatTokyoDateTime } from '../lib/format'
import type { TokyoStationsMeta } from '../types'

type IntroOverlayProps = {
  open: boolean
  metadata: TokyoStationsMeta | null
  runtimeGeneratedAt: string | null
  onClose: () => void
}

export function IntroOverlay(props: IntroOverlayProps) {
  const { open, metadata, runtimeGeneratedAt, onClose } = props

  if (!open) {
    return null
  }

  const updatedAt = formatTokyoDateTime(runtimeGeneratedAt ?? metadata?.generatedAt)
  const modeFacts = [
    {
      label: '房产均价',
      coverage: metadata ? `${metadata.priceCoverageCount} 站覆盖` : '覆盖读取中',
      ...TOKYO_MODE_METHODS.price,
    },
    {
      label: '公示地价',
      coverage: metadata ? `${metadata.landCoverageCount} 站覆盖` : '覆盖读取中',
      ...TOKYO_MODE_METHODS.land,
    },
    {
      label: '车站热度',
      coverage: metadata ? `${metadata.stationCount} 站锚点` : '覆盖读取中',
      ...TOKYO_MODE_METHODS.heat,
    },
    {
      label: '学校分布',
      coverage: metadata
        ? `${metadata.schoolsCoverageCount} 站 / ${metadata.schoolsPointCount} 点`
        : '覆盖读取中',
      ...TOKYO_MODE_METHODS.schools,
    },
    {
      label: '生活便利度',
      coverage: metadata
        ? `${metadata.convenienceCoverageCount} 站 / ${metadata.conveniencePointCount} 点`
        : '覆盖读取中',
      ...TOKYO_MODE_METHODS.convenience,
    },
    {
      label: '灾害风险',
      coverage: metadata
        ? `${metadata.hazardCoverageCount} 站 / ${metadata.hazardAreaCount} 区域`
        : '覆盖读取中',
      ...TOKYO_MODE_METHODS.hazard,
    },
    {
      label: '人口趋势',
      coverage: metadata
        ? `${metadata.populationCoverageCount} 站 / ${metadata.populationAreaCount} 网格`
        : '覆盖读取中',
      ...TOKYO_MODE_METHODS.population,
    },
  ]

  return (
    <div className="intro-overlay" role="dialog" aria-modal="true">
      <div className="intro-overlay__card">
        <div className="intro-overlay__head">
          <div>
            <span className="station-panel__eyebrow">{TOKYO_SITE_RELEASE.versionLabel}</span>
            <h2>日本房价地图</h2>
            <p>打开就是东京地图。车站是锚点，模式切换只换图层，不换页面。</p>
          </div>
          <button className="ghost-button" onClick={onClose} type="button">
            收起
          </button>
        </div>

        <div className="intro-overlay__body">
          <div className="intro-overlay__stats">
            <article>
              <strong>{TOKYO_SITE_RELEASE.scopeLabel}</strong>
              <span>底图先给关东范围，当前数据仍只做东京，不扩到其他城市。</span>
            </article>
            <article>
              <strong>{metadata?.stationCount ?? '--'} 个车站</strong>
              <span>默认继续以车站为主，不做房源级列表。</span>
            </article>
            <article>
              <strong>{updatedAt}</strong>
              <span>当前前台数据生成时间。</span>
            </article>
            <article>
              <strong>{TOKYO_SITE_RELEASE.runtimeLabel}</strong>
              <span>按模式、按视口、按缩放即时切换。</span>
            </article>
          </div>

          <div className="intro-overlay__grid">
            <article>
              <strong>怎么用</strong>
              <p>左上角搜索站点，顶部切模式，地图点站看摘要。空白点击可以收起站点卡。</p>
            </article>
            <article>
              <strong>当前边界</strong>
              <p>这是东京数据工具页。底图先给关东范围，不做首页叙事，不做房源页，也不做 AI。</p>
            </article>
            <article>
              <strong>为什么有总览层</strong>
              <p>学校和便利度在低缩放先看聚合热区，放大后才加载原始点，避免一进来就眼花缭乱。</p>
            </article>
            <article>
              <strong>方法说明</strong>
              <p>灾害当前正式整合洪水、液状化和土砂三灾种，生活便利度当前只用医疗与公共服务做代理指标。</p>
            </article>
          </div>

          <div className="intro-overlay__mode-grid">
            {modeFacts.map((item) => (
              <article key={item.label}>
                <strong>{item.label}</strong>
                <span>{item.coverage}</span>
                <p>来源：{item.source}</p>
                <p>时间：{item.period}</p>
                <p>方法：{item.method}</p>
                <p>边界：{item.boundary}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

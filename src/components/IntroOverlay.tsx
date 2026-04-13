type IntroOverlayProps = {
  open: boolean
  onClose: () => void
}

export function IntroOverlay(props: IntroOverlayProps) {
  const { open, onClose } = props

  if (!open) {
    return null
  }

  return (
    <div className="intro-overlay" role="dialog" aria-modal="true">
      <div className="intro-overlay__card">
        <div className="intro-overlay__head">
          <div>
            <span className="station-panel__eyebrow">当前阶段说明</span>
            <h2>日本房价地图</h2>
          </div>
          <button className="ghost-button" onClick={onClose} type="button">
            关闭
          </button>
        </div>

        <div className="intro-overlay__body">
          <p>
            这不是房源列表页，而是一张以东京车站为锚点的地图工具。现在车站坐标和热度已经接入官方主表，
            后面继续往这张底图挂价格、学校、灾害和更多生活设施。
          </p>

          <div className="intro-overlay__grid">
            <article>
              <strong>你现在能做什么</strong>
              <p>搜索站点、切模式、点击车站、看轻量摘要。</p>
            </article>
            <article>
              <strong>这一轮补了什么</strong>
              <p>官方车站主表、真实站别客流、默认大站标签逻辑。</p>
            </article>
            <article>
              <strong>首批模式</strong>
              <p>房产均价、公示地价、车站热度、学校、灾害风险。</p>
            </article>
            <article>
              <strong>下一步</strong>
              <p>继续把房价、公示地价、学校、灾害改成正式导入流水线。</p>
            </article>
          </div>
        </div>
      </div>
    </div>
  )
}

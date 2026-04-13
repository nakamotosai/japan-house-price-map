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
            <span className="station-panel__eyebrow">第一轮说明</span>
            <h2>日本房价地图</h2>
          </div>
          <button className="ghost-button" onClick={onClose} type="button">
            关闭
          </button>
        </div>

        <div className="intro-overlay__body">
          <p>
            这不是房源列表页，而是一张以东京车站为锚点的地图工具。第一轮先验证
            `站点 + 图层 + 面板` 这套底座。
          </p>

          <div className="intro-overlay__grid">
            <article>
              <strong>你现在能做什么</strong>
              <p>搜索站点、切模式、点击车站、看轻量摘要。</p>
            </article>
            <article>
              <strong>为什么先做种子数据</strong>
              <p>先把地图切换和坐标对齐能力做对，后面挂正式数据才不会重写页面。</p>
            </article>
            <article>
              <strong>首批模式</strong>
              <p>房产均价、公示地价、车站热度、学校、灾害风险。</p>
            </article>
            <article>
              <strong>下一步</strong>
              <p>后续再接正式导入流水线、更多设施图层、站点详情和 AI 解读。</p>
            </article>
          </div>
        </div>
      </div>
    </div>
  )
}

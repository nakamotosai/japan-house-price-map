# 日本房价地图 V1.7 Protomaps Basemap Switch SPEC

> 当前状态真相源最终仍以项目根 `README.md` 为准。本 Spec 只服务于本轮连续升级。

## 1. 目标

把当前东京地图的底图从 `GSI pale raster` 切到 `Protomaps` 浅色主题，并把“地图底层空白”的风险从旧底图线路上移除。

这次目标不是只把某个 URL 临时换通，而是把正式项目切到一条更适合当前单页地图工具的开源向量底图线路。

## 2. 已确认问题

- 当前底图代码仍直接依赖 `https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png`。
- 用户当前打开正式项目时，业务 UI 仍在，但地图底层已经出现整块空白。
- 当前项目的底图是栅格源，后续在样式控制、浅色主题稳定性和可扩展性上都弱于向量底图。

## 3. 本轮范围

### 必做

- 把正式底图切到 `Protomaps`。
- 采用接近 Protomaps 官网示例的浅色主题。
- 保持现有东京站点图层、7 模式切换、站点点击与图例逻辑不退化。
- 固定前台验收要覆盖新底图请求与截图。
- README 回写当前底图真相、版本与边界。

### 本轮不做

- 不扩到东京以外城市。
- 不重做业务图层配色体系。
- 不在本轮自建完整 PMTiles 服务栈。
- 不把所有底图字体、sprites 和 tiles 全量 vendor 到仓库。

## 4. 方案

### A. 底图栈

- 前端继续使用 `MapLibre GL`。
- 引入 `pmtiles` 与 `@protomaps/basemaps`。
- 使用 `pmtiles` protocol 读取 Protomaps 公共 PMTiles 源。
- 使用 `@protomaps/basemaps` 生成浅色主题 style，并与现有业务图层共存。

### B. 主题方向

- 采用接近官网示例图的 `white` 浅色视觉。
- 维持低对比、轻道路、轻水系、可读行政区标签。
- 不让底图喧宾夺主，业务站点点位仍应是第一视觉层。

### C. 风险控制

- 不再保留当前 GSI 栅格底图作为默认正式入口。
- 保持 attribution 正确展示。
- 明确 README 边界：
  - 当前仍依赖 Protomaps 公共 PMTiles 源
  - 若后续转生产长期稳定方案，应再切到自托管或自有镜像

## 5. 前端验收矩阵

### Local Preview

- `http://127.0.0.1:4173/`

### Live Preview

- `https://vps-jp.tail4b5213.ts.net:8443/`

### Required States

- desktop 默认态可见浅色 Protomaps 底图
- desktop 7 模式切换态
- desktop 站点打开态
- mobile 默认态
- live 默认态
- console 无关键报错
- network 中底图请求成功

## 6. 验收

- `npm test` 通过
- `npm run lint` 通过
- `npm run build` 通过
- `npm run acceptance:tokyo-v1` 通过
- 最新截图里可见浅色 Protomaps 底图
- README 已回写 `V1.7` 状态、底图真相与当前边界
- `git status --short` 为空

# V1.12 Load Acceleration

## 目标

- 继续压缩东京页首屏体感等待，减少打开后 1 秒级白屏和“壳层先空、地图后出”的感觉。
- 保持默认东京视角和 Protomaps 浅色主题，同时把首屏链路改成东京优先，不再先拉整份站点底座。
- 交付必须包含冷/热启动量化对比和真实前台截图验收。

## 范围

- `index.html` 与前端首屏可见壳层
- `MapLibre` 运行时加载时序
- 东京站点 runtime 的首屏切分与后台扩展
- 前端 profiling、构建、live 验收、README 回写

## 非目标

- 不更换底图库
- 不扩到东京以外城市
- 不重做 7 个模式的数据口径

## 约束

- 默认仍直达东京单页地图
- 默认视角继续落在东京核心区，优先皇居周边
- 浏览器失败时仍需保留显式错误面
- 变更后必须兼容现有 `npm test`、`npm run build`、`npm run acceptance:tokyo-v1`

## 验收

- 打开页面后，HTML 级壳层应立即可见，不再出现纯白空页。
- `MapLibre` 运行时应在 React 地图 effect 之前就开始准备，不再等到地图组件初始化后才发起。
- 站点 runtime 首屏只拉东京默认视口所需底座；全量站点改为后台扩展并进入缓存。
- 冷/热启动各跑一轮 profiling，至少对比：
  - `first-contentful-paint`
  - `shell visible`
  - `maplibre ready`
  - `map object ready`
  - `map loaded`
- Tailnet live 入口截图、console、network 无关键错误，默认落点仍是东京核心区。

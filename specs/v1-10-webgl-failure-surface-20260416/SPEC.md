# 日本房价地图 V1.10 WebGL Failure Surface SPEC

> 当前状态真相源最终仍以项目根 `README.md` 为准。本 Spec 只服务于本轮排障与前台收口。

## 1. 目标

定位“用户看到 V1.9 UI 但地图整块空白”的根本原因，并把这类地图初始化失败显式显示到前台，避免继续表现成无提示的空白地图。

## 2. 已确认问题

- 用户截图里已经能看到 `V1.9`，说明不是旧 bundle 或缓存未刷新。
- 用户截图里没有 MapLibre 导航控件，也没有任何底图或站点层，说明不是“底图样式轻微没变化”，而是地图实例本身没起来。
- 在当前 live bundle 上，用禁用 WebGL 的 Chromium 可稳定复现几乎同样的失败面：
  - UI 壳层正常
  - 地图控件缺失
  - `window.__TOKYO_MAP__` 不存在
  - 浏览器报 `Failed to initialize WebGL`

## 3. 本轮范围

### 必做

- 给地图初始化链路补错误捕获。
- 在浏览器无法创建 WebGL 或 MapLibre 初始化失败时，前台显示明确错误说明。
- 保持正常浏览器上的 live 地图行为不退化。
- 产出两组前台证据：
  - 正常 live 截图
  - no-WebGL 对照截图

### 本轮不做

- 不把底图架构再改回 raster。
- 不扩东京以外数据。
- 不把客户端浏览器设置变更伪装成服务端修复。

## 4. 验收

- 正常 live 入口继续能看到 Protomaps + 关东视角 + 东京数据。
- no-WebGL 浏览器下，前台不再是静默空白，而是明确提示 WebGL / 硬件加速问题。
- `npm test`
- `npm run lint`
- `npm run build`
- `node ./scripts/tokyo_v1_acceptance.mjs --url 'http://127.0.0.1:4173/' --tailnet-url 'https://vps-jp.tail4b5213.ts.net:8443/'`
- README 回写当前根因与边界，仓库最终干净

# 日本房价地图

以东京车站为锚点的单页地图工具。

目标不是做房源列表平台，而是把“开源地图底座 + 车站锚点 + 多模式秒切换 + 按视口加载”这套能力先在东京做扎实。用户打开后直接进入东京地图，不做额外首页。

## 当前状态

- 状态：`Tokyo V1.10 WebGL failure surface + Protomaps same-origin delivery 已收口`
- 当前版本：`单页东京地图 + 7 模式 + Protomaps white 浅色底图 + 关东范围底图框架 + 东京数据不扩城 + Protomaps 同域代理交付 + WebGL 初始化失败显式提示 + manifest/catalog runtime + V1.5 站点分享增强 + V1.6 MapLibre 脱主包 / 灾害三灾种收口 + V1.7 PMTiles protocol / basemap sprite-glyph / canvas 验收补强 + Cloudflare 正式域名 + Tailnet 预览`
- 当前可用能力：
  - 直接进入东京地图，不做独立首页
  - Google Maps 风格启发的左侧边栏、左上搜索栏和顶部模式按钮
  - 左上菜单按钮已经变成真实入口：
    - 重置关东视角
    - 打开数据说明
    - 展开/收起图例
    - 菜单内切换 7 个模式
  - 7 个模式即时切换：
    - 房产均价
    - 公示地价
    - 车站热度
    - 学校分布
    - 生活便利度
    - 灾害风险
    - 人口趋势
  - 车站继续作为核心锚点，不做房源级列表
  - 站点详情继续按点击补载 shard，而不是首屏整包塞进来
  - 热门站点 detail shard 会在空闲时预取，首个点击等待更短
  - `schools / convenience / hazard / population` 全部走三档 runtime manifest：
    - `summary`
    - `overview`
    - `detail`
  - `hazard / population` 的三档 area runtime 已改成 `manifest + catalog + id chunk`，chunk 本体只传 feature id
  - `MapLibre` 已从应用主包拆出，当前走 `/public/vendor/maplibre/` 本地 vendor 注入
  - 正式底图已从 `地理院 pale raster` 切到 `Protomaps white` 浅色向量底图
  - 当前浏览器底图走同域 `pmtiles://<origin>/vendor/protomaps/openstreetmap-v4.pmtiles`
  - 底图 glyphs / sprite 走同域 `/vendor/protomaps/fonts/...` 与 `/vendor/protomaps/sprites/v4/white`
  - 当前 `runtime/` 目录约 `15M`，`public/vendor/maplibre/` 约 `1.1M`
  - `schools / convenience` 已补低缩放 `overview` 聚合层
  - 默认关东视角下 `schools / convenience / hazard / population` 都会先命中更粗的 `summary` 层，而不是误打 `detail`
  - 页面内说明弹窗已回写真实口径、来源、年份、覆盖范围和当前边界
  - 移动端模式区已收成单行横向带，不再多行挤压地图
  - 移动端图例默认折叠，默认先把地图让出来
  - 说明弹窗已拆成懒加载 chunk，不再挤在首屏主包里
  - build 现在只保留 `vendor-react / app entry`，不再生成 `vendor-maplibre-*`
  - URL 现在支持 `?mode=<mode>&station=<stationId>` 直达和分享
  - 站点面板现在有“分享这站”入口，优先 Web Share，失败时回退复制链接
  - 7 个模式的图例脚注和固定验收报告都已补成可读文本
  - UI 可见 `Tokyo V1.10` 和数据更新时间
  - 当浏览器无法创建 WebGL 时，前台不再静默空白，而会显示明确错误卡片
  - 固定前台验收现在会额外产出 `console / network / interaction / live screenshot / map canvas screenshot`
  - 固定 Tailnet HTTPS 预览入口可直接从 Windows 访问

## 当前底图真相

- 渲染层：`MapLibre GL`
- 正式底图：`Protomaps white`
- 当前浏览器底图入口：`/vendor/protomaps/openstreetmap-v4.pmtiles`
- 当前上游底图源：`https://data.source.coop/protomaps/openstreetmap/v4.pmtiles`
- 当前地图边界：`关东范围`
- 当前数据边界：`东京`
- 当前标签与样式资产：
  - glyphs：`/vendor/protomaps/fonts/{fontstack}/{range}.pbf`
  - sprite：`/vendor/protomaps/sprites/v4/white`
- 当前空白地图根因真相：
  - 若页面能看到 `V1.10`、菜单和模式按钮，但地图区没有任何底图、站点和右下角 MapLibre 控件，根因更可能是浏览器没能创建 WebGL，而不是站点没有更新
  - 当前前台已把这类失败显式显示为“地图未启动 / 当前浏览器没有可用的地图渲染能力”
- 当前边界：
  - 生产入口已经切到 Protomaps 底图，用户浏览器不再直连外部 `source.coop / github.io`
  - 但 `4173` 预览服务当前仍是“同域代理上游公开 PMTiles / basemaps-assets”，不是本仓完整自托管
  - 若后续要追求更强 SLA 或更低外部依赖，应再切到自有镜像或自托管 PMTiles

## 当前数据口径

### 车站锚点层

- 车站总数：`589`
- 官方基础：
  - `N02-24` 车站主表
  - `S12-24` 站别客流

### 正式图层覆盖

- 房产均价：
  - 来源：`国土交通省 不動産情報ライブラリ API`
  - 口径：`2024 年住宅成交总价中位数`
  - 覆盖站点：`342`
- 公示地价：
  - 来源：`L01-25`
  - 口径：`2025 年公示地价`
  - 覆盖站点：`459`
- 车站热度：
  - 来源：`S12-24 + 官方车站主表`
  - 口径：`站别客流 + 换乘线路强度`
  - 覆盖站点：`589`
- 学校分布：
  - 来源：`P29-23`
  - 覆盖站点：`458`
  - 原始点位：`3284`
  - 低缩放总览：`13` 个 chunk / `44` 个聚合点
- 生活便利度：
  - 来源：`P04-20 + P05-22`
  - 口径：`医疗 + 公共服务代理指标`
  - 覆盖站点：`502`
  - 原始点位：`22765`
  - 低缩放总览：`13` 个 chunk / `46` 个聚合点
- 灾害风险：
  - 来源：`A31a-24_13_20 + 东京液状化250m + A33-24_13`
  - 当前正式口径：`洪水浸水 + 液状化 + 土砂災害`
  - 覆盖站点：`505`
  - 区域数：`426`
  - 其中土砂：`15` 个区域 / `11` 个站点
  - 归属方式：`洪水 / 液状化按站点落面；土砂在站点点位未压中 polygon 时按 75m 最近站点归属`
- 人口趋势：
  - 来源：`500m_mesh_2024_13`
  - 口径：`2020 -> 2040 推计人口变化率`
  - 覆盖站点：`492`
  - 区域数：`456`

## 运行时数据结构

当前前台实际走的是 `public/data/tokyo/runtime/`。

- `runtime/index.json`
  - 运行时总入口
  - 记录 `stations.basePath`、`detailsManifestPath`、`metadataPath`、各模式 manifest
- `runtime/stations.base.json`
  - 首屏地图、搜索、站点排序必须字段
- `runtime/stations/details/manifest.json`
  - `stationId -> shardId`
- `runtime/stations/details/shard-xx.json`
  - 点击站点后再补载的完整详情
- `runtime/schools/summary.manifest.json + chunks`
- `runtime/schools/overview.manifest.json + chunks`
- `runtime/schools/detail.manifest.json + chunks`
- `runtime/convenience/summary.manifest.json + chunks`
- `runtime/convenience/overview.manifest.json + chunks`
- `runtime/convenience/detail.manifest.json + chunks`
- `runtime/hazard/summary.manifest.json + summary.catalog.json + chunks`
- `runtime/hazard/overview.manifest.json + overview.catalog.json + chunks`
- `runtime/hazard/detail.manifest.json + detail.catalog.json + chunks`
- `runtime/population/summary.manifest.json + summary.catalog.json + chunks`
- `runtime/population/overview.manifest.json + overview.catalog.json + chunks`
- `runtime/population/detail.manifest.json + detail.catalog.json + chunks`

当前运行时摘要：

- `schoolsSummaryChunks`: `4`
- `schoolsOverviewChunks`: `13`
- `schoolsDetailChunks`: `92`
- `convenienceSummaryChunks`: `4`
- `convenienceOverviewChunks`: `13`
- `convenienceDetailChunks`: `93`
- `hazardSummaryChunks`: `9`
- `hazardOverviewChunks`: `27`
- `hazardDetailChunks`: `27`
- `populationSummaryChunks`: `8`
- `populationOverviewChunks`: `26`
- `populationDetailChunks`: `26`

## 当前前台行为

- 默认进入关东范围视角：`zoom 8.35`
- 默认底图是 `Protomaps white` 浅色主题
- 默认房产均价模式继续优先显示大站和核心价格 badge
- 左上菜单按钮现在会打开地图菜单，不再是死控件
- 直达链接支持把当前 `mode + station` 保留在 URL 里
- `schools / convenience`
  - 默认关东视角先用 `summary`
  - `11.9+` 先切到 `overview`
  - 放大到 `12.8+` 才切 `detail`
- `hazard / population`
  - 默认关东视角先用 `summary`
  - `11.8+` 先切到 `overview`
  - 放大到 `12.3+` 才切 `detail`
  - 会额外补一次对应 level 的 `catalog.json`，chunk 本体只传 feature id
- 说明按钮继续做成透明弹窗，不做独立说明页
- 点击空白区域可以收起站点卡片
- 图例继续自动收起，但 7 个模式都能显示稳定脚注和当前层级命中状态
- 移动端模式区固定为单行横向滚动，不再堆成多行按钮墙
- 移动端默认先显示折叠图例，需要时再展开
- 左侧边栏底部可看到 `Tokyo V1.10` 与数据更新时间简写

## 运行与构建

开发：

```bash
npm install
npm run dev
```

验证：

```bash
npm test
npm run lint
npm run build
```

固定前台验收：

```bash
npm run acceptance:tokyo-v1
```

重建官方车站底座：

```bash
python3 scripts/build_tokyo_station_master.py
```

重建东京正式图层与 runtime：

```bash
REINFOLIB_SUBSCRIPTION_KEY='<your-key>' python3 scripts/build_tokyo_phase_a_layers.py
```

README 收口校验：

```bash
python3 scripts/readme_closeout_guard.py /home/ubuntu/codex/日本房价地图
python3 scripts/readme_closeout_guard.py /home/ubuntu/codex/日本房价地图 --expect-clean
```

## Tailnet 预览

正式外网域名：

```text
https://tokyohouse.saaaai.com/
```

正式公网入口当前通过现有 Cloudflare Tunnel 反向接到本机 `4173` 预览服务。

入口维护真相源：

- Tunnel 持久配置：`/etc/cloudflared/config.yml`
- 运行服务：`cloudflared.service`
- 站点 origin：`http://127.0.0.1:4173/`

内部 Tailnet 预览：

当前宿主自恢复链：

- `pm2-ubuntu.service`
- `pm2 resurrect -> ~/.pm2/dump.pm2`
- `japan-house-price-map-preview -> 127.0.0.1:4173`
- `tailscale serve https:8443 -> http://127.0.0.1:4173`

启动：

```bash
./scripts/start_tailnet_preview.sh
```

当前启动脚本会同步把 `japan-house-price-map-preview` 写入 PM2 dump，作为“这个项目现在应该自恢复”的真相源。

停止：

```bash
./scripts/stop_tailnet_preview.sh
```

当前停止脚本会同时把该进程从 PM2 dump 移除；如果是故障止血后要保持停用，以它为准。

当前 Tailnet 预览地址：

```text
https://vps-jp.tail4b5213.ts.net:8443/
```

同一 Tailnet 内的 `home-windows.tail4b5213.ts.net` 可以直接打开。

## Tokyo V1 维护 SOP

当东京数据、图层或前端交互有改动时，按下面顺序收口：

1. 先更新数据或前端实现。
2. 如涉及正式数据，重跑：
   - `python3 scripts/build_tokyo_phase_a_layers.py --skip-station-master`
3. 跑项目验证：
   - `npm test`
   - `npm run lint`
   - `npm run build`
4. 跑固定前台验收：
   - `npm run acceptance:tokyo-v1`
5. 重启真实预览：
   - `./scripts/start_tailnet_preview.sh`
6. 对真实入口探活：
   - `curl -I http://127.0.0.1:4173/`
   - `curl -I https://tokyohouse.saaaai.com/`
   - `curl -I https://vps-jp.tail4b5213.ts.net:8443/`
7. 回写根 `README.md`
8. 提交、推送，并确保 `git status --short` 为空

## 本轮收口验证

- `python3 scripts/build_tokyo_phase_a_layers.py --skip-station-master` 通过
- `npm test` 通过
- `npm run lint` 通过
- `npm run build` 通过
  - 当前 build 产物已拆出：
    - `dist/assets/index-*.js`
    - `dist/assets/vendor-react-*.js`
    - `/public/vendor/maplibre/maplibre-gl.js`
    - `dist/assets/IntroOverlay-*.js`
- `npm run acceptance:tokyo-v1` 通过
  - 最新验收产物：
    - `/home/ubuntu/codex/日本房价地图/.artifacts/tokyo-v1-acceptance/2026-04-16T042356Z/desktop-price-default.png`
    - `/home/ubuntu/codex/日本房价地图/.artifacts/tokyo-v1-acceptance/2026-04-16T042356Z/desktop-price-canvas.png`
    - `/home/ubuntu/codex/日本房价地图/.artifacts/tokyo-v1-acceptance/2026-04-16T042356Z/desktop-schools-summary.png`
    - `/home/ubuntu/codex/日本房价地图/.artifacts/tokyo-v1-acceptance/2026-04-16T042356Z/desktop-convenience-summary.png`
    - `/home/ubuntu/codex/日本房价地图/.artifacts/tokyo-v1-acceptance/2026-04-16T042356Z/desktop-hazard-summary.png`
    - `/home/ubuntu/codex/日本房价地图/.artifacts/tokyo-v1-acceptance/2026-04-16T042356Z/desktop-population-summary.png`
    - `/home/ubuntu/codex/日本房价地图/.artifacts/tokyo-v1-acceptance/2026-04-16T042356Z/mobile-price-default.png`
    - `/home/ubuntu/codex/日本房价地图/.artifacts/tokyo-v1-acceptance/2026-04-16T042356Z/live-default.png`
    - `/home/ubuntu/codex/日本房价地图/.artifacts/tokyo-v1-acceptance/2026-04-16T042356Z/live-default-canvas.png`
    - `/home/ubuntu/codex/日本房价地图/.artifacts/tokyo-v1-acceptance/2026-04-16T042356Z/report.json`
    - `/home/ubuntu/codex/日本房价地图/.artifacts/tokyo-v1-acceptance/2026-04-16T042356Z/console-report.json`
    - `/home/ubuntu/codex/日本房价地图/.artifacts/tokyo-v1-acceptance/2026-04-16T042356Z/network-report.json`
    - `/home/ubuntu/codex/日本房价地图/.artifacts/tokyo-v1-acceptance/2026-04-16T042356Z/interaction-summary.json`
  - 验收报告确认：
    - `interaction-summary.json` 已记录默认视角，当前默认缩放已从东京核心近景降到关东范围
    - `desktop-price-canvas.png` 与 `live-default-canvas.png` 已给出 WebGL map canvas 真相图，不再只依赖 headless 页面截图
    - `2026-04-16T051932Z` 这轮 same-origin live 验收已确认 Protomaps 底图请求：
      - `http://127.0.0.1:4173/vendor/protomaps/openstreetmap-v4.pmtiles`
      - `http://127.0.0.1:4173/vendor/protomaps/sprites/v4/white.json`
      - `http://127.0.0.1:4173/vendor/protomaps/sprites/v4/white.png`
      - `http://127.0.0.1:4173/vendor/protomaps/fonts/Noto Sans .../*.pbf`
    - `2026-04-16T0521Z` 这轮 no-WebGL 对照截图已确认：
      - UI 壳层仍会显示 `V1.10`
      - `window.__TOKYO_MAP__ = false`
      - `navControls = 0`
      - 前台会显示“当前浏览器没有可用的地图渲染能力”
    - `schools / convenience / hazard / population` 都已进入三档 manifest 矩阵
    - 默认关东视角：
      - `schools` 命中 `summary.manifest.json + 4 个 summary chunks`
      - `convenience` 命中 `summary.manifest.json + 4 个 summary chunks`
      - `hazard` 命中 `summary.manifest.json + 9 个 summary chunks + summary.catalog.json`
      - `population` 命中 `summary.manifest.json + 8 个 summary chunks + summary.catalog.json`
    - `price / land / heat / schools / convenience / hazard / population` 的 `legendText` 全部非空
    - 菜单按钮已可打开地图菜单
    - 搜索零结果态已覆盖
    - 站点打开态已确认分享按钮可见
    - 站点选择后 URL 会保留 `station` 与当前 `mode`
    - 站点退选后 URL 会清掉 `station`，分享按钮也会消失
    - live 入口已拿到真实浏览器截图
    - 点击空白区域可以收起站点卡片
    - price 默认态已经能看到热门站点 detail shard 预取请求
- `curl -I http://127.0.0.1:4173/` 返回 `HTTP 200`
- `curl -I https://tokyohouse.saaaai.com/` 返回 `HTTP 200`
- `curl -I https://vps-jp.tail4b5213.ts.net:8443/` 返回 `HTTP 200`

## 当前边界

- 当前只做东京，不扩到其他城市
- 当前地图只能在关东范围内拖拽，不再把用户带到无关区域
- 站点是核心锚点，不做房源级列表
- 灾害模式当前正式整合 `洪水浸水 + 液状化 + 土砂災害`，但还没接 `高潮 / 津波 / 内水`
- 便利度模式当前只是“医疗 + 公共服务”的第一版官方代理指标
- 还没有独立站点详情页和 AI 功能
- 当前前台验收使用 `Chromium + SwiftShader`；对 WebGL 地图面，页面截图只作为壳层证据，map canvas 导出图才是地图像素真相
- 当前用户截图里那种“UI 正常但整块地图发灰空白”的失败面，已经通过禁用 WebGL 的 Chromium 稳定复现；根因在客户端浏览器 WebGL 初始化失败，不是 bundle 没更新
- 当前 Protomaps 底图对用户已收成同域代理，但上游仍依赖公开 PMTiles 源和官方 basemaps-assets，不是本仓完整自托管
- 正式域名当前通过现有 Cloudflare Tunnel 反向接到本机 `4173` 预览服务；Cloudflare Pages `tokyohouse-2xk.pages.dev` 已建成，后续可作为静态托管备选面

## 仓库卫生要求

- 根 `README.md` 是当前状态唯一真相源
- 每轮实现结束后，必须同步 README
- 没有验证，不算完成
- 项目可交付状态应满足：
  - 代码已验证
  - 预览入口可用
  - README 已回写
  - `git status --short` 为空

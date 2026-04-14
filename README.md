# 日本房价地图

以东京车站为锚点的单页地图工具。

目标不是做房源列表平台，而是把“开源地图底座 + 车站锚点 + 多模式秒切换 + 按视口加载”这套能力先在东京做扎实。用户打开后直接进入东京地图，不做额外首页。

## 当前状态

- 状态：`Tokyo V1.2 runtime perf 已收口`
- 当前版本：`单页东京地图 + 7 模式 + summary/overview/detail runtime + V1.2 包体拆分 + 强化前台验收 + Tailnet 预览`
- 当前可用能力：
  - 直接进入东京地图，不做独立首页
  - Google Maps 风格启发的左侧边栏、左上搜索栏和顶部模式按钮
  - 左上菜单按钮已经变成真实入口：
    - 重置东京视角
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
  - `schools / convenience / hazard / population` 全部走三档 runtime manifest：
    - `summary`
    - `overview`
    - `detail`
  - `schools / convenience` 已补低缩放 `overview` 聚合层
  - 默认东京视口现在优先命中更粗的 `summary` 层，而不是直接打碎 `overview`
  - 页面内说明弹窗已回写真实口径、来源、年份、覆盖范围和当前边界
  - 移动端模式区已收成单行横向带，不再多行挤压地图
  - 移动端图例默认折叠，默认先把地图让出来
  - 说明弹窗已拆成懒加载 chunk，不再挤在首屏主包里
  - build 已拆成 `vendor-react / vendor-maplibre / app entry`
  - UI 可见 `Tokyo V1.2` 和数据更新时间
  - 固定前台验收现在会额外产出 `console / network / interaction / live screenshot`
  - 固定 Tailnet HTTPS 预览入口可直接从 Windows 访问

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
  - 来源：`A31a-24_13_20`
  - 当前正式口径：`洪水浸水`
  - 覆盖站点：`505`
  - 区域数：`64`
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
- `runtime/hazard/summary.manifest.json + chunks`
- `runtime/hazard/overview.manifest.json + chunks`
- `runtime/hazard/detail.manifest.json + chunks`
- `runtime/population/summary.manifest.json + chunks`
- `runtime/population/overview.manifest.json + chunks`
- `runtime/population/detail.manifest.json + chunks`

当前运行时摘要：

- `schoolsSummaryChunks`: `4`
- `schoolsOverviewChunks`: `13`
- `schoolsDetailChunks`: `92`
- `convenienceSummaryChunks`: `4`
- `convenienceOverviewChunks`: `13`
- `convenienceDetailChunks`: `93`
- `hazardSummaryChunks`: `6`
- `hazardOverviewChunks`: `16`
- `hazardDetailChunks`: `16`
- `populationSummaryChunks`: `8`
- `populationOverviewChunks`: `26`
- `populationDetailChunks`: `26`

## 当前前台行为

- 默认进入东京核心视角：`zoom 11.55`
- 默认房产均价模式继续优先显示大站和核心价格 badge
- 左上菜单按钮现在会打开地图菜单，不再是死控件
- `schools / convenience`
  - 默认东京视口先用 `summary`
  - 低缩放先用 `overview`
  - 放大到 `12.8+` 才切 `detail`
- `hazard / population`
  - 默认东京视口先用 `summary`
  - 低缩放先用 `overview`
  - 放大到 `12.3+` 才切 `detail`
- 说明按钮继续做成透明弹窗，不做独立说明页
- 点击空白区域可以收起站点卡片
- 图例继续自动收起，但会显示当前层级和视口命中状态
- 移动端模式区固定为单行横向滚动，不再堆成多行按钮墙
- 移动端默认先显示折叠图例，需要时再展开
- 左侧边栏底部可看到 `Tokyo V1.2` 与数据更新时间简写

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

启动：

```bash
./scripts/start_tailnet_preview.sh
```

停止：

```bash
./scripts/stop_tailnet_preview.sh
```

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
    - `dist/assets/vendor-maplibre-*.js`
    - `dist/assets/IntroOverlay-*.js`
- `npm run acceptance:tokyo-v1` 通过
  - 最新验收产物：
    - `/home/ubuntu/codex/日本房价地图/.artifacts/tokyo-v1-acceptance/2026-04-14T153214Z/desktop-price-default.png`
    - `/home/ubuntu/codex/日本房价地图/.artifacts/tokyo-v1-acceptance/2026-04-14T153214Z/desktop-schools-summary.png`
    - `/home/ubuntu/codex/日本房价地图/.artifacts/tokyo-v1-acceptance/2026-04-14T153214Z/desktop-convenience-summary.png`
    - `/home/ubuntu/codex/日本房价地图/.artifacts/tokyo-v1-acceptance/2026-04-14T153214Z/desktop-hazard-summary.png`
    - `/home/ubuntu/codex/日本房价地图/.artifacts/tokyo-v1-acceptance/2026-04-14T153214Z/desktop-population-summary.png`
    - `/home/ubuntu/codex/日本房价地图/.artifacts/tokyo-v1-acceptance/2026-04-14T153214Z/mobile-price-default.png`
    - `/home/ubuntu/codex/日本房价地图/.artifacts/tokyo-v1-acceptance/2026-04-14T153214Z/live-default.png`
    - `/home/ubuntu/codex/日本房价地图/.artifacts/tokyo-v1-acceptance/2026-04-14T153214Z/report.json`
    - `/home/ubuntu/codex/日本房价地图/.artifacts/tokyo-v1-acceptance/2026-04-14T153214Z/console-report.json`
    - `/home/ubuntu/codex/日本房价地图/.artifacts/tokyo-v1-acceptance/2026-04-14T153214Z/network-report.json`
    - `/home/ubuntu/codex/日本房价地图/.artifacts/tokyo-v1-acceptance/2026-04-14T153214Z/interaction-summary.json`
  - 验收报告确认：
    - `schools / convenience / hazard / population` 都已进入三档 manifest 矩阵
    - 默认东京视口：
      - `schools` 命中 `summary.manifest.json + 4 个 summary chunks`
      - `convenience` 命中 `summary.manifest.json + 4 个 summary chunks`
      - `hazard` 命中 `summary.manifest.json + 6 个 summary chunks`
      - `population` 命中 `summary.manifest.json + 8 个 summary chunks`
    - 菜单按钮已可打开地图菜单
    - 搜索零结果态已覆盖
    - live 入口已拿到真实浏览器截图
    - 点击空白区域可以收起站点卡片
- `curl -I http://127.0.0.1:4173/` 返回 `HTTP 200`
- `curl -I https://vps-jp.tail4b5213.ts.net:8443/` 返回 `HTTP 200`

## 当前边界

- 当前只做东京，不扩到其他城市
- 站点是核心锚点，不做房源级列表
- 灾害模式当前只正式接入洪水浸水，不代表全灾种完成
- 便利度模式当前只是“医疗 + 公共服务”的第一版官方代理指标
- 还没有站点详情页、分享页和 AI 功能
- 当前前台验收使用 `Chromium + SwiftShader`，用于无头环境下验证 MapLibre 页面可用

## 仓库卫生要求

- 根 `README.md` 是当前状态唯一真相源
- 每轮实现结束后，必须同步 README
- 没有验证，不算完成
- 项目可交付状态应满足：
  - 代码已验证
  - 预览入口可用
  - README 已回写
  - `git status --short` 为空

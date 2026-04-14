# 日本房价地图

以东京车站为锚点的单页地图工具。

目标不是做房源列表平台，而是先把“坐标对准地图 + 多模式秒切换 + 站点优先交互”这套底座做扎实。用户打开后直接进入东京地图，通过站点来判断价格、热度、配套、风险和长期趋势。

## 当前状态

- 状态：`phase5.2 viewport streaming + clarity 已落地`
- 当前版本：`单页东京地图 + 官方车站主表 + 7 模式切换 + runtime chunk 数据流 + 站点视口优先渲染 + Tailnet 预览`
- 当前已完成：
  - 直接进入东京地图，不做单独首页
  - Google Maps 风格启发的左侧边栏与左上搜索栏
  - 官方东京车站主表接入
  - 官方 `S12-24` 站别客流接入
  - 7 个模式即时切换：
    - 房产均价
    - 公示地价
    - 车站热度
    - 学校分布
    - 生活便利度
    - 灾害风险
    - 人口趋势
  - 站点继续使用 MapLibre 原生 `source + layer`，不再使用 DOM marker
  - 点击地图空白区域可收起站点卡片
  - 站点详情改成点击后按 shard 补载，不再把全部详情一次塞进首屏
  - 点图层与区域图层改成 `manifest + chunk` 运行时结构
  - 前端改成按模式、按视口加载 runtime chunk
  - 运行时带 chunk cache，过期请求带 `AbortController`
  - 站点显示逻辑改成：
    - 当前视口优先
    - `anchor dot / name label / metric badge` 三层预算
    - 屏幕空间去重
  - 学校 / 便利度在低缩放只保留 cluster，不显示原始单点
  - 默认东京视角收紧到核心区，减少首屏噪音和无效加载
  - PM2 常驻预览进程
  - Tailnet HTTPS 预览入口

## 当前唯一任务

把东京地图底座从 `phase5.1` 的“整包加载 + 全东京统一显示”升级成 `phase5.2` 的“runtime chunk + 视口优先显示”，并把前三个批次和收口流程一次做完。

## 当前唯一实施计划

- 批次 1：把前端切到 `runtime/index.json + stations.base + details shard + mode manifest/chunk`
- 批次 2：把站点显示改成当前视口优先、三层预算、屏幕空间去重
- 批次 3：细化点图层 / 区域图层的低缩放表达，并完成真实预览、README、git 收口

## 当前数据口径

### 车站锚点层

- 车站总数：`589`
- 官方基础：
  - `N02-24` 车站主表
  - `S12-24` 站别客流

### 正式图层覆盖

- 房产均价：
  - 来源：`国土交通省 不動産情報ライブラリ API`
  - 口径：`2024 年住宅成交价`
  - 覆盖站点：`342`
- 公示地价：
  - 来源：`L01-25`
  - 覆盖站点：`459`
- 学校分布：
  - 来源：`P29-23`
  - 站点覆盖：`458`
  - 点位数：`3284`
- 生活便利度：
  - 来源：`P04-20 + P05-22`
  - 站点覆盖：`502`
  - 点位数：`22765`
- 灾害风险：
  - 来源：`A31a-24_13_20`
  - 当前口径：`洪水浸水`
  - 站点覆盖：`505`
  - 区域数：`64`
- 人口趋势：
  - 来源：`500m_mesh_2024_13`
  - 站点覆盖：`492`
  - 区域数：`456`

## 运行时数据结构

当前前台实际走的是 `public/data/tokyo/runtime/`，不是旧的整包 JSON。

- `runtime/index.json`
  - 运行时总入口
  - 记录 `stations.basePath`、`stations.detailsManifestPath`、各模式 manifest 路径
- `runtime/stations.base.json`
  - 地图首屏、搜索、站点排序必须字段
- `runtime/stations/details/manifest.json`
  - `stationId -> shardId`
- `runtime/stations/details/shard-xx.json`
  - 点击站点后再补载的完整详情
- `runtime/schools/manifest.json + chunks`
- `runtime/convenience/manifest.json + chunks`
- `runtime/hazard/overview.manifest.json + chunks`
- `runtime/hazard/detail.manifest.json + chunks`
- `runtime/population/overview.manifest.json + chunks`
- `runtime/population/detail.manifest.json + chunks`

当前 runtime 体积已经从之前约 `51M` 降到约 `21M`。

## 当前前台行为

### 默认房产均价模式

- 默认东京核心视角：`zoom 11.55`
- 前台探针实测：
  - 站点圆点：`41`
  - 站名：`10`
  - 价格 badge：`10`
- 默认首屏 runtime 请求只有 `3` 个：
  - `runtime/index.json`
  - `stations.base.json`
  - `stations/details/manifest.json`

### 模式切换

- `price / land / heat`
  - 以站点为主
  - 默认优先显示当前视口内、分数更高、互相不打架的站点
- `schools / convenience`
  - 低缩放只保留 cluster
  - 放大后才显示原始单点
- `hazard / population`
  - 低缩放优先走 `overview`
  - 高缩放再切 `detail`

### 详情卡

- 搜索和地图点击都基于 `stations.base.json`
- 选中站点后才补 `details/shard-xx.json`
- 点击空白区域可以收起卡片

## 技术路线

- 前端：`React + TypeScript + Vite`
- 地图引擎：`MapLibre GL JS`
- 底图：`地理院タイル`
- 数据运输：
  - 纯静态站点
  - `manifest + chunk`
  - 不引入后端
  - 不上 PostGIS / TileServer

## 目录说明

- `specs/phase1-map-foundation-20260413/`
- `specs/phase2-runtime-data-and-tailnet-preview-20260413/`
- `specs/phase2-map-ux-refinement-20260413/`
- `specs/phase3-official-station-master-20260413/`
- `specs/phase3-zoom-adaptive-station-density-20260414/`
- `specs/phase4-product-roadmap-20260414/`
- `specs/phase5-phase-a-core-layers-20260414/`
- `specs/phase5-viewport-streaming-and-clarity-20260414/`
- `src/`
- `public/data/tokyo/runtime/`
- `public/data/tokyo/stations.meta.json`
- `scripts/build_tokyo_station_master.py`
- `scripts/build_tokyo_phase_a_layers.py`
- `scripts/start_tailnet_preview.sh`
- `scripts/stop_tailnet_preview.sh`

## 运行方式

```bash
npm install
npm run dev
```

构建与验证：

```bash
npm test
npm run lint
npm run build
```

重建官方车站底座：

```bash
python3 scripts/build_tokyo_station_master.py
```

重建 phase A 正式图层与 runtime chunk：

```bash
REINFOLIB_SUBSCRIPTION_KEY='<your-key>' python3 scripts/build_tokyo_phase_a_layers.py
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

## 当前边界

- 当前只做东京，不扩到其他城市
- 站点是核心锚点，不做房源级列表
- 灾害模式当前只正式接入洪水浸水，不代表全灾种完成
- 便利度是“医疗 + 公共服务”的第一版官方代理指标，不是完整生活评分体系
- 还没有站点详情页、分享页和 AI 功能
- 这版虽然已经切到 runtime chunk，但默认东京核心视角仍然覆盖东京大部分正式数据 bbox：
  - `schools` 首次切换仍会命中 `83` 个 chunk
  - `convenience` 首次切换仍会命中 `84` 个 chunk
- 也就是说，这版已经完成“按模式 + 按视口 + 按详情点击补载”的静态 chunk 底座，但如果要把低缩放点模式继续压瘦，下一步仍需要：
  - 预聚合的低缩放 cluster 数据
  - 或真正的矢量瓦片 pipeline

## 本轮收口验证

- `npm test` 通过
- `npm run lint` 通过
- `npm run build` 通过
- `./scripts/start_tailnet_preview.sh` 通过
- `curl -I http://127.0.0.1:4173/` 返回 `HTTP 200`
- `curl -I https://vps-jp.tail4b5213.ts.net:8443/` 返回 `HTTP 200`
- Chromium + SwiftShader 前台 smoke 通过以下检查：
  - 默认房产均价模式实测 `41` 个站点圆点、`10` 个站名、`10` 个价格 badge
  - 首屏 runtime 请求压到 `3` 个
  - `学校分布` 只请求 schools manifest + chunk
  - `生活便利度` 只请求 convenience manifest + chunk
  - `灾害风险` 只请求 hazard overview manifest + chunk
  - 真实点击站点可以打开卡片
  - 真实点击地图空白区域可以收起卡片
- 前台截图产物：
  - `price-default.png`
  - `station-open.png`

## 仓库卫生要求

- 根 `README.md` 是当前状态唯一真相源
- 每轮实现结束后，必须同步 README
- 没有验证，不算完成
- 项目可交付状态应满足：
  - 代码已验证
  - 预览入口可用
  - README 已回写
  - `git status --short` 为空

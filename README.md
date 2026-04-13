# 日本房价地图

以东京车站为锚点的单页地图工具。

目标不是做房源列表平台，而是先做一张可以瞬时切换多种研究模式的东京地图底座，让用户围绕“站点”快速判断区域价格、热度、配套、风险和长期趋势。

## 当前状态

- 状态：`phase5.1 core layers + layer-native station rendering 已落地`
- 当前版本：`单页东京地图 + 官方车站主表 + 7 模式切换 + 正式点/区域图层 + MapLibre 原生站点渲染 + Tailnet 预览`
- 当前已完成：
  - 直接进入东京地图，不做单独首页
  - Google Maps 风格启发的左侧工具栏与左上搜索栏
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
  - 站点显示数量随缩放级别分层展开
  - 默认保留大站站名，小站只保留图标
  - 房产均价模式直接把价格写在站点图标上
  - 点击地图空白区域可收起站点卡片
  - 图例会自动收起，避免长期挡住地图
  - 站点卡片已接入正式字段：
    - 成交价样本量
    - 地价样本量
    - 便利度构成
    - 人口变化率
    - 洪水浸水等级
  - 学校、便利度、灾害、人口图层全部改为 MapLibre `source + layer`
  - 站点也已改为 MapLibre 原生图层渲染，不再使用旧 DOM marker
  - PM2 常驻预览进程
  - Tailnet HTTPS 预览入口

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

### 当前前台表现

- 默认远视角实测渲染站点：`27`
- 放大后站点数量会继续增加，不再一上来把 500+ 个站全部铺满
- 前台验收确认：站点 DOM marker 数量为 `0`

## 技术路线

- 前端：`React + TypeScript + Vite`
- 地图引擎：`MapLibre GL JS`
- 底图：`地理院タイル`
- 当前图层模型：
  - 站点层
  - 点位层
  - 区域层
- 当前运行时数据目录：`public/data/tokyo/`

## 目录说明

- `specs/phase1-map-foundation-20260413/`：第一轮地图底座 spec / plan
- `specs/phase2-runtime-data-and-tailnet-preview-20260413/`：运行时数据目录与 Tailnet 预览
- `specs/phase2-map-ux-refinement-20260413/`：前台交互修正
- `specs/phase3-official-station-master-20260413/`：官方车站主表与客流接入
- `specs/phase3-zoom-adaptive-station-density-20260414/`：缩放驱动站点密度
- `specs/phase4-product-roadmap-20260414/`：产品路线图
- `specs/phase5-phase-a-core-layers-20260414/`：前三类核心图层正式化
- `src/`：前端源码
- `public/data/tokyo/stations.json`：前台实际使用的车站数据
- `public/data/tokyo/stations.meta.json`：当前数据覆盖元信息
- `public/data/tokyo/schools.json`：学校点图层
- `public/data/tokyo/convenience.json`：便利度点图层
- `public/data/tokyo/hazards.json`：洪水风险面图层
- `public/data/tokyo/population.json`：人口趋势面图层
- `scripts/build_tokyo_station_master.py`：重建官方东京车站底座
- `scripts/build_tokyo_phase_a_layers.py`：生成前三类核心图层正式数据
- `scripts/start_tailnet_preview.sh`：启动 Tailnet 预览
- `scripts/stop_tailnet_preview.sh`：停止 Tailnet 预览

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

重建 Phase A 正式图层：

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
- 当前打包体积偏大，后续仍应继续做图层按需加载和数据瘦身

## 本轮收口验证

- `npm test` 通过
- `npm run lint` 通过
- `npm run build` 通过
- `./scripts/start_tailnet_preview.sh` 通过
- `curl -I http://127.0.0.1:4173/` 返回 `HTTP 200`
- `curl -I https://vps-jp.tail4b5213.ts.net:8443/` 返回 `HTTP 200`
- Chromium + SwiftShader 前台 smoke 通过以下检查：
  - 默认远视角渲染站点为 `27`
  - `学校分布 / 生活便利度 / 灾害风险` 模式切换会正确切换图层可见性
  - 站点 DOM marker 数量为 `0`
  - 真实点击站点可打开卡片
  - 真实点击地图空白区域可收起卡片
  - 放大后渲染站点数量会增加

## 仓库卫生要求

- 根 `README.md` 是当前状态唯一真相源
- 每轮实现结束后，必须同步 README
- 没有验证，不算完成
- 项目可交付状态应满足：
  - 代码已验证
  - 预览入口可用
  - README 已回写
  - `git status --short` 为空

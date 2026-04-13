# 日本房价地图

以东京车站为锚点的单页地图工具。

当前目标不是做房源列表平台，而是先做一个能快速切换多种研究模式的地图底座，让用户在同一张地图上研究：

- 房产参考价格带
- 公示地价
- 车站热度
- 学校
- 灾害风险

## 当前状态

- 状态：`phase3.1 zoom adaptive density 已落地`
- 当前版本：`单页东京地图 + 官方车站主表 + 官方站别客流 + 缩放驱动的车站密度控制 + 首批 5 个模式 + Tailnet 预览`
- 数据状态：`车站坐标与热度已接官方数据；价格、地价、学校、灾害仍是部分覆盖`
- 当前已完成：
  - 东京地图直入
  - Google Maps 风格启发的左侧工具栏与左上搜索框
  - 官方东京核心车站主表接入
  - 官方 `S12-24` 站别客流接入
  - 车站锚点常驻
  - 模式切换
  - 站点搜索
  - 轻量站点面板
  - 默认不再自动弹出说明层
  - 默认不再自动展开站点卡片
  - 学校点图层
  - 灾害风险面图层
  - `public/data/tokyo/` 运行时数据目录
  - PM2 常驻预览进程
  - Tailnet HTTPS 预览入口
  - 大站默认保留站名，小站降为图标级展示
  - 房产均价模式直接把价格写到 marker 上
  - 图例支持自动缩小，避免长期挡住地图
  - 点击地图空白区域可收起站点卡片
  - `scripts/build_tokyo_station_master.py` 可重复生成官方车站底座
  - 车站显示数量会随缩放级别分层展开，不再默认铺满 500+ 个点
  - 当前生成结果：
    - 东京核心站点：`589`
    - 默认大站标签：`19`
    - 已有价格覆盖站点：`14`
    - 已有真实客流站点：`588`
    - 默认缩放 `10.4`：
      - `price` 模式可见站点：`25`
      - `heat` 模式可见站点：`19`
    - 中间缩放 `11.2`：可见站点约 `58`
    - 放大到 `12.2`：可见站点约 `159`
    - 放大到 `13.0+`：恢复显示全部 `589`

## 第一轮范围

- 直接进入东京地图
- Google Maps 风格启发的左侧边栏和左上搜索区
- 地图始终保留车站锚点
- 顶部或边缘模式按钮切换图层
- 轻量站点信息面板
- 首批模式：
  - 房产均价
  - 公示地价
  - 车站热度
  - 学校
  - 灾害风险

## 技术路线

- 前端：React + TypeScript + Vite
- 地图引擎：MapLibre GL JS
- 底图：日本官方地理院公开瓦片
- 核心思路：先把车站主索引、图层注册表、模式控制器、站点空间聚合接口形态做出来，再逐步替换各模式的数据源
- 当前数据入口：`public/data/tokyo/stations.json`、`stations.seed.json`、`stations.meta.json`、`schools.json`、`hazards.json`

## 目录说明

- `specs/phase1-map-foundation-20260413/`：第一轮任务 spec 和 plan
- `specs/phase2-runtime-data-and-tailnet-preview-20260413/`：第二轮任务 spec 和 plan
- `specs/phase2-map-ux-refinement-20260413/`：当前这轮前台交互修正
- `specs/phase3-official-station-master-20260413/`：官方车站主表与真实客流接入
- `specs/phase3-zoom-adaptive-station-density-20260414/`：缩放驱动的车站密度控制
- `specs/phase4-product-roadmap-20260414/`：后续批次路线图 spec
- `src/`：前端源码
- `public/data/tokyo/stations.seed.json`：当前手写种子覆盖层
- `public/data/tokyo/stations.json`：前台实际使用的车站数据
- `public/data/tokyo/stations.meta.json`：本轮生成元数据
- `scripts/start_tailnet_preview.sh`：启动 Tailnet 预览
- `scripts/stop_tailnet_preview.sh`：停止 Tailnet 预览
- `scripts/build_tokyo_station_master.py`：下载官方 `N02-24 + S12-24` 并生成东京车站底座

## 运行方式

```bash
npm install
npm run dev
```

如需构建验证：

```bash
npm test
npm run lint
npm run build
```

如需重新生成车站底座：

```bash
python3 scripts/build_tokyo_station_master.py
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

这条地址可在同一 Tailnet 内的 `home-windows.tail4b5213.ts.net` 直接打开。

## 当前限制

- 当前只有车站坐标与热度已经正式官方化
- 价格、公示地价、学校、灾害仍未全量官方化
- 当前 `stations.json` 是“官方主表 + 手写覆盖层”合成结果，不是所有模式都已完成正式导入
- 东京范围当前使用的是“东京核心 bbox”，不是整个东京都行政边界
- 当前仍使用 DOM marker；如果后面继续上更多设施点或更大范围，可能需要切到图层化渲染
- 还没有站点详情页、分享页和 AI 解读
- 当前重点是“地图底座能否持续挂新图层”，不是数据完整度

## 下一轮建议

- 下一阶段目标不是只做完 Batch 1
- 下一阶段要连续完成前三类核心图层：
  - Batch 1：`站点价值核心`
  - Batch 2：`点图层包`
  - Batch 3：`区域图层包`
- 前三类图层完成后再做 Phase B：`产品层`
- 最后才做 Phase C：`AI 层`

## 本轮验收

- `python3 scripts/build_tokyo_station_master.py` 通过
- `npm test` 通过
- `npm run lint` 通过
- `npm run build` 通过
- `curl -I http://127.0.0.1:4173/` 返回 `HTTP 200`
- `curl -I https://vps-jp.tail4b5213.ts.net:8443/` 返回 `HTTP 200`
- `curl http://127.0.0.1:4173/data/tokyo/stations.meta.json` 返回官方主表元数据
- 默认缩放可见站点已从“全量 589”降到：
  - `price` 模式 `25`
  - `heat` 模式 `19`

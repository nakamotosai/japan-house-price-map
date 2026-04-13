# 日本房价地图

以东京车站为锚点的单页地图工具。

当前目标不是做房源列表平台，而是先做一个能快速切换多种研究模式的地图底座，让用户在同一张地图上研究：

- 房产参考价格带
- 公示地价
- 车站热度
- 学校
- 灾害风险

## 当前状态

- 状态：`phase2 runtime data + tailnet preview 已落地`
- 当前版本：`单页东京地图 + MapLibre 开源地图底座 + 首批 5 个模式 + 运行时 JSON 数据目录 + Tailnet 预览`
- 数据状态：`当前仍是种子数据，但已经从打包时写死改成 public/data 运行时加载`
- 当前已完成：
  - 东京地图直入
  - Google Maps 风格启发的左侧工具栏与左上搜索框
  - 车站锚点常驻
  - 模式切换
  - 站点搜索
  - 轻量站点面板
  - 学校点图层
  - 灾害风险面图层
  - `public/data/tokyo/` 运行时数据目录
  - PM2 常驻预览进程
  - Tailnet HTTPS 预览入口

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
- 核心思路：先把车站主索引、图层注册表、模式控制器、站点空间聚合接口形态做出来
- 当前数据入口：`public/data/tokyo/stations.json`、`schools.json`、`hazards.json`

## 目录说明

- `specs/phase1-map-foundation-20260413/`：第一轮任务 spec 和 plan
- `specs/phase2-runtime-data-and-tailnet-preview-20260413/`：第二轮任务 spec 和 plan
- `src/`：前端源码
- `public/data/tokyo/`：当前东京种子数据目录
- `scripts/start_tailnet_preview.sh`：启动 Tailnet 预览
- `scripts/stop_tailnet_preview.sh`：停止 Tailnet 预览

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

- 当前站点、学校和风险数据仍是种子数据，不是正式官方全量数据
- 还没有正式的官方数据抓取 / 清洗流水线，当前只是运行时 JSON 加载
- 还没有站点详情页、分享页和 AI 解读
- 当前重点是“地图底座能否持续挂新图层”，不是数据完整度

## 本轮验收

- `npm test` 通过
- `npm run lint` 通过
- `npm run build` 通过
- `curl -I http://127.0.0.1:4173/` 返回 `HTTP 200`
- `curl -I https://vps-jp.tail4b5213.ts.net:8443/` 返回 `HTTP 200`

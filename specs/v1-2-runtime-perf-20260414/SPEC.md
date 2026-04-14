# 日本房价地图 V1.2 Runtime Perf SPEC

> 当前状态真相源最终仍以项目根 `README.md` 为准。本 Spec 只服务于本轮续作。

## 1. 目标

把当前 `Tokyo V1.1` 从“前端壳层已收好”推进到“默认视口请求更克制、首屏包体更健康”的 `V1.2`：

- 不改东京范围
- 不改 7 模式集合
- 不改正式数据口径
- 不开产品层新功能

这轮只解决性能与 runtime 结构问题。

## 2. 已确认问题

- 默认东京视口切到 `schools / convenience / hazard / population` 时，请求仍偏碎。
- 当前 runtime 只有 `overview/detail` 两档，缺面向默认视口的更粗 `summary` 层。
- build 仍把大部分运行时代码塞进单一入口 chunk。

## 3. 本轮范围

### 必做

- 为 `schools / convenience / hazard / population` 增加第三档 runtime：
  - `summary`
  - `overview`
  - `detail`
- 让默认东京视口优先命中 `summary` 而不是直接吃 `overview`
- `summary` 层要求：
  - point 模式更粗聚合
  - area 模式更粗 chunk 和更激进简化
- 前端识别 `summary` 级别并正确显示说明
- Vite build 增加稳定 manual chunk 拆分，把 `react` 和 `maplibre` 从主入口里拆出去
- 跑完整验证与前台验收
- 回写 README

### 本轮不做

- 不新增筛选器、分享、比较、AI
- 不重做地图交互壳层
- 不新增后端服务

## 4. 方案

### A. Runtime 三档化

- point 模式：
  - `summary`: 默认东京视口优先用的更粗聚合层
  - `overview`: 中缩放聚合层
  - `detail`: 高缩放原始点
- area 模式：
  - `summary`: 更粗 chunk + 更激进简化
  - `overview`: 当前低缩放层
  - `detail`: 细节层

### B. 前端选择逻辑

- `useTokyoData` 继续按 `runtime/index.json` 选 manifest。
- `summary` 层降低视口 padding，避免默认视口额外过抓。
- 图例和面板文案补 `summary` 口径。

### C. Build 拆分

- `react` 和 `maplibre-gl` 拆为稳定 vendor chunk。
- 说明弹窗继续保留懒加载。

## 5. 前端验收矩阵

### Local Preview

- `http://127.0.0.1:4173/`

### Live Preview

- `https://vps-jp.tail4b5213.ts.net:8443/`

### Required States

- desktop 默认态
- desktop 各模式切换态
- desktop 站点打开态
- mobile 默认态
- live 默认态

### Project P0

- 默认东京视口下，`schools / convenience / hazard / population` 必须优先走 `summary` 或至少明显更少请求。
- local 和 live 入口都必须继续可用。
- 模式切换、搜索、空白关闭卡片不能退化。
- build 必须拆出 vendor chunk，不再只有一个大入口包。

## 6. 验收

- `npm test` 通过
- `npm run lint` 通过
- `npm run build` 通过
- `python3 scripts/build_tokyo_phase_a_layers.py --skip-station-master` 跑通
- `npm run acceptance:tokyo-v1` 通过
- 最新 report 明确记录 `summary / overview / detail` 命中结果
- README 已回写 `V1.2` 状态与最新 runtime 摘要
- `git status --short` 为空

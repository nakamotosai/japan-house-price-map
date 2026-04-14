# 日本房价地图 V1.1 Shell And Acceptance SPEC

> 当前状态真相源最终仍以项目根 `README.md` 为准。本 Spec 只服务于本轮续作。

## 1. 目标

把当前 `Tokyo V1` 从“功能可用”推进到“前端壳层更克制、验收证据更硬”的 `V1.1`：

- 不改东京范围
- 不改正式数据口径
- 不做新模式
- 不开新页面

这轮只解决已经验出来的前端壳层与验收缺口。

## 2. 已确认问题

- 移动端首屏信息层过重，搜索、模式区和图例同时压住地图。
- 左侧菜单按钮是死控件，前台给了入口但没有真实作用。
- 固定验收脚本覆盖不够，只验了部分模式和少量状态。
- 首屏主包偏大，继续叠加产品层能力前应先做一层前端切片。

## 3. 本轮范围

### 必做

- 收紧移动端首屏层级：
  - 模式区不再多行挤占地图
  - 图例在移动端默认折叠
  - 保持搜索、选站、卡片关闭仍可用
- 把左侧菜单按钮改成真实可用入口：
  - 能打开轻量操作菜单
  - 至少包含模式切换、重置视角、说明入口、图例开关
- 补一层前端切片，优先把非首屏说明层从主包里拆出去
- 增强固定验收脚本与产物：
  - 覆盖 `price / land / heat / schools / convenience / hazard / population`
  - 覆盖说明弹窗、搜索零结果、桌面默认态、桌面交互态、移动端默认态、移动端菜单态
  - 输出 `console-report.json`、`network-report.json`、`interaction-summary.json`
  - 补本地入口与 live 入口复核
- 回写根 `README.md`

### 本轮不做

- 不重做 runtime chunk 生成策略
- 不新增站点比较、分享、筛选器
- 不新增城市或多页面结构
- 不调整数据 builder、数据源与覆盖率口径

## 4. 实现方案

### A. 壳层减负

- 桌面端继续保留顶部模式 chips。
- 移动端改成单行横向模式带，不允许多行堆叠。
- 图例在移动端默认折叠，只在用户主动打开时展开。

### B. 菜单真实化

- 左上按钮打开轻量菜单卡片，而不是展示无效字符。
- 菜单承接高频操作：
  - 模式切换
  - 重置东京视角
  - 打开数据说明
  - 展开/收起图例

### C. 首屏切片

- 说明弹窗改为懒加载组件。
- 首屏仍保持地图、搜索、左侧栏、模式切换和站点卡片即时可用。

### D. 验收强化

- 继续复用仓库内 `npm run acceptance:tokyo-v1`。
- 扩展脚本输出固定证据，而不是只给 3 张图和摘要 JSON。

## 5. 前端验收矩阵

### Local Preview

- `http://127.0.0.1:4173/`

### Live Preview

- `https://vps-jp.tail4b5213.ts.net:8443/`

### Required Routes

- `/`

### Required States

- desktop 默认态
- desktop 站点打开态
- desktop 说明弹窗打开态
- desktop 搜索零结果态
- desktop 各模式切换态
- mobile 默认态
- mobile 菜单打开态

### Required Viewports

- desktop: `1440x960`
- mobile: `393x852`

### Project P0

- 移动端首屏不能再出现多行模式按钮把地图压成碎片。
- 菜单按钮必须是真实可交互入口。
- 搜索、模式切换、空白点击收起卡片必须继续可用。
- 验收脚本必须输出 console / network / interaction 证据。
- local 和 live 入口都必须返回可用页面。

### Performance Guard

- 用户点击模式或菜单后应在 `<=150ms` 内出现可感知反馈。
- `npm run build` 允许仍有 chunk warning，但主包应较当前基线下降。

## 6. 验收

- `npm test` 通过
- `npm run lint` 通过
- `npm run build` 通过
- `npm run acceptance:tokyo-v1` 通过
- 最新验收产物包含：
  - desktop/mobile/live 截图
  - `console-report.json`
  - `network-report.json`
  - `interaction-summary.json`
- README 已回写 `V1.1` 前端变化和最新产物路径
- `git status --short` 为空

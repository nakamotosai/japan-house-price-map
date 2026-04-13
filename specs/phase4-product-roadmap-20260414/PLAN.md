# 日本房价地图 Product Roadmap Implementation Plan

> **For agentic workers:** In Codex, use `superpowers:executing-plans` by default. Use `superpowers:subagent-driven-development` only when independent lanes exist and the user explicitly allows delegation or parallel agent work. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current Tokyo map foundation into a genuinely useful station-first research tool by executing the next batches in dependency order.

**Architecture:** Keep the single-page map shell and station-first interaction unchanged. Advance the project by replacing placeholder data mode-by-mode, while building shared ingestion and rendering bottoms only when multiple upcoming modes clearly depend on them.

**Tech Stack:** React, TypeScript, Vite, MapLibre GL JS, Python data builders, official Japanese public datasets and APIs

---

### Batch 1: 站点价值核心

**Why this is one batch:** 房产成交价、公示地价和站点聚合是同一条数据链，拆开做会重复改 schema、聚合逻辑和面板字段。

**Primary outputs:**
- 正式房产成交价导入脚本
- 正式公示地价导入脚本
- 站点聚合结果文件
- `price` / `land` 模式改为正式值驱动

**Acceptance gate:**
- 价格和地价两个模式都能在核心站点上给出正式聚合值
- 未覆盖站点明确显示未覆盖
- README 更新覆盖率、更新时间和口径说明

### Batch 2: 点图层包

**Why this is one batch:** 学校和生活便利度本质上都是大量点位图层，应该共用同一套 schema、渲染和过滤逻辑。

**Primary outputs:**
- 点图层统一 schema
- 学校正式点图层
- 生活便利度点图层
- 点图层渲染升级

**Acceptance gate:**
- 至少 2 到 3 个正式点图层可切换
- 默认视图和放大视图都不爆点
- 侧边卡片能显示对应点图层的核心摘要

### Batch 3: 区域图层包

**Why this is one batch:** 灾害风险和人口趋势都是区域图层，颜色系统、legend、hover、透明度逻辑高度共享。

**Primary outputs:**
- 区域图层统一 schema
- 正式灾害风险图层
- 正式人口趋势图层
- 区域模式下的说明和面板联动

**Acceptance gate:**
- hazard 和 population 可独立切换
- 区域图层样式清晰，不压垮底图
- 站点卡片能联动区域解释

### Batch 4: 产品层

**Why this is one batch:** 这一批都是用户工作流强化，不是底层数据替换；放在一起做更能形成完整体验。

**Primary outputs:**
- 站点比较
- 分享 URL / 深链
- 条件筛选
- 方法说明抽屉

**Acceptance gate:**
- 用户能比较站点
- 用户能分享当前视角和模式
- 方法说明能覆盖主要模式

### Batch 5: AI 层

**Why this is a separate batch:** AI 只能建立在前四批的结构化结果之上，不能抢跑。

**Primary outputs:**
- AI 站点解释
- AI 站点比较
- AI 条件式选站

**Acceptance gate:**
- AI 输出引用结构化数据
- AI 不伪造缺失数据
- AI 入口不破坏地图工具主视图

### 执行顺序

- [ ] 先做 Batch 1，不跳批
- [ ] Batch 1 通过后再开 Batch 2
- [ ] Batch 2 通过后再开 Batch 3
- [ ] Batch 3 通过后再开 Batch 4
- [ ] Batch 4 通过后再开 Batch 5

### 现在的直接下一步

- [ ] 为 Batch 1 单独开下一轮 task spec
- [ ] 明确价格聚合口径：
  - 站点半径还是最近站归属
  - 时间窗口按年还是按季度
  - 核心站和低样本站如何显示
- [ ] 明确公示地价口径：
  - 站点附近取样方式
  - 与成交价的关系说明
- [ ] 先做东京范围，不扩城市

# 日本房价地图 V1.5 Bundle Upgrade SPEC

> 当前状态真相源最终仍以项目根 `README.md` 为准。本 Spec 只服务于本轮连续升级。

## 1. 目标

把当前 `Tokyo V1.2 runtime perf` 继续推进到一轮打包升级版：

- `V1.3` 数据传输继续降重
- `V1.4` 图例文本与验收报告补全
- `V1.5` 站点详情体验增强

这次不拆回合，中间不以“先做一部分”为停点。

## 2. 已确认问题

- `hazard / population` 的 area chunk 仍把完整面数据重复写进多个 chunk，运行时目录过重。
- 固定前台验收里的 `legendText` 仍会因为图例收起而出现空白，报告不完整。
- 站点详情虽然已经按 shard 补载，但还缺：
  - 更主动的预取
  - 明确可复用的 URL 状态
  - 前台可见的分享入口

## 3. 本轮范围

### 必做

- Area runtime 继续降重：
  - 为 `hazard / population` 的各层引入“catalog + chunk id 引用”结构，减少重复传输
  - 前端保持同样的地图结果，不退化现有模式切换
- 图例与验收补全：
  - 图例脚注在 7 个模式下都能稳定给出非空语义文本
  - 验收脚本在截图和采集文本前确保图例处于可读状态
- 站点详情增强：
  - 详情 shard 增加有限预取与缓存复用
  - URL 支持带 `mode` 与 `station` 状态直达
  - 站点面板增加分享入口，优先 Web Share，失败时回退到复制链接
- 跑完整验证与前台验收
- 回写 README

### 本轮不做

- 不扩到东京以外城市
- 不新增筛选器、账号、AI 功能
- 不做独立站点详情页
- 不把区域层改成矢量瓦片服务

## 4. 方案

### A. Area runtime 去重传输

- `hazard / population` 的每个 level 产出：
  - `*.catalog.json`
  - `chunks/*.json` 只保留 feature id 列表
- manifest 额外记录 `catalogPath`
- 前端先缓存 catalog，再按 chunk id 组装最终 feature payload

### B. 图例与验收

- 图例脚注对站点模式给出各自语义，而不是只给通用描述
- overlay 模式继续显示当前层级和命中 chunk 数
- 验收脚本先展开图例，再采集 `legendText`

### C. 站点详情体验

- runtime ready 后按优先级预取少量热门 shard
- 选中站点时继续复用 shard LRU cache
- App 把 `mode` / `station` 同步到 URL
- StationPanel 增加“分享这站”入口和分享结果提示

## 5. 前端验收矩阵

### Local Preview

- `http://127.0.0.1:4173/`

### Live Preview

- `https://vps-jp.tail4b5213.ts.net:8443/`

### Required States

- desktop 默认态
- desktop 7 模式切换态
- desktop 站点打开态
- desktop 分享入口可见
- mobile 默认态
- live 默认态

## 6. 验收

- `python3 scripts/build_tokyo_phase_a_layers.py --skip-station-master` 通过
- `npm test` 通过
- `npm run lint` 通过
- `npm run build` 通过
- `npm run acceptance:tokyo-v1` 通过
- 最新 report 里 7 个模式都有可读 `legendText`
- README 已回写 `V1.5` 状态、最新 artifact 路径和当前边界
- `git status --short` 为空

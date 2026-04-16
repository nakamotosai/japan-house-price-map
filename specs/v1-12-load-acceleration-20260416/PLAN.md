# V1.12 Load Acceleration Plan

## 1. 首屏壳层

- 修改 `index.html`
- 增加 HTML 级首屏骨架和内联样式
- 让页面在 React 启动前就有稳定可见内容
- 验证：profiling 里的 `shell visible` 明显早于当前基线

## 2. 启动链路提速

- 修改 `src/lib/maplibreLoader.ts`
- 修改 `src/main.tsx`
- 新增前端 bootstrap 预热逻辑
- 让 MapLibre runtime 与 runtime index / station bootstrap 并行开始
- 验证：`maplibre ready`、`map object ready` 早于当前基线

## 3. 站点 runtime 首屏切分

- 修改 `scripts/build_tokyo_phase_a_layers.py`
- 修改 `src/types.ts`
- 修改 `src/hooks/useTokyoData.ts`
- 生成东京核心首屏 bootstrap station payload，并把全量 station base 改成后台扩展
- 验证：首屏请求不再直接拉整份 `stations.base.json`

## 4. 地图可见反馈

- 修改 `src/components/TokyoMap.tsx`
- 修改 `src/styles.css`
- 在真实底图绘制前提供地图级加载占位，避免白块
- 验证：前台默认打开时先看到东京骨架，再平滑切到真实地图

## 5. 量化与收口

- 新增 profiling 脚本
- 跑 `npm test`、`npm run build`、Tailnet live 验收、冷/热启动对比
- 更新 `README.md`、提交、推送、保持工作树干净

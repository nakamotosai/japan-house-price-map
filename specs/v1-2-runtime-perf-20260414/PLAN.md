# 日本房价地图 V1.2 Runtime Perf PLAN

> 当前状态真相源最终仍以项目根 `README.md` 为准。本 Plan 只服务于本轮执行。

## 执行顺序

- [ ] Batch A: 扩 runtime 三档 builder
- [ ] Batch B: 调整前端 manifest 选择与文案
- [ ] Batch C: 拆 build chunk
- [ ] Batch D: 重建 runtime、前台验收、README 收口

## Batch A runtime builder

- [ ] 为 point 模式新增 `summary` 聚合与 chunk manifest
- [ ] 为 area 模式新增 `summary` chunk manifest
- [ ] 更新 `runtime/index.json` manifest 区间
- [ ] 更新 `runtime.summary` 统计字段

## Batch B 前端

- [ ] 扩 `RuntimeLayerLevel`
- [ ] 补 `summary` 文案显示
- [ ] 降低 `summary` 层的视口 padding，避免过抓

## Batch C build

- [ ] 在 `vite.config.ts` 增加 `manualChunks`
- [ ] 确认 build 输出出现独立 vendor chunk

## Batch D 验证与收口

- [ ] `python3 scripts/build_tokyo_phase_a_layers.py --skip-station-master`
- [ ] `npm test`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npm run acceptance:tokyo-v1`
- [ ] 回写根 `README.md`
- [ ] commit
- [ ] push

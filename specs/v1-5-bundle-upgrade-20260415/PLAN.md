# 日本房价地图 V1.5 Bundle Upgrade PLAN

> 当前状态真相源最终仍以项目根 `README.md` 为准。本 Plan 只服务于本轮执行。

## 执行顺序

- [ ] Batch A: 改 area runtime 为 catalog + chunk ids
- [ ] Batch B: 改前端 loader / hook 以兼容 area catalog
- [ ] Batch C: 补图例脚注与验收脚本
- [ ] Batch D: 补站点详情预取、URL 状态与分享入口
- [ ] Batch E: 重建 runtime、前台验收、README 收口

## Batch A runtime builder

- [ ] 扩 `ChunkManifest` 输出结构，允许 area manifest 挂 `catalogPath`
- [ ] `hazard / population` summary/overview/detail 改为 catalog + id chunk
- [ ] 保持 point 模式 chunk 结构不变

## Batch B 前端 loader

- [ ] 扩类型与 loader，支持 area catalog
- [ ] `useTokyoData` 在 area 模式下缓存 catalog 并按 ids 还原 feature
- [ ] 保持现有 dedupe 保护

## Batch C 图例与验收

- [ ] 给 7 模式稳定输出可读脚注
- [ ] 验收脚本增加“确保图例展开”步骤

## Batch D 站点详情

- [ ] 加入少量热门 shard 预取
- [ ] 把 `mode` / `station` 与 URL 同步
- [ ] StationPanel 增加分享按钮与前台提示

## Batch E 验证与收口

- [ ] `python3 scripts/build_tokyo_phase_a_layers.py --skip-station-master`
- [ ] `npm test`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npm run acceptance:tokyo-v1`
- [ ] `curl -I http://127.0.0.1:4173/`
- [ ] `curl -I https://vps-jp.tail4b5213.ts.net:8443/`
- [ ] 回写根 `README.md`
- [ ] commit
- [ ] push

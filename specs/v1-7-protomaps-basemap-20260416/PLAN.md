# 日本房价地图 V1.7 Protomaps Basemap Switch PLAN

> 当前状态真相源最终仍以项目根 `README.md` 为准。本 Plan 只服务于本轮执行。

## 执行顺序

- [ ] Batch A: 接入 Protomaps 依赖与协议
- [ ] Batch B: 替换底图 style 为浅色 Protomaps
- [ ] Batch C: 调整验收与前端静态真相
- [ ] Batch D: 构建、前台验收、README 收口

## Batch A 依赖与协议

- [ ] 安装 `pmtiles`
- [ ] 安装 `@protomaps/basemaps`
- [ ] 增加 `pmtiles` protocol 注册逻辑

## Batch B 底图替换

- [ ] 把 `TOKYO_MAP_STYLE` 从 GSI raster 改为 Protomaps style builder
- [ ] 选择浅色主题 flavor
- [ ] 保持现有业务图层插入顺序不退化

## Batch C 验收与真相

- [ ] 让固定验收报告能覆盖新底图请求
- [ ] 确认 desktop / mobile / live 截图都能看到底图

## Batch D 验证与收口

- [ ] `npm test`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npm run acceptance:tokyo-v1`
- [ ] 回写根 `README.md`
- [ ] commit
- [ ] push

# 日本房价地图 V1.8 Kanto Frame PLAN

## 执行顺序

- [ ] Batch A: 改地图默认视角与边界
- [ ] Batch B: 改前台 copy 与 README 口径
- [ ] Batch C: 跑验收并提交推送

## Batch A

- [ ] 定义关东 bounds / center / zoom
- [ ] 地图初始化切到关东
- [ ] reset 动作切到关东
- [ ] 限制 maxBounds

## Batch B

- [ ] 把“重置东京视角”改成“重置关东视角”
- [ ] README 同步“关东底图范围 + 东京数据”

## Batch C

- [ ] `npm test`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npm run acceptance:tokyo-v1`
- [ ] commit
- [ ] push

# 日本房价地图 Phase 5 Phase A Core Layers PLAN

> 执行原则：这轮不是只做 Batch 1，而是把前三类核心图层连续落完。

## 主线

- [ ] 先把本轮数据口径写成 task spec
- [ ] 搭一套统一的数据生成脚本
- [ ] 升级前端类型、loader、模式注册表
- [ ] 接入六个模式的数据文件
- [ ] 调整地图图层和站点卡片
- [ ] 做完整验证
- [ ] 更新 README 并推送

## Step 1 数据生成底座

- [ ] 保留现有 `build_tokyo_station_master.py`
- [ ] 新增一条 Phase A 数据构建脚本
- [ ] 让脚本先刷新官方车站底座，再做 enrichment
- [ ] 把结果统一写回 `public/data/tokyo/`

## Step 2 站点价值核心

- [ ] 从官方成交价结果接口抓取东京 2024 住宅成交样本
- [ ] 以 `station_name_ja` 聚合为站点价格摘要
- [ ] 从 `L01-25` 聚合站点公示地价
- [ ] 更新 `stations.json` 的价格、地价、覆盖率、样本量和说明

## Step 3 点图层包

- [ ] 从 `P29-23` 生成学校点
- [ ] 从 `P04-20 + P05-22` 生成便利度点
- [ ] 给点图层做统一 schema
- [ ] 前端改成支持聚类点图层

## Step 4 区域图层包

- [ ] 从 `A31a-24` 生成站点相关洪水风险面
- [ ] 从 `500m_mesh_2024_13` 生成人口趋势面
- [ ] 给区域图层做统一 schema
- [ ] 让站点面板联动区域结论

## Step 5 前端联动

- [ ] 增加 `convenience` / `population` 模式
- [ ] 图例、站点 marker 颜色、侧边卡一起补齐
- [ ] 对无覆盖站显示中性状态

## Step 6 验证

- [ ] `npm test`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] 重启 Tailnet 预览
- [ ] `curl -I http://127.0.0.1:4173/`
- [ ] `curl -I https://vps-jp.tail4b5213.ts.net:8443/`

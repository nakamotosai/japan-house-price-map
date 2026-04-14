# 日本房价地图 Phase 5.2 Viewport Streaming And Clarity PLAN

> 执行原则：这版不加新功能，只做运输层和显示层。

## 主线

- [ ] 重构运行时数据组织
- [ ] 引入视口驱动的 chunk loader
- [ ] 改写站点显示预算和屏幕去重
- [ ] 压缩点图层和区域图层的低缩放表达
- [ ] 做真实前台验收
- [ ] 更新 README

## Step 1 数据打包重构

- [ ] 新增 chunk manifest 生成逻辑
- [ ] 生成 `stations.base.json`
- [ ] 生成站点详情 shard
- [ ] 把 `schools / convenience` 切成静态 chunk
- [ ] 给 `hazard / population` 生成 `overview / detail` 两级数据
- [ ] 对 `hazard` 做几何简化，先把最大体积砍下来

## Step 2 运行时加载器

- [ ] 设计 `mode -> manifest -> chunks` 加载链路
- [ ] 监听 `moveend / zoomend`
- [ ] 加入 padded bounds 预取
- [ ] 加入 chunk cache
- [ ] 加入过期请求取消
- [ ] 地图切换时保留旧数据直到新数据到位

## Step 3 站点显示逻辑

- [ ] 把候选站点改成“当前视口内优先”
- [ ] 拆成 `anchor dot / name label / metric badge` 三层预算
- [ ] 为 `price / land / heat` 设计独立预算
- [ ] 加入屏幕空间最小间距去重
- [ ] 默认低缩放把价格 badge 压到 `8 ~ 10`

## Step 4 点图层与区域图层

- [ ] `schools / convenience` 在低缩放只显示 cluster
- [ ] 高缩放才显示原始单点
- [ ] `hazard / population` 低缩放优先用 overview 数据
- [ ] 区域模式下只保留 major station + selected station

## Step 5 验证

- [ ] `npm test`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] 重启 Tailnet 预览
- [ ] 检查首屏网络请求数量
- [ ] 检查模式切换是否只请求当前模式 chunk
- [ ] 检查拖地图后是否只补新区域 chunk
- [ ] 截图对比：
  - `price` 模式东京中心视角
  - `schools` 模式低缩放
  - `convenience` 模式低缩放
  - `hazard` 模式低缩放

## Step 6 README 与收口

- [ ] README 回写运输层方案
- [ ] README 回写新显示规则
- [ ] commit
- [ ] push
